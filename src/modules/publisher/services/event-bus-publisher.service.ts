import { Injectable } from '@nestjs/common';
import { InfraLoggerService } from '@vcita/infra-nestjs';
import { Options } from 'amqplib';
import { PUBLISH_EVENT_TYPES, PublishEventOptions } from '../../../interfaces/event.interface';
import { eventBusConfig } from '../../../configuration';
import { AmqpConnectionService } from './amqp-connection.service';
import { EventBuilder } from '../utils/event-builder.util';
import { TraceUtil } from '../utils/trace.util';

/**
 * Service for publishing events to the event bus
 */
@Injectable()
export class EventBusPublisher<T = unknown> {
  private readonly logger = new InfraLoggerService(EventBusPublisher.name);

  constructor(private readonly amqpConnection: AmqpConnectionService) {}

  /**
   * Publishes an event to the event bus
   *
   * This method publishes events to the configured AMQP exchange using a routing key
   * pattern based on domain, entity type, and event type. The event is automatically
   * enriched with metadata including trace ID, timestamp, and source service information.
   *
   * @param options - Configuration options for the event to be published
   * @param options.entityType - The type of entity the event relates to
   *   (e.g., 'resource', 'user')
   * @param options.eventType - The type of event being published
   *   (e.g., 'created', 'updated', 'deleted')
   * @param options.data - The actual event data/payload to be published
   * @param options.prevData - The previous state of the entity (required for 'updated' events, optional for others)
   * @param options.actor - Information about who/what triggered this event
   * @param options.version - Optional schema version for the event
   *   (defaults to service configuration)
   * @param options.domain - Optional domain override (defaults to service configuration)
   *
   * @returns Promise that resolves when the event has been successfully published
   *
   * @throws {Error} When required options are missing or invalid:
   * - entityType is required and cannot be empty
   * - eventType is required and cannot be empty
   * - data is required (cannot be null or undefined)
   * - actor is required
   *
   * @throws {Error} When AMQP connection or publishing fails
   *
   * @example
   * ```typescript
   * // Publishing an entity (resource entity) created event
   * await eventBusPublisher.publish({
   *   entityType: 'resource',
   *   eventType: 'created',
   *   data: { id: '123', name: 'Meeting Room A', type: 'room' },
   *   actor: auth.actor,
   * });
   *
   * // Publishing an entity (resource entity) updated event with previous state
   * await eventBusPublisher.publish({
   *   entityType: 'resource',
   *   eventType: 'updated',
   *   data: { id: '123', name: 'Meeting Room B', type: 'room' },
   *   prevData: { id: '123', name: 'Meeting Room A', type: 'room' },
   *   actor: auth.actor,
   * });
   */
  async publish(options: PublishEventOptions<T>): Promise<void> {
    const startTime = Date.now();

    try {
      EventBusPublisher.validatePublishOptions(options);

      const traceId = TraceUtil.getOrGenerateTraceId();
      const event = EventBuilder.buildEvent(options, eventBusConfig.appName, traceId);
      const domain = options.domain || eventBusConfig.defaultDomain;
      const routingKey = EventBuilder.buildRoutingKey(
        domain,
        options.entityType,
        options.eventType,
      );

      this.logger.debug(
        `Publishing event ${event.headers.event_uid} to exchange ` +
          `${eventBusConfig.exchange} with routing key ${routingKey}`,
      );

      const channelWrapper = this.amqpConnection.getChannelWrapper();

      const publishOptions: Options.Publish = {
        headers: event.headers,
        persistent: true,
      };

      await channelWrapper.publish(
        eventBusConfig.exchange,
        routingKey,
        event.payload,
        publishOptions,
      );

      const duration = Date.now() - startTime;
      this.logger.debug(`Event published successfully: ${event.headers.event_uid} (${duration}ms)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to publish event: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Validates the publish options and provides guidance for prevData usage
   */
  private static validatePublishOptions(options: PublishEventOptions): void {
    const { entityType, eventType, data, prevData, actor } = options;

    if (!entityType?.trim()) {
      throw new Error('entityType is required and cannot be empty');
    }

    if (!eventType?.trim()) {
      throw new Error('eventType is required and cannot be empty');
    }

    if (!PUBLISH_EVENT_TYPES.includes(eventType)) {
      throw new Error(`eventType is not valid. Must be one of: ${PUBLISH_EVENT_TYPES.join(', ')}`);
    }

    if (data === undefined || data === null) {
      throw new Error('data is required');
    }

    if (!actor) {
      throw new Error('actor is required');
    }

    // Guidance for prevData usage
    if (eventType === 'updated' && (prevData === undefined || prevData === null)) {
      throw new Error('prevData is required');
    }
  }
}
