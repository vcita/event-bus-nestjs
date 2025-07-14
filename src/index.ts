// Main exports
export { SubscriberModule } from './modules/subscriber/subscriber.module';
export { PublisherModule } from './modules/publisher/publisher.module';
export { EventBusPublisher } from './modules/publisher/services/event-bus-publisher.service';

// Interface exports
export {
  EventType,
  Actor,
  EventHeaders,
  EventPayload,
  Event,
  PublishEventOptions,
} from './interfaces/event.interface';
export {
  RetryOptions,
  SubscribeToOptions,
  LegacySubscribeToOptions,
} from './interfaces/subscription.interface';

// Type exports
export { EventBusConfig } from './interfaces/event-bus-config.interface';

// Decorator exports
export { SubscribeTo } from './modules/subscriber/decorators/subscribe-to.decorator';
export { LegacySubscribeTo } from './modules/subscriber/decorators/legacy-subscribe-to.decorator';
