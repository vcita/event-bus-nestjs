import { v4 as uuidv4 } from 'uuid';
import {
  Actor,
  Event,
  EventHeaders,
  EventPayload,
  PublishEventOptions,
} from '../interfaces/event.interface';

/**
 * Utility class for building events and routing keys
 */
export class EventBuilder {
  /**
   * Builds event headers with required metadata
   */
  static buildHeaders(
    entityType: string,
    eventType: string,
    actor: Actor,
    sourceService: string,
    traceId: string,
    version: string,
  ): EventHeaders {
    return {
      event_uid: uuidv4(),
      entity_type: entityType,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      source_service: sourceService,
      trace_id: traceId,
      actor,
      version,
    };
  }

  /**
   * Builds event payload with data and schema reference
   */
  static buildPayload<T>(data: T, entityType: string, version: string): EventPayload<T> {
    return {
      data,
      schema_ref: `${entityType}@${version}`,
    };
  }

  /**
   * Builds complete event structure
   */
  static buildEvent<T>(
    options: PublishEventOptions<T>,
    sourceService: string,
    traceId: string,
  ): Event<T> {
    const { entityType, eventType, data, actor, version = 'v1' } = options;

    const headers = this.buildHeaders(
      entityType,
      eventType,
      actor,
      sourceService,
      traceId,
      version,
    );

    const payload = this.buildPayload(data, entityType, version);

    return { headers, payload };
  }

  /**
   * Generates routing key for event
   */
  static buildRoutingKey(domain: string, entityType: string, eventType: string): string {
    return `${domain.toLowerCase()}.${entityType.toLowerCase()}.${eventType.toLowerCase()}`;
  }
}
