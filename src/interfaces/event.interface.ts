import { BaseActor } from '@vcita/oauth-client-nestjs/dist/oauth/interfaces/actor.interface';
import { ActorEntity } from '@vcita/oauth-client-nestjs';

export type Actor = BaseActor & Partial<ActorEntity>;

/**
 * Standard event headers as per event bus specification
 */
export interface EventHeaders {
  event_uid: string;
  entity_type: string;
  event_type: string;
  timestamp: string;
  source_service: string;
  trace_id: string;
  actor: Actor;
  version: string;
}

/**
 * Event payload wrapper
 */
export interface EventPayload<T = unknown> {
  data: T;
  schema_ref: string;
}

/**
 * Complete event structure for publishing
 */
export interface Event<T = unknown> {
  headers: EventHeaders;
  payload: EventPayload<T>;
}

export type EventType = 'created' | 'updated' | 'deleted' | string;

/**
 * Options for publishing events
 */
export interface PublishEventOptions<T = unknown> {
  entityType: string;
  eventType: EventType;
  data: T;
  actor: Actor;
  version?: string;
  domain?: string;
}
