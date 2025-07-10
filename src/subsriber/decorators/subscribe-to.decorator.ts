import { ConsumeMessage } from 'amqplib';
import { InfraLoggerService } from '@vcita/infra-nestjs';
import { ActorEntity, AuthorizationPayloadEntity } from '@vcita/oauth-client-nestjs';
import { plainToActor } from '@vcita/oauth-client-nestjs/dist/oauth/utils/plain-to-class.utils';
import { EventPayload } from '../../interfaces/event.interface';
import {
  SubscribeToOptions,
  EventBusSubscriberMetadata,
} from '../../interfaces/subscription.interface';
import { createEventRetryHandler } from '../../utils/event-retry-handler';
import configuration from '../configuration';
import { EventBusDecoratorUtils } from '../../utils/event-bus-decorator.utils';

/**
 * Thin decorator for subscribing to event bus messages with standardized routing.
 * Expected method signature: (actor: AuthorizationPayloadEntity, event: EventPayload<T>, headers: EventHeaders) => Promise<void>
 *
 * @param options - Configuration options for the subscription
 *
 * @example
 * Basic usage:
 * ```typescript
 * @Injectable()
 * export class MyEventHandler {
 *   private readonly logger = new InfraLoggerService(MyEventHandler.name);
 *
 *   @SubscribeTo({
 *     domain: 'payments',
 *     entity: 'product',
 *     action: 'created',
 *   })
 *   async handleProductCreated(
 *     actor: AuthorizationPayloadEntity,
 *     event: EventPayload<ProductData>,
 *     headers: EventHeaders,
 *   ): Promise<void> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export function SubscribeTo(options: SubscribeToOptions) {
  const logger = new InfraLoggerService(SubscribeTo.name);

  if (process.env.DISABLE_EVENT_BUS === 'true') {
    return EventBusDecoratorUtils.handleDisabledEventBus(logger);
  }

  validateOptions(options);

  const eventBusConfig = buildEventBusConfig();
  const queueConfig = buildQueueConfig(options, eventBusConfig);

  // Use shared utilities
  const { retryQueueOptions, errorQueueOptions, mainQueueOptions } =
    EventBusDecoratorUtils.buildQueueOptions(options, queueConfig);

  EventBusDecoratorUtils.assertRetryInfrastructure(
    logger,
    eventBusConfig,
    queueConfig,
    mainQueueOptions,
    retryQueueOptions,
    errorQueueOptions,
  );

  const errorHandler = createEventRetryHandler(logger, queueConfig);
  const rabbitConfig = EventBusDecoratorUtils.buildRabbitConfig(
    eventBusConfig.exchange,
    queueConfig,
    mainQueueOptions,
    errorHandler,
  );

  return function (targetClass: any, methodName: string, descriptor: PropertyDescriptor) {
    const originalEventHandler = descriptor.value;

    /* eslint-disable-next-line no-param-reassign */
    descriptor.value = async function (
      event: EventPayload<unknown>,
      amqpMsg: ConsumeMessage,
    ): Promise<void> {
      const headers = amqpMsg.properties.headers || {};
      const actor = plainToActor(headers.actor) as ActorEntity;
      const auth = new AuthorizationPayloadEntity(null, actor);

      // All business logic is handled by the interceptor
      return originalEventHandler.call(this, auth, event, headers);
    };

    const metadata: EventBusSubscriberMetadata = {
      eventType: 'standard',
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

function validateOptions(options: SubscribeToOptions): void {
  if (!options.domain || !options.entity || !options.action) {
    throw new Error('SubscribeTo decorator requires domain, entity, and action properties');
  }
}

function buildEventBusConfig() {
  const config = configuration();
  return {
    rabbitmqDsn: config.eventBus.rabbitmqDsn,
    appName: config.eventBus.appName,
    exchange: config.eventBus.exchange,
    defaultMaxRetries: config.eventBus.retry.defaultMaxRetries,
    defaultRetryDelayMs: config.eventBus.retry.defaultRetryDelayMs,
  };
}

function getRoutingKey(domain: string, entity: string, action: string): string {
  return `${domain.toLowerCase()}.${entity.toLowerCase()}.${action.toLowerCase()}`;
}

function buildQueueConfig(
  options: SubscribeToOptions,
  eventBusConfig: {
    appName: string;
    exchange: string;
    defaultMaxRetries: number;
    defaultRetryDelayMs: number;
  },
) {
  const { domain, entity, action, queue, retry } = options;
  const routingKey = getRoutingKey(domain, entity, action);
  const queueName = queue || `${eventBusConfig.appName}.${domain}.${entity}.${action}`;
  return {
    routingKey,
    queueName,
    // Per-subscriber retry infrastructure names
    retryExchangeName: `${queueName}.retry`,
    retryQueueName: `${queueName}.retry`,
    requeueExchangeName: `${queueName}.requeue`,
    // Per-subscriber error infrastructure names
    errorExchangeName: `${queueName}.error`,
    errorQueueName: `${queueName}.error`,
    retryPolicy: {
      maxRetries: retry?.count ?? eventBusConfig.defaultMaxRetries,
      delayMs: retry?.delayMs ?? eventBusConfig.defaultRetryDelayMs,
    },
  };
}
