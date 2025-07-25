import { ConsumeMessage } from 'amqplib';
import { InfraLoggerService } from '@vcita/infra-nestjs';
import {
  LegacySubscribeToOptions,
  EventBusSubscriberMetadata,
} from '../../../interfaces/subscription.interface';
import { createEventRetryHandler } from '../../../utils/event-retry-handler';
import { eventBusConfig } from '../../../configuration';
import { EventBusDecoratorUtils } from '../../../utils/event-bus-decorator.utils';

/**
 * Decorator for subscribing to legacy event bus messages without domain/entity/action classification.
 * Expected method signature: (payload: unknown, headers: any) => Promise<void>
 *
 * @param options - Configuration options for the legacy subscription
 *
 * @example
 * Basic usage:
 * ```typescript
 * @Injectable()
 * export class LegacyOrderProcessor {
 *   private readonly logger = new InfraLoggerService(LegacyOrderProcessor.name);
 *
 *   @LegacySubscribeTo({
 *     routingKey: 'legacy.orders.*',
 *     retry: { count: 1, delayMs: 10000 }
 *   })
 *   async handleLegacyOrder(payload: unknown, headers: any): Promise<void> {
 *     this.logger.log(`Processing legacy order: ${JSON.stringify(payload)}`);
 *   }
 * }
 * ```
 */
export function LegacySubscribeTo(options: LegacySubscribeToOptions) {
  const logger = new InfraLoggerService(LegacySubscribeTo.name);

  if (process.env.DISABLE_EVENT_BUS === 'true') {
    return EventBusDecoratorUtils.handleDisabledEventBus(logger);
  }

  validateLegacyOptions(options);

  const queueConfig = buildLegacyQueueConfig(options);

  // Use shared utilities
  const { retryQueueOptions, errorQueueOptions, mainQueueOptions } =
    EventBusDecoratorUtils.buildQueueOptions(options, queueConfig);

  EventBusDecoratorUtils.assertRetryInfrastructure(
    logger,
    queueConfig,
    mainQueueOptions,
    retryQueueOptions,
    errorQueueOptions,
  );

  const errorHandler = createEventRetryHandler(logger, queueConfig);
  const rabbitConfig = EventBusDecoratorUtils.buildRabbitConfig(
    eventBusConfig.legacy.exchange,
    queueConfig,
    mainQueueOptions,
    errorHandler,
  );

  return function (targetClass: any, methodName: string, descriptor: PropertyDescriptor) {
    const originalEventHandler = descriptor.value;

    /* eslint-disable-next-line no-param-reassign */
    descriptor.value = async function (payload: unknown, amqpMsg: ConsumeMessage): Promise<void> {
      const headers = amqpMsg.properties.headers || {};
      return originalEventHandler.call(this, payload, headers);
    };

    const metadata: EventBusSubscriberMetadata = {
      eventType: 'legacy',
      queueName: queueConfig.queueName,
      options,
    };

    return EventBusDecoratorUtils.applyCommonDecorators(metadata, rabbitConfig)(
      targetClass,
      methodName,
      descriptor,
    );
  };
}

function validateLegacyOptions(options: LegacySubscribeToOptions): void {
  if (!options.routingKey) {
    throw new Error('LegacySubscribeTo decorator requires routingKey property');
  }
}

function buildLegacyQueueConfig(options: LegacySubscribeToOptions) {
  const queueName = options.queue || `legacy.${eventBusConfig.appName}.${options.routingKey}`;

  return {
    routingKey: options.routingKey,
    queueName,
    // Per-subscriber retry infrastructure names
    retryExchangeName: `${queueName}.retry`,
    retryQueueName: `${queueName}.retry`,
    requeueExchangeName: `${queueName}.requeue`,
    // Per-subscriber error infrastructure names
    errorExchangeName: `${queueName}.error`,
    errorQueueName: `${queueName}.error`,
    retryPolicy: {
      maxRetries: options.retry?.count ?? eventBusConfig.retry?.defaultMaxRetries,
      delayMs: options.retry?.delayMs ?? eventBusConfig.retry?.defaultRetryDelayMs,
    },
  };
}
