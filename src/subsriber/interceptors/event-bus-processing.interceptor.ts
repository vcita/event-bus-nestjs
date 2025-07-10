import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, throwError, EMPTY } from 'rxjs';
import { ConsumeMessage } from 'amqplib';
import { Reflector } from '@nestjs/core';
import { InfraLoggerService, LogLevelEnum } from '@vcita/infra-nestjs';
import { ContextStore, runWithCtx } from '@vcita/infra-nestjs/dist/infra/utils/context-store.utils';
import { isRabbitContext } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';
import { EventHeaders, EventPayload } from '../../interfaces/event.interface';
import {
  EventData,
  EventBusSubscriberMetadata,
  EVENT_BUS_SUBSCRIBER_METADATA_KEY,
} from '../../interfaces/subscription.interface';
import {
  EventBusMetricsService,
  ValidationFailureType,
} from '../services/event-bus-metrics.service';
import { NonRetryableError, RetryError } from '../utils/event-retry-handler';

@Injectable()
export class EventBusProcessingInterceptor implements NestInterceptor {
  private readonly logger = new InfraLoggerService(EventBusProcessingInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly metricsService: EventBusMetricsService,
    private readonly configService: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const metadata = this.getEventBusMetadata(context);
    if (!metadata) {
      return next.handle();
    }

    const [event, amqpMsg] = context.getArgs() as [EventData, ConsumeMessage];
    const headers = amqpMsg.properties.headers || {};

    return this.processEvent(event, headers, metadata, next, amqpMsg);
  }

  private processEvent(
    event: EventData,
    headers: EventHeaders | Record<string, any>,
    metadata: EventBusSubscriberMetadata,
    next: CallHandler,
    amqpMsg: ConsumeMessage,
  ): Observable<any> {
    const loggerContext = this.getLoggerContext(headers, metadata);
    const routingKey = amqpMsg.fields.routingKey;
    const eventUid = headers.event_uid || 'unknown';

    return runWithCtx(async () => {
      try {
        this.metricsService.recordEventStatus('received', metadata, routingKey);

        const validationFailure = this.validateEvent(event, headers, metadata);
        if (validationFailure) {
          this.logger.infraLog(`Event is invalid, nacking`, '', LogLevelEnum.WARN, {
            event,
            headers,
            eventType: metadata.eventType,
          });
          this.metricsService.recordValidationFailure(validationFailure, metadata, routingKey);
          throw new NonRetryableError(`Event validation failed: ${validationFailure}`);
        }

        this.logger.log(`Processing ${metadata.eventType} event ${eventUid}`);
        const endTimer = this.metricsService.startProcessingTimer(metadata, routingKey);

        try {
          await next.handle().toPromise();

          this.logger.log(`Event ${eventUid} processed successfully`);
          this.metricsService.recordEventStatus('processed', metadata, routingKey);

          return EMPTY;
        } finally {
          endTimer();
        }
      } catch (error) {
        this.logger.error(
          `Error processing ${metadata.eventType} event: ${error.message}`,
          error.stack,
        );
        this.metricsService.recordEventStatus('failed', metadata, routingKey);
        return this.handleRetry(amqpMsg, error, metadata, routingKey);
      }
    }, loggerContext);
  }

  private getEventBusMetadata(context: ExecutionContext): EventBusSubscriberMetadata | null {
    if (!isRabbitContext(context)) {
      return null;
    }

    const handler = context.getHandler();
    const metadata = this.reflector.get<EventBusSubscriberMetadata>(
      EVENT_BUS_SUBSCRIBER_METADATA_KEY,
      handler,
    );

    return metadata;
  }

  private validateEvent(
    event: EventData,
    headers: EventHeaders | Record<string, any>,
    metadata: EventBusSubscriberMetadata,
  ): ValidationFailureType | null {
    if (metadata.eventType === 'legacy') {
      // Legacy events: no validation required - they can have any payload and headers
      return null;
    }

    // Standard events: strict validation
    const standardHeaders = headers as EventHeaders;
    const standardEvent = event as EventPayload<unknown>;

    if (!standardHeaders?.actor) {
      return 'missing_actor';
    }
    if (!standardEvent?.data || !standardEvent?.schema_ref) {
      return 'invalid_payload';
    }
    return null;
  }

  private getLoggerContext(
    headers: EventHeaders | Record<string, any>,
    metadata: EventBusSubscriberMetadata,
  ) {
    const context = ContextStore.getContext();
    const baseContext = {
      ...context,
      named_tags: {
        ...context.named_tags,
        event_type: metadata.eventType,
      },
    };

    // Add trace_id for standard events if available
    if (metadata.eventType === 'standard' && headers.trace_id) {
      baseContext.named_tags.trace_id = headers.trace_id;
    }

    return baseContext;
  }

  private handleRetry(
    amqpMsg: ConsumeMessage,
    error: any,
    metadata: EventBusSubscriberMetadata,
    routingKey: string,
  ): Observable<never> {
    const eventUid = amqpMsg.properties.headers?.event_uid || 'unknown';

    if (error instanceof NonRetryableError) {
      this.logger.warn(`NonRetryableError for event ${eventUid}: ${error.message}`);
      this.metricsService.recordEventStatus('sent_to_error_exchange', metadata, routingKey);
      return throwError(error);
    }

    const attemptNumber = this.getCurrentAttemptCount(amqpMsg);
    const maxRetries =
      metadata.options.retry?.count ?? this.configService.get('eventBus.retry.defaultMaxRetries');

    if (attemptNumber > maxRetries) {
      this.logger.warn(`Event ${eventUid} exhausted all ${maxRetries} retry attempts`);
      this.metricsService.recordEventStatus('sent_to_error_exchange', metadata, routingKey);
      throw new NonRetryableError(
        `Retry exhausted after ${maxRetries} attempts: ${error.message}`,
        error,
      );
    }

    this.logger.debug(
      `Scheduling retry for event ${eventUid} (attempt ${attemptNumber}/${maxRetries})`,
    );
    this.metricsService.recordEventStatus('retried', metadata, routingKey);
    throw new RetryError(
      `Retrying event ${eventUid} (attempt ${attemptNumber}/${maxRetries}): ${error.message}`,
      error,
      attemptNumber,
    );
  }

  /**
   * Get the current attempt count for a message
   * @param amqpMsg - The AMQP message
   * @returns The current message attempt count, including the initial attempt
   */
  private getCurrentAttemptCount(amqpMsg: ConsumeMessage): number {
    // RabbitMQ's x-death header: Array tracking each dead-letter event for this message
    // Each entry contains: { queue, reason, time, exchange, routing-keys, count }
    const deadLetterHistory = amqpMsg.properties.headers?.['x-death'] || [];
    if (deadLetterHistory.length === 0) {
      return 1;
    }

    // RabbitMQ's x-first-death-queue header: Name of the first queue that dead-lettered this message
    // In our case, this is the original subscriber queue (before any retries)
    const originalSubscriberQueue = amqpMsg.properties.headers?.['x-first-death-queue'] || '';

    // Find the x-death entry for the original subscriber queue to get its dead-letter count
    // This count represents how many times the original queue failed and dead-lettered the message
    const originalQueueDeathEntry = deadLetterHistory.find(
      (deathEntry: any) => deathEntry.queue === originalSubscriberQueue,
    );
    const originalQueueDeathCount = originalQueueDeathEntry?.count || 0;

    // Return the current attempt number (previous death count + 1)
    return originalQueueDeathCount + 1;
  }
}
