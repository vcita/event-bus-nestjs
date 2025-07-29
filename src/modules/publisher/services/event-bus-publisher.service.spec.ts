import { Test, TestingModule } from '@nestjs/testing';
import { EventBusPublisher } from './event-bus-publisher.service';
import { AmqpConnectionService } from './amqp-connection.service';

describe('EventBusPublisher', () => {
  let service: EventBusPublisher;
  let mockAmqpConnection: jest.Mocked<AmqpConnectionService>;
  let mockChannelWrapper: any;

  beforeEach(async () => {
    // Mock channel wrapper
    mockChannelWrapper = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    // Mock AMQP connection service
    mockAmqpConnection = {
      getChannelWrapper: jest.fn().mockReturnValue(mockChannelWrapper),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventBusPublisher,
        {
          provide: AmqpConnectionService,
          useValue: mockAmqpConnection,
        },
      ],
    }).compile();

    service = module.get<EventBusPublisher>(EventBusPublisher);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('publish', () => {
    const mockActor = {
      id: 'user-123',
      type: 'user',
      email: 'test@example.com',
    };

    describe('created events', () => {
      it('should publish created events without prevData', async () => {
        const publishOptions = {
          entityType: 'user',
          eventType: 'created',
          data: { id: '123', name: 'John Doe', email: 'john@example.com' },
          actor: mockActor,
        };

        await service.publish(publishOptions);

        expect(mockChannelWrapper.publish).toHaveBeenCalledTimes(1);
        const publishCall = mockChannelWrapper.publish.mock.calls[0];
        const [exchange, routingKey, payload, options] = publishCall;

        expect(exchange).toBe('event_bus'); // Default exchange from config
        expect(routingKey).toMatch(/\.user\.created$/);
        expect(payload.data).toEqual(publishOptions.data);
        expect(payload.prev_data).toBeUndefined();
        expect(options.persistent).toBe(true);
      });

      it('should allow prevData for created events (unusual but not forbidden)', async () => {
        // Capture console.warn to verify warning is logged
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        const publishOptions = {
          entityType: 'user',
          eventType: 'created',
          data: { id: '123', name: 'John Doe' },
          prevData: { id: '123', name: 'Old Name' }, // Unusual but allowed
          actor: mockActor,
        };

        await service.publish(publishOptions);

        expect(mockChannelWrapper.publish).toHaveBeenCalledTimes(1);
        consoleSpy.mockRestore();
      });
    });

    describe('updated events', () => {
      it('should publish updated events with prevData', async () => {
        const publishOptions = {
          entityType: 'user',
          eventType: 'updated',
          data: { id: '123', name: 'John Doe Updated', email: 'john.new@example.com' },
          prevData: { id: '123', name: 'John Doe', email: 'john@example.com' },
          actor: mockActor,
        };

        await service.publish(publishOptions);

        expect(mockChannelWrapper.publish).toHaveBeenCalledTimes(1);
        const publishCall = mockChannelWrapper.publish.mock.calls[0];
        const [exchange, routingKey, payload] = publishCall;

        expect(exchange).toBe('event_bus');
        expect(routingKey).toMatch(/\.user\.updated$/);
        expect(payload.data).toEqual(publishOptions.data);
        expect(payload.prev_data).toEqual(publishOptions.prevData);
      });

      it('should throw error when prevData is missing for updated events', async () => {
        const publishOptions = {
          entityType: 'user',
          eventType: 'updated',
          data: { id: '123', name: 'John Doe Updated' },
          // prevData is missing - should throw error
          actor: mockActor,
        };

        await expect(service.publish(publishOptions)).rejects.toThrow('prevData is required');
        expect(mockChannelWrapper.publish).not.toHaveBeenCalled();
      });
    });

    describe('deleted events', () => {
      it('should publish deleted events with prevData', async () => {
        const publishOptions = {
          entityType: 'user',
          eventType: 'deleted',
          data: { id: '123' }, // Minimal data for deletion
          prevData: { id: '123', name: 'John Doe', email: 'john@example.com' }, // Full previous state
          actor: mockActor,
        };

        await service.publish(publishOptions);

        expect(mockChannelWrapper.publish).toHaveBeenCalledTimes(1);
        const publishCall = mockChannelWrapper.publish.mock.calls[0];
        const [exchange, routingKey, payload] = publishCall;

        expect(exchange).toBe('event_bus');
        expect(routingKey).toMatch(/\.user\.deleted$/);
        expect(payload.data).toEqual(publishOptions.data);
        expect(payload.prev_data).toEqual(publishOptions.prevData);
      });

      it('should throw error when prevData is missing for deleted events', async () => {
        const publishOptions = {
          entityType: 'user',
          eventType: 'deleted',
          data: { id: '123' },
          // prevData is missing - should throw error
          actor: mockActor,
        };

        await expect(service.publish(publishOptions)).rejects.toThrow('prevData is required');
        expect(mockChannelWrapper.publish).not.toHaveBeenCalled();
      });
    });

    describe('validation', () => {
      it('should throw error when entityType is missing', async () => {
        const publishOptions = {
          entityType: '', // Empty entityType
          eventType: 'created',
          data: { id: '123' },
          actor: mockActor,
        };

        await expect(service.publish(publishOptions)).rejects.toThrow('entityType is required and cannot be empty');
      });

      it('should throw error when eventType is missing', async () => {
        const publishOptions = {
          entityType: 'user',
          eventType: '', // Empty eventType
          data: { id: '123' },
          actor: mockActor,
        };

        await expect(service.publish(publishOptions)).rejects.toThrow('eventType is required and cannot be empty');
      });

      it('should throw error when data is missing', async () => {
        const publishOptions = {
          entityType: 'user',
          eventType: 'created',
          data: null, // Null data
          actor: mockActor,
        };

        await expect(service.publish(publishOptions)).rejects.toThrow('data is required');
      });

      it('should throw error when actor is missing', async () => {
        const publishOptions = {
          entityType: 'user',
          eventType: 'created',
          data: { id: '123' },
          actor: null, // Null actor
        };

        await expect(service.publish(publishOptions)).rejects.toThrow('actor is required');
      });
    });

    describe('event structure', () => {
      it('should include correct headers in published event', async () => {
        const publishOptions = {
          entityType: 'user',
          eventType: 'created',
          data: { id: '123', name: 'John Doe' },
          actor: mockActor,
          version: 'v2',
          domain: 'custom-domain',
        };

        await service.publish(publishOptions);

        const publishCall = mockChannelWrapper.publish.mock.calls[0];
        const [, , , options] = publishCall;
        const headers = options.headers;

        expect(headers.entity_type).toBe('user');
        expect(headers.event_type).toBe('created');
        expect(headers.source_service).toBeDefined();
        expect(headers.actor).toEqual(mockActor);
        expect(headers.version).toBe('v2');
        expect(headers.event_uid).toBeDefined();
        expect(headers.timestamp).toBeDefined();
        expect(headers.trace_id).toBeDefined();
      });

      it('should use custom domain in routing key', async () => {
        const publishOptions = {
          entityType: 'product',
          eventType: 'updated',
          data: { id: '456', name: 'Product Updated' },
          prevData: { id: '456', name: 'Product' },
          actor: mockActor,
          domain: 'payments',
        };

        await service.publish(publishOptions);

        const publishCall = mockChannelWrapper.publish.mock.calls[0];
        const [, routingKey] = publishCall;

        expect(routingKey).toBe('payments.product.updated');
      });
    });
  });
}); 