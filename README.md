# @vcita/event-bus-nestjs

A comprehensive NestJS module for publishing and subscribing to standardized events via RabbitMQ/AMQP with built-in tracing, retry mechanisms, and structured event formatting.

## What it does

This package provides a complete event bus solution for your NestJS application with RabbitMQ. It automatically:
- **Publishing**: Structures events with standardized headers (timestamps, trace IDs, actor info)
- **Subscribing**: Handles event consumption with automatic retry logic and error handling
- **AMQP Management**: Handles connection management and queue/exchange setup
- **Distributed Tracing**: Provides built-in tracing support across services
- **Routing**: Uses consistent routing key patterns for event discovery
- **Metrics**: Includes Prometheus metrics for monitoring event processing

## Installation

```bash
npm install @vcita/event-bus-nestjs
```

**Peer Dependencies:**
```bash
npm install @nestjs/common @nestjs/config @nestjs/core @vcita/infra-nestjs @vcita/oauth-client-nestjs
```

## Quick Start

### 1. Configure the module

**Option A: Direct Import (Recommended)**
```typescript
// app.module.ts
import { EventBusModule } from '@vcita/event-bus-nestjs';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [() => ({
        eventBus: {
          rabbitmqDsn: process.env.RABBITMQ_DSN,
          appName: process.env.APP_NAME,
          exchange: process.env.EVENT_BUS_EXCHANGE_NAME || 'event_bus',
          defaultDomain: process.env.EVENT_BUS_DEFAULT_DOMAIN || 'scheduling',
          legacy: {
            exchange: process.env.EVENT_BUS_LEGACY_EXCHANGE || 'legacy_events',
          },
          retry: {
            defaultMaxRetries: parseInt(process.env.EVENT_BUS_DEFAULT_MAX_RETRIES || '3'),
            defaultRetryDelayMs: parseInt(process.env.EVENT_BUS_DEFAULT_RETRY_DELAY_MS || '5000'),
          },
        },
      })],
    }),
    EventBusModule,
  ],
})
export class AppModule {}
```

**Option B: Direct Configuration**
```typescript
EventBusModule.forRoot({
  rabbitmqDsn: 'amqp://localhost:5672',
  appName: 'my-service',
  exchange: 'event_bus',
  defaultDomain: 'my-domain',
  legacy: {
    exchange: 'legacy_events',
  },
  retry: {
    defaultMaxRetries: 3,
    defaultRetryDelayMs: 5000,
  },
})
```

### 2. Publish events

```typescript
import { EventBusPublisher } from '@vcita/event-bus-nestjs';

@Injectable()
export class MyService {
  constructor(private readonly eventBusPublisher: EventBusPublisher) {}

  async createUser(userData: any, actor: any) {
    const user = await this.saveUser(userData);

    await this.eventBusPublisher.publish({
      entityType: 'user',
      eventType: 'created',
      data: user,
      actor: actor,
    });

    return user;
  }
}
```

## Event Subscription

The EventBusModule also includes a subscriber system for consuming events from RabbitMQ. The subscriber module is automatically imported when you import `EventBusModule`.

### 1. Create a subscriber

```typescript
import { Injectable } from '@nestjs/common';
import { AuthorizationPayloadEntity } from '@vcita/oauth-client-nestjs';
import { InfraLoggerService } from '@vcita/infra-nestjs';
import { SubscribeTo, LegacySubscribeTo } from '@vcita/event-bus-nestjs';
import { EventHeaders, EventPayload } from '@vcita/event-bus-nestjs';

@Injectable()
export class ProductSubscriber {
  private readonly logger = new InfraLoggerService(ProductSubscriber.name);

  @SubscribeTo({
    domain: 'payments',
    entity: 'product',
    action: 'created',
    queue: 'my-service-product-queue', // Optional: custom queue name
  })
  async handleProductCreated(
    auth: AuthorizationPayloadEntity,
    event: EventPayload<ProductData>,
    headers: EventHeaders,
  ): Promise<void> {
    this.logger.log(
      `Processing product created event: ${headers.event_uid} for product ${event.data.id}`,
    );

    // Your business logic here
    await this.processProductCreated(event.data, auth.actor);

    this.logger.log(`Successfully processed product event: ${headers.event_uid}`);
  }

  @SubscribeTo({
    domain: 'payments',
    entity: 'product',
    action: '*', // Listen to all product events
    retry: { count: 3, delayMs: 5000 }, // Custom retry policy
  })
  async handleAllProductEvents(
    auth: AuthorizationPayloadEntity,
    event: EventPayload<any>,
    headers: EventHeaders,
  ): Promise<void> {
    this.logger.log(`Processing product event: ${headers.event_type}`);
    // Handle any product event
  }

  @LegacySubscribeTo({
    routingKey: 'legacy.product.*',
    retry: { count: 1, delayMs: 10000 },
  })
  async handleLegacyProductEvent(payload: unknown, headers: any): Promise<void> {
    this.logger.log(`Processing legacy product event: ${JSON.stringify(payload)}`);
    // Handle legacy events without structured format
  }
}
```

### 2. Register the subscriber

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { EventBusModule } from '@vcita/event-bus-nestjs';
import { ProductSubscriber } from './subscribers/product.subscriber';

@Module({
  imports: [EventBusModule], // Subscriber module is included automatically
  providers: [ProductSubscriber],
})
export class AppModule {}
```

### 3. Subscriber decorators

#### `@SubscribeTo` - Modern event subscription

For standardized events with domain/entity/action structure:

```typescript
@SubscribeTo({
  domain: string | '*',      // Event domain (e.g., 'payments', 'scheduling')
  entity: string | '*',      // Entity type (e.g., 'product', 'user')
  action: string | '*',      // Action type (e.g., 'created', 'updated', 'deleted')
  queue?: string,            // Optional: custom queue name
  retry?: {                  // Optional: retry configuration
    count: number,           // Max retry attempts
    delayMs: number,         // Delay between retries
  },
  queueOptions?: object,     // Optional: additional queue options
  errorQueueOptions?: object, // Optional: error queue options
})
```

**Method signature:**
```typescript
async methodName(
  auth: AuthorizationPayloadEntity,  // Actor context with authentication
  event: EventPayload<T>,           // Structured event data
  headers: EventHeaders,            // Event metadata
): Promise<void>
```

#### `@LegacySubscribeTo` - Legacy event subscription  

For legacy events without structured format:

```typescript
@LegacySubscribeTo({
  routingKey: string,        // RabbitMQ routing key pattern
  queue?: string,            // Optional: custom queue name
  retry?: {                  // Optional: retry configuration
    count: number,           // Max retry attempts
    delayMs: number,         // Delay between retries
  },
  queueOptions?: object,     // Optional: additional queue options
  errorQueueOptions?: object, // Optional: error queue options
})
```

**Method signature:**
```typescript
async methodName(
  payload: unknown,          // Raw event payload
  headers: any,             // Raw AMQP headers
): Promise<void>
```

### 4. Error handling

The subscriber system includes automatic error handling and retry logic:

```typescript
import { NonRetryableError } from '@vcita/event-bus-nestjs';

@SubscribeTo({
  domain: 'payments',
  entity: 'product',
  action: 'created',
  retry: { count: 3, delayMs: 5000 },
})
async handleProductCreated(
  auth: AuthorizationPayloadEntity,
  event: EventPayload<ProductData>,
  headers: EventHeaders,
): Promise<void> {
  try {
    // Your business logic
    await this.processProduct(event.data);
  } catch (error) {
    if (error instanceof ValidationError) {
      // Don't retry validation errors
      throw new NonRetryableError(error.message);
    }
    // Other errors will be retried according to retry policy
    throw error;
  }
}
```

## Configuration Options

### Publisher Configuration

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `rabbitmqDsn` | ✅ | RabbitMQ connection string | - |
| `appName` | ✅ | Name of your service | - |
| `exchange` | ✅ | RabbitMQ exchange name | - |
| `defaultDomain` | ✅ | Default domain for routing keys | - |

### Subscriber Configuration

The subscriber module uses the same configuration as the publisher, plus additional options:

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `appName` | ✅ | Application name for queue naming | - |
| `exchange` | ✅ | Main exchange for standard events | - |
| `legacy.exchange` | ✅ | Exchange for legacy events | - |
| `retry.defaultMaxRetries` | ❌ | Default retry count | 3 |
| `retry.defaultRetryDelayMs` | ❌ | Default retry delay | 5000 |

### Full Configuration Example

```typescript
// config/configuration.ts
export default () => ({
  eventBus: {
    rabbitmqDsn: process.env.RABBITMQ_DSN,
    appName: process.env.APP_NAME,
    exchange: process.env.EVENT_BUS_EXCHANGE_NAME || 'event_bus',
    defaultDomain: process.env.EVENT_BUS_DEFAULT_DOMAIN || 'scheduling',
    legacy: {
      exchange: process.env.EVENT_BUS_LEGACY_EXCHANGE || 'legacy_events',
    },
    retry: {
      defaultMaxRetries: parseInt(process.env.EVENT_BUS_DEFAULT_MAX_RETRIES || '3'),
      defaultRetryDelayMs: parseInt(process.env.EVENT_BUS_DEFAULT_RETRY_DELAY_MS || '5000'),
    },
  },
});
```

## Event Structure

Published events follow this structure:

```typescript
{
  headers: {
    event_uid: string,        // Unique event ID
    entity_type: string,      // e.g., 'user', 'resource'
    event_type: string,       // e.g., 'created', 'updated', 'deleted'
    timestamp: string,        // ISO timestamp
    source_service: string,   // Your service name
    trace_id: string,         // Distributed tracing ID
    actor: Actor,             // Who triggered the event
    version: string,          // Schema version (default: 'v1')
  },
  payload: {
    data: T,                  // Your event data
    schema_ref: string,       // Schema reference
  }
}
```

**Routing Key Pattern:** `{domain}.{entityType}.{eventType}`  
Example: `scheduling.user.created`

## Publishing Options

```typescript
interface PublishEventOptions<T = unknown> {
  entityType: string;        // Entity type (e.g., 'user', 'resource')
  eventType: EventType;      // Event type (e.g., 'created', 'updated', 'deleted')
  data: T;                   // Event payload
  actor: Actor;              // Actor information
  version?: string;          // Schema version (optional, default: 'v1')
  domain?: string;           // Domain override (optional)
}
```

## Testing

In test environment (`NODE_ENV=test`), AMQP connections are automatically mocked. You can simply import the EventBusModule without any configuration:

```typescript
// my.service.spec.ts
import { Test } from '@nestjs/testing';
import { EventBusModule, EventBusPublisher } from '@vcita/event-bus-nestjs';

describe('MyService', () => {
  let eventBusPublisher: EventBusPublisher;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [EventBusModule],
      providers: [MyService],
    }).compile();

    eventBusPublisher = module.get<EventBusPublisher>(EventBusPublisher);
  });

  it('should publish events', async () => {
    // The publish method is automatically mocked
    await eventBusPublisher.publish({
      entityType: 'user',
      eventType: 'created',
      data: { id: '123' },
      actor: { id: 'user-1', type: 'user' },
    });

    // Verify the event was published (mock implementation)
    expect(eventBusPublisher.publish).toHaveBeenCalled();
  });
});
```

## Environment Variables

When using ConfigService:

### Publisher & Subscriber Variables
- `RABBITMQ_DSN` - RabbitMQ connection string
- `APP_NAME` - Your service name (used for both source service and queue naming)
- `EVENT_BUS_EXCHANGE_NAME` - Exchange name (default: 'event_bus')
- `EVENT_BUS_DEFAULT_DOMAIN` - Default domain (default: 'scheduling')

### Subscriber-Specific Variables
- `EVENT_BUS_LEGACY_EXCHANGE` - Legacy events exchange (default: 'legacy_events')
- `EVENT_BUS_DEFAULT_MAX_RETRIES` - Default retry count (default: 3)
- `EVENT_BUS_DEFAULT_RETRY_DELAY_MS` - Default retry delay in milliseconds (default: 5000)
- `DISABLE_EVENT_BUS` - Set to 'true' to disable event bus functionality (useful for testing)

## License

ISC 