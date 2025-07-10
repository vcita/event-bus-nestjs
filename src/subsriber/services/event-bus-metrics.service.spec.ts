import { Test, TestingModule } from '@nestjs/testing';
import { getToken } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { EventBusMetricsService } from './event-bus-metrics.service';

describe('EventBusMetricsService', () => {
  let service: EventBusMetricsService;
  let eventsCounter: Counter<string>;
  let processingDurationHistogram: Histogram<string>;
  let validationFailuresCounter: Counter<string>;

  const mockMetadata = {
    queueName: 'availability.slot.created',
    eventType: 'standard' as const,
    options: {
      domain: 'availability',
      entity: 'slot',
      action: 'created',
    },
  };

  const mockMetadataWithWildcards = {
    queueName: 'availability.*.created',
    eventType: 'standard' as const,
    options: {
      domain: 'availability',
      entity: '*',
      action: 'created',
    },
  };

  beforeEach(async () => {
    // Mock prometheus metrics
    eventsCounter = {
      inc: jest.fn(),
    } as any;

    processingDurationHistogram = {
      observe: jest.fn(),
    } as any;

    validationFailuresCounter = {
      inc: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventBusMetricsService,
        {
          provide: getToken('eventbus_events_total'),
          useValue: eventsCounter,
        },
        {
          provide: getToken('eventbus_processing_duration_seconds'),
          useValue: processingDurationHistogram,
        },
        {
          provide: getToken('eventbus_validation_failures_total'),
          useValue: validationFailuresCounter,
        },
      ],
    }).compile();

    service = module.get<EventBusMetricsService>(EventBusMetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordEventStatus', () => {
    it('should record event status with labels from metadata when routing key cannot be parsed', () => {
      const routingKey = 'availability.slot.created';

      service.recordEventStatus('processed', mockMetadata, routingKey);

      expect(eventsCounter.inc).toHaveBeenCalledWith({
        status: 'processed',
        event_type: 'standard',
        domain: 'availability',
        entity: 'slot',
        action: 'created',
        queue_name: 'availability.slot.created',
        routing_key: 'availability.slot.created',
      });
    });

    it('should extract actual values from routing key instead of wildcarded metadata', () => {
      const routingKey = 'availability.product.updated';

      service.recordEventStatus('processed', mockMetadataWithWildcards, routingKey);

      expect(eventsCounter.inc).toHaveBeenCalledWith({
        status: 'processed',
        event_type: 'standard',
        domain: 'availability',
        entity: 'product',
        action: 'updated',
        queue_name: 'availability.*.created',
        routing_key: 'availability.product.updated',
      });
    });

    it('should handle complex actions with dots in routing key', () => {
      const routingKey = 'availability.slot.status.updated';

      service.recordEventStatus('processed', mockMetadataWithWildcards, routingKey);

      expect(eventsCounter.inc).toHaveBeenCalledWith({
        status: 'processed',
        event_type: 'standard',
        domain: 'availability',
        entity: 'slot',
        action: 'status.updated',
        queue_name: 'availability.*.created',
        routing_key: 'availability.slot.status.updated',
      });
    });

    it('should fallback to metadata when routing key is invalid', () => {
      const invalidRoutingKey = 'invalid.format';

      service.recordEventStatus('processed', mockMetadata, invalidRoutingKey);

      expect(eventsCounter.inc).toHaveBeenCalledWith({
        status: 'processed',
        event_type: 'standard',
        domain: 'availability',
        entity: 'slot',
        action: 'created',
        queue_name: 'availability.slot.created',
        routing_key: 'invalid.format',
      });
    });
  });

  describe('recordValidationFailure', () => {
    it('should record validation failure with labels from metadata when routing key cannot be parsed', () => {
      const failureType = 'missing_actor';
      const routingKey = 'availability.slot.created';

      service.recordValidationFailure(failureType, mockMetadata, routingKey);

      expect(validationFailuresCounter.inc).toHaveBeenCalledWith({
        failure_type: failureType,
        event_type: 'standard',
        domain: 'availability',
        entity: 'slot',
        action: 'created',
        queue_name: 'availability.slot.created',
        routing_key: 'availability.slot.created',
      });
    });

    it('should extract actual values from routing key for validation failures', () => {
      const failureType = 'missing_actor';
      const routingKey = 'availability.product.deleted';

      service.recordValidationFailure(failureType, mockMetadataWithWildcards, routingKey);

      expect(validationFailuresCounter.inc).toHaveBeenCalledWith({
        failure_type: failureType,
        event_type: 'standard',
        domain: 'availability',
        entity: 'product',
        action: 'deleted',
        queue_name: 'availability.*.created',
        routing_key: 'availability.product.deleted',
      });
    });
  });

  describe('startProcessingTimer', () => {
    it('should return a function that records processing duration using metadata when routing key cannot be parsed', () => {
      const routingKey = 'availability.slot.created';

      // Simulate some processing time
      const dateNowSpy = jest
        .spyOn(Date, 'now')
        .mockReturnValueOnce(1000) // Start time
        .mockReturnValueOnce(1100); // End time (100ms later)

      const endTimer = service.startProcessingTimer(mockMetadata, routingKey);
      endTimer();

      expect(processingDurationHistogram.observe).toHaveBeenCalledWith(
        {
          event_type: 'standard',
          domain: 'availability',
          entity: 'slot',
          action: 'created',
          queue_name: 'availability.slot.created',
          routing_key: 'availability.slot.created',
        },
        0.1, // 100ms = 0.1 seconds
      );

      dateNowSpy.mockRestore();
    });

    it('should extract actual values from routing key for processing duration', () => {
      const routingKey = 'availability.booking.confirmed';

      // Simulate some processing time
      const dateNowSpy = jest
        .spyOn(Date, 'now')
        .mockReturnValueOnce(2000) // Start time
        .mockReturnValueOnce(2200); // End time (200ms later)

      const endTimer = service.startProcessingTimer(mockMetadataWithWildcards, routingKey);
      endTimer();

      expect(processingDurationHistogram.observe).toHaveBeenCalledWith(
        {
          event_type: 'standard',
          domain: 'availability',
          entity: 'booking',
          action: 'confirmed',
          queue_name: 'availability.*.created',
          routing_key: 'availability.booking.confirmed',
        },
        0.2, // 200ms = 0.2 seconds
      );

      dateNowSpy.mockRestore();
    });
  });
});
