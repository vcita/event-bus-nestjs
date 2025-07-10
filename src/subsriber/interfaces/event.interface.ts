import { BaseActor } from '@vcita/oauth-client-nestjs/dist/oauth/interfaces/actor.interface';
import { ActorEntity } from '@vcita/oauth-client-nestjs';

// ======= EVENT BUS INTERFACES =======
export interface EventHeaders {
  event_uid: string;
  entity_type: string;
  event_type: string;
  timestamp: string;
  source_service: string;
  trace_id: string;
  actor: BaseActor & Partial<ActorEntity>;
  version: string;
}

export interface EventPayload<T = unknown> {
  data: T;
  schema_ref: string;
}

// Union type for event data - can be structured EventPayload or raw unknown for legacy
export type EventData<T = unknown> = EventPayload<T> | unknown;

export type StringWithWildcard = '*' | '#' | (string & {});
export type ActionWithOptions = 'created' | 'updated' | 'deleted' | StringWithWildcard;
// ======= END EVENT BUS INTERFACES =======

export interface RetryOptions {
  count?: number;
  delayMs?: number;
}

// ======= SUBSCRIBE TO OPTIONS =======
export interface BaseSubscribeToOptions {
  queue?: string;
  queueOptions?: Record<string, any>;
  errorQueueOptions?: Record<string, any>;
  retry?: RetryOptions;
}

export interface SubscribeToOptions extends BaseSubscribeToOptions {
  domain: StringWithWildcard;
  entity: StringWithWildcard;
  action: ActionWithOptions;
}

export interface LegacySubscribeToOptions extends BaseSubscribeToOptions {
  routingKey: string;
}
// ======= END SUBSCRIBE TO OPTIONS =======

export const EVENT_BUS_METADATA_KEY = 'event_bus_metadata';
export type EventBusMetadata =
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
