import { applyDecorators, UseFilters, UseInterceptors, SetMetadata } from '@nestjs/common';
import { RabbitSubscribe, RabbitHandlerConfig } from '@golevelup/nestjs-rabbitmq';
import { ExcludeDtoValidation, UnwrappedResponse, InfraLoggerService } from '@vcita/infra-nestjs';
import { EventBusExceptionFilter } from '../filters/event-bus-exception.filter';
import { assertSubscriberRetryInfrastructure } from './queue-management';
import {
  EventBusSubscriberMetadata,
  EVENT_BUS_SUBSCRIBER_METADATA_KEY,
} from '../interfaces/subscription.interface';
import { EventBusProcessingInterceptor } from '../modules/subscriber/interceptors/event-bus-processing.interceptor';
import { eventBusConfig } from '../configuration';

export class EventBusDecoratorUtils {
  /**
   * Builds queue options for retry, error, and main queues
   */
  static buildQueueOptions(options: any, queueConfig: any) {
    const retryQueueOptions = {
      durable: true,
      arguments: {
        'x-message-ttl': queueConfig.retryPolicy.delayMs,
        'x-dead-letter-exchange': queueConfig.requeueExchangeName,
      },
    };

    const errorQueueOptions = {
      durable: true,
      arguments: {
        'x-message-ttl': 1000 * 60 * 60 * 24 * 30, // 30 days
        ...(options.errorQueueOptions || {}),
      },
    };

    const mainQueueOptions = {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': queueConfig.retryExchangeName,
        ...(options.queueOptions || {}),
      },
    };

    return { retryQueueOptions, errorQueueOptions, mainQueueOptions };
  }

  /**
   * Builds RabbitMQ configuration objects for main subscription
   */
  static buildRabbitConfig(
    exchange: string,
    queueConfig: any,
    mainQueueOptions: any,
    errorHandler: any,
  ): Partial<RabbitHandlerConfig> {
    return {
      exchange,
      routingKey: queueConfig.routingKey,
      queue: queueConfig.queueName,
      queueOptions: mainQueueOptions,
      createQueueIfNotExists: true,
      allowNonJsonMessages: false,
      errorHandler,
    };
  }

  /**
   * Applies common decorators used by both standard and legacy subscribers
   */
  static applyCommonDecorators(
    metadata: EventBusSubscriberMetadata,
    rabbitConfig: Partial<RabbitHandlerConfig>,
  ) {
    return applyDecorators(
      SetMetadata(EVENT_BUS_SUBSCRIBER_METADATA_KEY, metadata),
      RabbitSubscribe(rabbitConfig),
      UseInterceptors(EventBusProcessingInterceptor),
      ExcludeDtoValidation(),
      UnwrappedResponse(),
      UseFilters(EventBusExceptionFilter),
    );
  }

  /**
   * Returns empty decorator when event bus is disabled
   */
  static handleDisabledEventBus(logger: InfraLoggerService) {
    logger.log('Event bus subscriptions disabled');
    return function (targetClass: any, methodName: string, descriptor: PropertyDescriptor) {
      return descriptor;
    };
  }

  /**
   * Wrapper for asserting retry infrastructure setup
   */
  static assertRetryInfrastructure(
    logger: InfraLoggerService,
    queueConfig: any,
    mainQueueOptions: any,
    retryQueueOptions: any,
    errorQueueOptions: any,
  ) {
    return assertSubscriberRetryInfrastructure(
      logger,
      eventBusConfig.rabbitmqDsn,
      queueConfig,
      mainQueueOptions,
      retryQueueOptions,
      errorQueueOptions,
    ).catch(() => {
      // Silently ignore setup failures - logged in utility
    });
  }
}
