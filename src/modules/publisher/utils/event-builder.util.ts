import { v4 as uuidv4 } from 'uuid';
import {
  Actor,
  Event,
  EventHeaders,
  EventPayload,
  PublishEventOptions,
} from '../../../interfaces/event.interface';

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
   * Builds event payload with data, optional previous data, and schema reference
   */
  static buildPayload<T>(
    entityType: string,
    data: T,
    prevData?: T,
    version: string = 'v1',
  ): EventPayload<T> {
    const payload: EventPayload<T> = {
      data,
      schema_ref: `${entityType}@${version}`,
    };

    // Include previous data if provided (typically for updated/deleted events)
    if (prevData !== undefined) {
      payload.prev_data = prevData;
    }

    return payload;
  }

  /**
   * Builds complete event structure
   */
  static buildEvent<T>(
    options: PublishEventOptions<T>,
    sourceService: string,
    traceId: string,
  ): Event<T> {
    const { entityType, eventType, data, prevData, actor, version = 'v1' } = options;

    const headers = this.buildHeaders(
      entityType,
      eventType,
      actor,
      sourceService,
      traceId,
      version,
    );

    const payload = this.buildPayload(entityType, data, prevData, version);

    return { headers, payload };
  }

  /**
   * Generates routing key for event
   */
  static buildRoutingKey(domain: string, entityType: string, eventType: string): string {
    return `${domain.toLowerCase()}.${entityType.toLowerCase()}.${eventType.toLowerCase()}`;
  }
}
