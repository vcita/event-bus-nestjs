// Main exports
export { EventBusModule } from './event-bus.module';
export { EVENT_BUS_CONFIG } from './constants';
export { EventBusPublisher } from './services/event-bus-publisher.service';

// Interface exports
export {
  EventType,
  Actor,
  EventHeaders,
  EventPayload,
  Event,
  PublishEventOptions,
} from './interfaces/event.interface';

// Type exports
export { EventBusConfig } from './interfaces/event-bus-config.interface';
