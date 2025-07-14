import { Inject, Injectable } from '@nestjs/common';
import { getToken } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { EventBusSubscriberMetadata } from '../../../interfaces/subscription.interface';

export type EventStatus =
  | 'received'
  | 'processed'
  | 'failed'
  | 'retried'
  | 'sent_to_error_exchange'
  | 'duplicate_detected';
export type ValidationFailureType = 'missing_actor' | 'invalid_headers' | 'invalid_payload';

interface ParsedRoutingKey {
  domain: string;
  entity: string;
  action: string;
}

@Injectable()
export class EventBusMetricsService {
  @Inject(getToken('eventbus_events_total'))
  private readonly eventsCounter: Counter<string>;

  @Inject(getToken('eventbus_processing_duration_seconds'))
  private readonly processingDurationHistogram: Histogram<string>;

  @Inject(getToken('eventbus_validation_failures_total'))
  private readonly validationFailuresCounter: Counter<string>;

  recordEventStatus(
    status: EventStatus,
    metadata: EventBusSubscriberMetadata,
    routingKey: string,
  ): void {
    const eventMetadata = EventBusMetricsService.getActualDomainEntityAction(metadata, routingKey);
    const labels = {
      status,
      event_type: metadata.eventType,
      domain: eventMetadata.domain,
      entity: eventMetadata.entity,
      action: eventMetadata.action,
      queue_name: metadata.queueName,
      routing_key: routingKey,
    };

    this.eventsCounter.inc(labels);
  }

  recordValidationFailure(
    failureType: ValidationFailureType,
    metadata: EventBusSubscriberMetadata,
    routingKey: string,
  ): void {
    const eventMetadata = EventBusMetricsService.getActualDomainEntityAction(metadata, routingKey);
    const labels = {
      failure_type: failureType,
      event_type: metadata.eventType,
      domain: eventMetadata.domain,
      entity: eventMetadata.entity,
      action: eventMetadata.action,
      queue_name: metadata.queueName,
      routing_key: routingKey,
    };

    this.validationFailuresCounter.inc(labels);
    this.recordEventStatus('failed', metadata, routingKey);
  }

  /** Returns a function to call when processing completes to record duration */
  startProcessingTimer(metadata: EventBusSubscriberMetadata, routingKey: string): () => void {
    const startTime = Date.now();

    return () => {
      const duration = (Date.now() - startTime) / 1000; // Convert to seconds
      this.recordProcessingDuration(duration, metadata, routingKey);
    };
  }

  private recordProcessingDuration(
    duration: number,
    metadata: EventBusSubscriberMetadata,
    routingKey: string,
  ): void {
    const eventMetadata = EventBusMetricsService.getActualDomainEntityAction(metadata, routingKey);
    const labels = {
      event_type: metadata.eventType,
      domain: eventMetadata.domain,
      entity: eventMetadata.entity,
      action: eventMetadata.action,
      queue_name: metadata.queueName,
      routing_key: routingKey,
    };

    this.processingDurationHistogram.observe(labels, duration);
  }

  private static getActualDomainEntityAction(
    metadata: EventBusSubscriberMetadata,
    routingKey: string,
  ): ParsedRoutingKey {
    if (metadata.eventType === 'standard') {
      const parsed = EventBusMetricsService.parseRoutingKey(routingKey);
      if (parsed) {
        return parsed;
      }

      // Fallback to metadata options if routing key parsing fails
      const { domain, entity, action } = metadata.options;
      return {
        domain: domain ?? 'unknown',
        entity: entity ?? 'unknown',
        action: action ?? 'unknown',
      };
    }
    // Legacy events don't have domain/entity/action - use unknown
    return {
      domain: 'unknown',
      entity: 'unknown',
      action: 'unknown',
    };
  }

  private static parseRoutingKey(routingKey: string): ParsedRoutingKey | null {
    const parts = routingKey.split('.');
    if (parts.length >= 3) {
      const [domain, entity, ...actionParts] = parts;
      return {
        domain,
        entity,
        action: actionParts.join('.'),
      };
    }
    return null;
  }
}
