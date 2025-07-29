import { EventBuilder } from './event-builder.util';
import { PublishEventOptions } from '../../../interfaces/event.interface';
import { ActorType } from '@vcita/oauth-client-nestjs/dist/oauth/enums';

describe('EventBuilder', () => {
  const mockActor = {
    uid: 'user-123',
    id: 'user-123',
    type: ActorType.USER,
    email: 'test@example.com',
  };

  describe('buildPayload', () => {
    it('should build payload without prevData', () => {
      const data = { id: '123', name: 'Test Entity' };
      const entityType = 'user';
      const version = 'v1';

      const payload = EventBuilder.buildPayload(entityType, data, undefined, version);

      expect(payload).toEqual({
        data,
        schema_ref: 'user@v1',
      });
      expect(payload.prev_data).toBeUndefined();
    });

    it('should build payload with prevData', () => {
      const data = { id: '123', name: 'Updated Entity' };
      const prevData = { id: '123', name: 'Original Entity' };
      const entityType = 'user';
      const version = 'v2';

      const payload = EventBuilder.buildPayload(entityType, data, prevData, version);

      expect(payload).toEqual({
        data,
        prev_data: prevData,
        schema_ref: 'user@v2',
      });
    });

    it('should use default version when not provided', () => {
      const data = { id: '123', name: 'Test Entity' };
      const entityType = 'product';

      const payload = EventBuilder.buildPayload(entityType, data);

      expect(payload.schema_ref).toBe('product@v1');
    });

    it('should handle complex data structures', () => {
      const complexData = {
        id: '123',
        metadata: {
          tags: ['tag1', 'tag2'],
          settings: { enabled: true, count: 5 },
        },
        items: [{ name: 'item1' }, { name: 'item2' }],
      };
      const complexPrevData = {
        id: '123',
        metadata: {
          tags: ['tag1'],
          settings: { enabled: false, count: 3 },
        },
        items: [{ name: 'item1' }],
      };

      const payload = EventBuilder.buildPayload(
        'complex-entity',
        complexData,
        complexPrevData,
        'v1'
      );

      expect(payload.data).toEqual(complexData);
      expect(payload.prev_data).toEqual(complexPrevData);
      expect(payload.schema_ref).toBe('complex-entity@v1');
    });
  });

  describe('buildEvent', () => {
    it('should build event for created type without prevData', () => {
      const options: PublishEventOptions = {
        entityType: 'user',
        eventType: 'created',
        data: { id: '123', name: 'John Doe' },
        actor: mockActor,
      };

      const event = EventBuilder.buildEvent(options, 'test-service', 'trace-123');

      expect(event.headers.entity_type).toBe('user');
      expect(event.headers.event_type).toBe('created');
      expect(event.headers.source_service).toBe('test-service');
      expect(event.headers.trace_id).toBe('trace-123');
      expect(event.headers.actor).toEqual(mockActor);
      expect(event.headers.version).toBe('v1'); // Default version

      expect(event.payload.data).toEqual(options.data);
      expect(event.payload.prev_data).toBeUndefined();
      expect(event.payload.schema_ref).toBe('user@v1');
    });

    it('should build event for updated type with prevData', () => {
      const options: PublishEventOptions = {
        entityType: 'user',
        eventType: 'updated',
        data: { id: '123', name: 'John Doe Updated', email: 'john.new@example.com' },
        prevData: { id: '123', name: 'John Doe', email: 'john@example.com' },
        actor: mockActor,
        version: 'v2',
      };

      const event = EventBuilder.buildEvent(options, 'test-service', 'trace-456');

      expect(event.headers.entity_type).toBe('user');
      expect(event.headers.event_type).toBe('updated');
      expect(event.headers.source_service).toBe('test-service');
      expect(event.headers.trace_id).toBe('trace-456');
      expect(event.headers.actor).toEqual(mockActor);
      expect(event.headers.version).toBe('v2');

      expect(event.payload.data).toEqual(options.data);
      expect(event.payload.prev_data).toEqual(options.prevData);
      expect(event.payload.schema_ref).toBe('user@v2');
    });

    it('should build event for deleted type with prevData', () => {
      const options: PublishEventOptions = {
        entityType: 'product',
        eventType: 'deleted',
        data: { id: '456' }, // Minimal data for deletion
        prevData: { id: '456', name: 'Product Name', price: 99.99 },
        actor: mockActor,
      };

      const event = EventBuilder.buildEvent(options, 'product-service', 'trace-789');

      expect(event.headers.entity_type).toBe('product');
      expect(event.headers.event_type).toBe('deleted');
      expect(event.headers.source_service).toBe('product-service');
      expect(event.headers.trace_id).toBe('trace-789');

      expect(event.payload.data).toEqual(options.data);
      expect(event.payload.prev_data).toEqual(options.prevData);
      expect(event.payload.schema_ref).toBe('product@v1');
    });

    it('should generate unique event UIDs', () => {
      const options: PublishEventOptions = {
        entityType: 'user',
        eventType: 'created',
        data: { id: '123' },
        actor: mockActor,
      };

      const event1 = EventBuilder.buildEvent(options, 'test-service', 'trace-1');
      const event2 = EventBuilder.buildEvent(options, 'test-service', 'trace-2');

      expect(event1.headers.event_uid).toBeDefined();
      expect(event2.headers.event_uid).toBeDefined();
      expect(event1.headers.event_uid).not.toBe(event2.headers.event_uid);
    });

    it('should generate ISO timestamp', () => {
      const options: PublishEventOptions = {
        entityType: 'user',
        eventType: 'created',
        data: { id: '123' },
        actor: mockActor,
      };

      const event = EventBuilder.buildEvent(options, 'test-service', 'trace-123');

      expect(event.headers.timestamp).toBeDefined();
      expect(new Date(event.headers.timestamp).getTime()).toBeGreaterThan(0);
      
      // Should be a valid ISO string
      expect(() => new Date(event.headers.timestamp).toISOString()).not.toThrow();
    });
  });

  describe('buildRoutingKey', () => {
    it('should build routing key in lowercase', () => {
      const routingKey = EventBuilder.buildRoutingKey('PAYMENTS', 'USER', 'CREATED');
      expect(routingKey).toBe('payments.user.created');
    });

    it('should handle mixed case inputs', () => {
      const routingKey = EventBuilder.buildRoutingKey('Scheduling', 'ResourceType', 'Updated');
      expect(routingKey).toBe('scheduling.resourcetype.updated');
    });

    it('should build routing key for different domains', () => {
      expect(EventBuilder.buildRoutingKey('billing', 'subscription', 'expired'))
        .toBe('billing.subscription.expired');
      expect(EventBuilder.buildRoutingKey('inventory', 'product', 'stock-updated'))
        .toBe('inventory.product.stock-updated');
    });
  });

  describe('buildHeaders', () => {
    it('should build headers with all required fields', () => {
      const headers = EventBuilder.buildHeaders(
        'user',
        'created',
        mockActor,
        'test-service',
        'trace-123',
        'v1'
      );

      expect(headers).toMatchObject({
        entity_type: 'user',
        event_type: 'created',
        source_service: 'test-service',
        trace_id: 'trace-123',
        actor: mockActor,
        version: 'v1',
      });

      expect(headers.event_uid).toBeDefined();
      expect(headers.timestamp).toBeDefined();
      expect(typeof headers.event_uid).toBe('string');
      expect(typeof headers.timestamp).toBe('string');
    });
  });
}); 