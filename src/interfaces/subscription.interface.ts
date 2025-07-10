import { EventPayload, EventType } from './event.interface';

export interface RetryOptions {
  count?: number;
  delayMs?: number;
}

export interface BaseSubscribeToOptions {
  queue?: string;
  queueOptions?: Record<string, any>;
  errorQueueOptions?: Record<string, any>;
  retry?: RetryOptions;
}

export type StringWithWildcard = '*' | '#' | (string & {});

export interface SubscribeToOptions extends BaseSubscribeToOptions {
  domain: StringWithWildcard;
  entity: StringWithWildcard;
  action: EventType;
}

export interface LegacySubscribeToOptions extends BaseSubscribeToOptions {
  routingKey: string;
}

export const EVENT_BUS_SUBSCRIBER_METADATA_KEY = 'event_bus_subscriber_metadata';

export type EventBusSubscriberMetadata =
  | {
      queueName: string;
      eventType: 'standard';
      options: SubscribeToOptions;
    }
  | {
      queueName: string;
      eventType: 'legacy';
      options: LegacySubscribeToOptions;
    };

/**
 * Union type for event data - can be structured EventPayload or raw unknown for legacy
 */
export type EventData<T = unknown> = EventPayload<T> | unknown;
