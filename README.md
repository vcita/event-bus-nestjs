# @vcita/event-bus-nestjs

A comprehensive NestJS module for publishing and subscribing to standardized events via RabbitMQ/AMQP with built-in tracing, retry mechanisms, and structured event formatting.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Publishing Events](#publishing-events)
- [Subscribing to Events](#subscribing-to-events)
- [Event Structure](#event-structure)
- [Error Handling & Retries](#error-handling--retries)
- [Testing](#testing)
- [Environment Variables](#environment-variables)
- [Advanced Usage](#advanced-usage)
- [API Reference](#api-reference)

## Features

✅ **Standardized Event Publishing**: Automatically structures events with headers (timestamps, trace IDs, actor info)  
✅ **Flexible Event Subscription**: Subscribe to events using decorators with pattern matching  
✅ **AMQP Connection Management**: Handles RabbitMQ connections, queues, and exchanges automatically  
✅ **Distributed Tracing**: Built-in support for tracing across services  
✅ **Retry Mechanisms**: Configurable retry logic with exponential backoff  
✅ **Error Handling**: Comprehensive error handling with dead letter queues  
✅ **Legacy Support**: Backward compatibility with legacy event formats  
✅ **Testing Support**: Automatic mocking in test environments  
✅ **Metrics Integration**: Prometheus metrics for monitoring (via @vcita/infra-nestjs)  

## Installation

```bash
npm install @vcita/event-bus-nestjs
```

**Required Peer Dependencies:**
```bash
npm install @nestjs/common @nestjs/core @vcita/infra-nestjs @vcita/oauth-client-nestjs
```

## Quick Start

### 1. Import the Module

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { EventBusModule } from '@vcita/event-bus-nestjs';

@Module({
  imports: [
    EventBusModule,
  ],
})
export class AppModule {}
```

### 2. Publish an Event

```typescript
// my.service.ts
import { Injectable } from '@nestjs/common';
import { EventBusPublisher } from '@vcita/event-bus-nestjs';

@Injectable()
export class UserService {
  constructor(private readonly eventBusPublisher: EventBusPublisher) {}

  async createUser(userData: any, actor: any) {
    const user = await this.saveUser(userData);

    // Publish event - routing key will be: scheduling.user.created
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

### 3. Subscribe to Events

```typescript
// user.subscriber.ts
import { Injectable } from '@nestjs/common';
import { AuthorizationPayloadEntity } from '@vcita/oauth-client-nestjs';
import { InfraLoggerService } from '@vcita/infra-nestjs';
import { SubscribeTo, EventPayload, EventHeaders } from '@vcita/event-bus-nestjs';

@Injectable()
export class UserSubscriber {
  private readonly logger = new InfraLoggerService(UserSubscriber.name);

  @SubscribeTo({
    domain: 'scheduling',
    entity: 'user',
    action: 'created',
  })
  async handleUserCreated(
    auth: AuthorizationPayloadEntity,
    event: EventPayload<{ id: string; email: string }>,
    headers: EventHeaders,
  ): Promise<void> {
    this.logger.log(`User created: ${event.data.id} by ${auth.actor.id}`);
    // Your business logic here
  }
}
```

Don't forget to register your subscriber in your module:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { EventBusModule } from '@vcita/event-bus-nestjs';
import { UserSubscriber } from './user.subscriber';

@Module({
  imports: [EventBusModule],
  providers: [UserSubscriber], // Add your subscribers here
})
export class AppModule {}
```

## Configuration

The module uses environment variables for configuration. The configuration is automatically loaded from the environment variables when the module is imported.

### Configuration Options

The module reads configuration from the following environment variables:

| Environment Variable | Type | Required | Description | Default |
|---------------------|------|----------|-------------|---------|
| `RABBITMQ_DSN` | string | ✅ | RabbitMQ connection string | - |
| `APP_NAME` | string | ✅ | Your service name (used for queues and source service) | - |
| `EVENT_BUS_EXCHANGE_NAME` | string | ❌ | RabbitMQ exchange name for standard events | `event_bus` |
| `EVENT_BUS_DEFAULT_DOMAIN` | string | ❌ | Default domain for routing keys | `default` |
| `EVENT_BUS_LEGACY_EXCHANGE` | string | ❌ | Exchange name for legacy events | `vcita.model_updates` |
| `EVENT_BUS_DEFAULT_MAX_RETRIES` | number | ❌ | Default retry count | `1` |
| `EVENT_BUS_DEFAULT_RETRY_DELAY_MS` | number | ❌ | Default retry delay in milliseconds | `10000` |

### Example Configuration

Set these environment variables in your `.env` file or deployment environment:

```bash
# Required
RABBITMQ_DSN=amqp://username:password@localhost:5672
APP_NAME=my-service

# Optional
EVENT_BUS_EXCHANGE_NAME=event_bus
EVENT_BUS_DEFAULT_DOMAIN=scheduling
EVENT_BUS_LEGACY_EXCHANGE=vcita.model_updates
EVENT_BUS_DEFAULT_MAX_RETRIES=1
EVENT_BUS_DEFAULT_RETRY_DELAY_MS=10000
```

## Publishing Events

### Basic Publishing

```typescript
import { EventBusPublisher } from '@vcita/event-bus-nestjs';

@Injectable()
export class MyService {
  constructor(private readonly eventBusPublisher: EventBusPublisher) {}

  async publishEvent() {
    await this.eventBusPublisher.publish({
      entityType: 'resource',      // Required: Entity type
      eventType: 'created',        // Required: Event type
      data: { id: '123', name: 'Resource Name' }, // Required: Event data
      actor: { id: 'user-1', type: 'user' },      // Required: Actor who triggered the event
      version: 'v2',               // Optional: Schema version (default: 'v1')
      domain: 'payments',          // Optional: Domain override (default: from config)
    });
  }
}
```

### Event Types

Common event types include:
- `created` - Entity was created
- `updated` - Entity was updated
- `deleted` - Entity was deleted

You can also use custom event types as needed.

### Actor Information

The `actor` field describes who or what triggered the event:

```typescript
// User-triggered event
actor: {
  id: 'user-123',
  type: 'user',
  email: 'user@example.com',
  name: 'John Doe'
}

// System-triggered event
actor: {
  id: 'system',
  type: 'system',
  name: 'Automated Process'
}
```

## Subscribing to Events

### Standard Event Subscription

Use the `@SubscribeTo` decorator for structured events:

```typescript
import { SubscribeTo } from '@vcita/event-bus-nestjs';

@Injectable()
export class MySubscriber {
  @SubscribeTo({
    domain: 'payments',           // Domain to listen to
    entity: 'product',            // Entity type to listen to
    action: 'created',            // Action to listen to
    queue: 'my-custom-queue',     // Optional: custom queue name
    retry: {                      // Optional: retry configuration
      count: 5,
      delayMs: 10000
    }
  })
  async handleProductCreated(
    auth: AuthorizationPayloadEntity,  // Authentication context
    event: EventPayload<ProductData>,  // Event data
    headers: EventHeaders,             // Event metadata
  ): Promise<void> {
    // Your business logic here
  }
}
```

### Wildcard Subscriptions

You can use wildcards to subscribe to multiple events:

```typescript
@Injectable()
export class ProductSubscriber {
  // Listen to all product events
  @SubscribeTo({
    domain: 'payments',
    entity: 'product',
    action: '*',
  })
  async handleAllProductEvents(
    auth: AuthorizationPayloadEntity,
    event: EventPayload<any>,
    headers: EventHeaders,
  ): Promise<void> {
    this.logger.log(`Product event: ${headers.event_type}`);
  }

  // Listen to all entities in payments domain
  @SubscribeTo({
    domain: 'payments',
    entity: '*',
    action: 'created',
  })
  async handleAllPaymentCreations(
    auth: AuthorizationPayloadEntity,
    event: EventPayload<any>,
    headers: EventHeaders,
  ): Promise<void> {
    this.logger.log(`Created in payments: ${headers.entity_type}`);
  }
}
```

### Legacy Event Subscription

For backward compatibility with legacy events:

```typescript
import { LegacySubscribeTo } from '@vcita/event-bus-nestjs';

@Injectable()
export class LegacySubscriber {
  @LegacySubscribeTo({
    routingKey: 'legacy.orders.*',    // RabbitMQ routing key pattern
    retry: { count: 1, delayMs: 10000 }
  })
  async handleLegacyOrder(
    payload: unknown,  // Raw event payload
    headers: any,      // Raw AMQP headers
  ): Promise<void> {
    this.logger.log(`Legacy order: ${JSON.stringify(payload)}`);
  }
}
```

### Method Signatures

**Standard Subscription Method:**
```typescript
async methodName(
  auth: AuthorizationPayloadEntity,  // Actor context with authentication
  event: EventPayload<T>,           // Structured event data
  headers: EventHeaders,            // Event metadata
): Promise<void>
```

**Legacy Subscription Method:**
```typescript
async methodName(
  payload: unknown,  // Raw event payload
  headers: any,      // Raw AMQP headers
): Promise<void>
```

## Event Structure

### Published Event Format

Every published event follows this standardized structure:

```typescript
{
  headers: {
    event_uid: "550e8400-e29b-41d4-a716-446655440000",  // Unique event ID
    entity_type: "user",                                 // Entity type
    event_type: "created",                              // Event type
    timestamp: "2023-01-01T12:00:00.000Z",             // ISO timestamp
    source_service: "user-service",                     // Publishing service
    trace_id: "abc123",                                 // Distributed tracing ID
    actor: {                                            // Who triggered the event
      id: "user-123",
      type: "user",
      email: "user@example.com"
    },
    version: "v1"                                       // Schema version
  },
  payload: {
    data: {                                             // Your event data
      id: "user-456",
      email: "newuser@example.com",
      name: "New User"
    },
    schema_ref: "user/created/v1"                       // Schema reference
  }
}
```

### Routing Keys

Events are routed using the pattern: `{domain}.{entityType}.{eventType}`

Examples:
- `scheduling.user.created`
- `payments.product.updated`
- `billing.subscription.deleted`

## Error Handling & Retries

### Built-in Retry Logic

The module automatically retries failed event processing with exponential backoff:

```typescript
@SubscribeTo({
  domain: 'payments',
  entity: 'product',
  action: 'created',
  retry: {
    count: 5,        // Retry up to 5 times
    delayMs: 10000   // Start with 10 second delay
  }
})
async handleProductCreated(
  auth: AuthorizationPayloadEntity,
  event: EventPayload<ProductData>,
  headers: EventHeaders,
): Promise<void> {
  // Your logic here
}
```

### Non-Retryable Errors

Some errors shouldn't be retried (e.g., validation errors):

```typescript
import { NonRetryableError } from '@vcita/event-bus-nestjs';

@SubscribeTo({
  domain: 'payments',
  entity: 'product',
  action: 'created',
})
async handleProductCreated(
  auth: AuthorizationPayloadEntity,
  event: EventPayload<ProductData>,
  headers: EventHeaders,
): Promise<void> {
  try {
    await this.validateProduct(event.data);
    await this.processProduct(event.data);
  } catch (error) {
    if (error instanceof ValidationError) {
      // Don't retry validation errors
      throw new NonRetryableError(error.message);
    }
    // Other errors will be retried
    throw error;
  }
}
```

### Dead Letter Queues

After all retries are exhausted, messages are sent to dead letter queues for manual inspection.

## Testing

### Test Environment Setup

In test environments (`NODE_ENV=test`), the module automatically mocks AMQP connections:

```typescript
// my.service.spec.ts
import { Test } from '@nestjs/testing';
import { EventBusModule, EventBusPublisher } from '@vcita/event-bus-nestjs';

describe('MyService', () => {
  let service: MyService;
  let eventBusPublisher: EventBusPublisher;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [EventBusModule], // No configuration needed in tests
      providers: [MyService],
    }).compile();

    service = module.get<MyService>(MyService);
    eventBusPublisher = module.get<EventBusPublisher>(EventBusPublisher);
  });

  it('should publish events', async () => {
    const user = await service.createUser(userData, actor);

    // Verify the event was published
    expect(eventBusPublisher.publish).toHaveBeenCalledWith({
      entityType: 'user',
      eventType: 'created',
      data: user,
      actor: actor,
    });
  });
});
```

### Disabling Event Bus

You can disable the event bus for testing by setting:

```bash
DISABLE_EVENT_BUS=true
```

## Environment Variables

See the [Configuration](#configuration) section for detailed information about all environment variables.

### Testing Variables

```bash
# Disable event bus functionality (useful for testing)
DISABLE_EVENT_BUS=true
```

## Advanced Usage

### Custom Queue Configuration

```typescript
@SubscribeTo({
  domain: 'payments',
  entity: 'product',
  action: 'created',
  queue: 'my-custom-queue',
  queueOptions: {
    durable: true,
    arguments: {
      'x-message-ttl': 3600000, // 1 hour TTL
    },
  },
  errorQueueOptions: {
    durable: true,
    arguments: {
      'x-message-ttl': 86400000, // 24 hour TTL for error queue
    },
  },
})
async handleProductCreated(/* ... */) {
  // Your logic
}
```

### Multiple Event Handlers

```typescript
@Injectable()
export class ProductSubscriber {
  @SubscribeTo({
    domain: 'payments',
    entity: 'product',
    action: 'created',
  })
  async handleProductCreated(/* ... */) {
    // Handle creation
  }

  @SubscribeTo({
    domain: 'payments',
    entity: 'product',
    action: 'updated',
  })
  async handleProductUpdated(/* ... */) {
    // Handle updates
  }

  @SubscribeTo({
    domain: 'payments',
    entity: 'product',
    action: 'deleted',
  })
  async handleProductDeleted(/* ... */) {
    // Handle deletion
  }
}
```

## API Reference

### EventBusPublisher

```typescript
class EventBusPublisher<T = unknown> {
  /**
   * Publish an event to the event bus
   */
  async publish(options: PublishEventOptions<T>): Promise<void>
}
```

### PublishEventOptions

```typescript
interface PublishEventOptions<T = unknown> {
  entityType: string;    // Entity type (e.g., 'user', 'product')
  eventType: EventType;  // Event type (e.g., 'created', 'updated')
  data: T;               // Event payload
  actor: Actor;          // Actor information
  version?: string;      // Schema version (default: 'v1')
  domain?: string;       // Domain override
}
```

### SubscribeTo Options

```typescript
interface SubscribeToOptions {
  domain: string | '*';           // Domain to listen to
  entity: string | '*';           // Entity type to listen to
  action: EventType;              // Action to listen to
  queue?: string;                 // Custom queue name
  retry?: {                       // Retry configuration
    count?: number;
    delayMs?: number;
  };
  queueOptions?: object;          // Queue options
  errorQueueOptions?: object;     // Error queue options
}
```

### LegacySubscribeTo Options

```typescript
interface LegacySubscribeToOptions {
  routingKey: string;             // RabbitMQ routing key pattern
  queue?: string;                 // Custom queue name
  retry?: {                       // Retry configuration
    count?: number;
    delayMs?: number;
  };
  queueOptions?: object;          // Queue options
  errorQueueOptions?: object;     // Error queue options
}
```

## License

ISC 