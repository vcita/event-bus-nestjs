# @vcita/event-bus-nestjs

A comprehensive NestJS module for publishing and subscribing to standardized events via RabbitMQ/AMQP with built-in tracing, retry mechanisms, and structured event formatting.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Publishing Events](#publishing-events)
- [Consuming Events](#consuming-events)
- [Legacy Event Subscription](#legacy-event-subscription)
- [Event Structure](#event-structure)
- [Error Handling & Retries](#error-handling--retries)
- [Testing](#testing)
- [Migration to v2.0.0](#migration-to-v200)
- [Environment Variables](#environment-variables)
- [Further Reading](https://myvcita.atlassian.net/wiki/spaces/IT/pages/3962175720/TypeScript+NestJS)

## Features

✅ **Standardized Event Publishing**: Automatically structures events with headers (timestamps, trace IDs, actor info)  
✅ **Flexible Event Subscription**: Subscribe to events using decorators with pattern matching  
✅ **AMQP Connection Management**: Handles RabbitMQ connections, queues, and exchanges automatically  
✅ **Distributed Tracing**: Built-in support for tracing across services  
✅ **Retry Mechanisms**: Configurable retry logic  
✅ **Error Handling**: Comprehensive error handling with error queues  
✅ **Legacy Support**: Backward compatibility with legacy event formats  
✅ **Testing Support**: Automatic mocking in test environments  
✅ **Metrics Integration**: Prometheus metrics for monitoring (via @vcita/infra-nestjs)  

## Installation

```bash
npm install @vcita/event-bus-nestjs@^2.0.0
```

**Required Peer Dependencies:**
```bash
npm install @nestjs/common @nestjs/core @vcita/infra-nestjs @vcita/oauth-client-nestjs
```

## Quick Start

### 1. Set Environment Variables

Set the `EVENT_BUS_DEFAULT_DOMAIN` environment variable to the domain which the entities for which events are sent belong to:

In `shipit.yml`:
```yaml
helm_values:
  default:
    global:
      deployment:
        env:
          EVENT_BUS_DEFAULT_DOMAIN: scheduling
```

### 2. Import the Modules

You can import the modules individually based on your needs:

**For Publishing Only:**
```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { PublisherModule } from '@vcita/event-bus-nestjs';

@Module({
  imports: [
    PublisherModule,
  ],
})
export class AppModule {}
```

**For Subscribing Only:**
```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { SubscriberModule } from '@vcita/event-bus-nestjs';

@Module({
  imports: [
    SubscriberModule,
  ],
})
export class AppModule {}
```

**For Both Publishing and Subscribing:**
```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { PublisherModule, SubscriberModule } from '@vcita/event-bus-nestjs';

@Module({
  imports: [
    PublisherModule,
    SubscriberModule,
  ],
})
export class AppModule {}
```

### 3. Publish an Event

```typescript
// resource.service.ts
import { Injectable } from '@nestjs/common';
import { EventBusPublisher } from '@vcita/event-bus-nestjs';
import { AuthorizationPayloadEntity } from '@vcita/oauth-client-nestjs';

@Injectable()
export class ResourceService {
  constructor(private readonly eventBusPublisher: EventBusPublisher<ResourceData>) {}

  async createResource(resourceData: ResourceData, actor: AuthorizationPayloadEntity): Promise<void> {
    // Business logic to create resource
    const resourceEntity = await this.someMethod(resourceData);

    // Publish event - routing key will be: scheduling.resource.created
    await this.eventBusPublisher.publish({
      entityType: 'resource',
      eventType: 'created',
      domain: 'scheduling',
      data: resourceEntity,
      actor: actor.actor
    });
  }
}
```

### 4. Subscribe to Events

```typescript
// resource.subscriber.ts
import { Injectable } from '@nestjs/common';
import { AuthorizationPayloadEntity } from '@vcita/oauth-client-nestjs';
import { InfraLoggerService } from '@vcita/infra-nestjs';
import { SubscribeTo, EventPayload, EventHeaders } from '@vcita/event-bus-nestjs';

@Injectable()
export class ResourceSubscriber {
  private readonly logger = new InfraLoggerService(ResourceSubscriber.name);

  @SubscribeTo({
    domain: 'scheduling',
    entity: 'resource',
    action: 'created'
  })
  async handleResourceCreated(
    actor: AuthorizationPayloadEntity,
    event: EventPayload<ResourceData>,
    headers: EventHeaders
  ): Promise<void> {
    this.logger.log(`Resource created: ${event.data.id}`);
    // Your business logic here
  }
}
```

Don't forget to register your subscriber in your module.
## Configuration

The module uses environment variables for configuration. You can configure these in the `shipit.yml` file of your service:

### Required Configuration

```yaml
# Required - these should already exist in your service
# You can check for these in the shipit.yml file or in the container
RABBITMQ_DSN: amqp://user:password@localhost:5672
APP_NAME: your-service-name
```

### Optional Configuration

```yaml
# Optional - will be used as the default domain when publishing events
EVENT_BUS_DEFAULT_DOMAIN: scheduling

# Optional - Event bus configuration
EVENT_BUS_EXCHANGE_NAME: event_bus  # DANGER! DON'T change this unless you know what you're doing
DISABLE_EVENT_BUS: false  # Set to 'true' to disable subscriptions
EVENT_BUS_DEFAULT_MAX_RETRIES: 1
EVENT_BUS_DEFAULT_RETRY_DELAY_MS: 10000

# Optional - Legacy event bus configuration
LEGACY_EVENT_BUS_EXCHANGE: vcita.model_updates  # Default: vcita.model_updates
```

### Configuration Options

| Environment Variable | Type | Required | Description | Default |
|---------------------|------|----------|-------------|---------|
| `RABBITMQ_DSN` | string | ✅ | RabbitMQ connection string | - |
| `APP_NAME` | string | ✅ | Your service name (used for queues and source service) | - |
| `EVENT_BUS_DEFAULT_DOMAIN` | string | ❌ | Default domain for routing keys | `default` |
| `EVENT_BUS_EXCHANGE_NAME` | string | ❌ | RabbitMQ exchange name for standard events | `event_bus` |
| `DISABLE_EVENT_BUS` | boolean | ❌ | Disable event bus functionality (useful for testing) | `false` |
| `EVENT_BUS_DEFAULT_MAX_RETRIES` | number | ❌ | Default retry count | `1` |
| `EVENT_BUS_DEFAULT_RETRY_DELAY_MS` | number | ❌ | Default retry delay in milliseconds | `10000` |
| `LEGACY_EVENT_BUS_EXCHANGE` | string | ❌ | Exchange name for legacy events | `vcita.model_updates` |

## Publishing Events

Publishing events uses the `EventBusPublisher` service with NestJS dependency injection. Events are published to the `event_bus` RabbitMQ topic exchange.

### Interface Definitions

```typescript
// Event publishing options
interface PublishEventOptions<T = unknown> {
  entityType: string;        // Type of entity (e.g., "resource", "order")
  eventType: PublishEventType; // Action performed (e.g., "created", "read", "updated", "deleted")
  data: T;                   // Typed business data
  prevData?: T;              // Typed previous data - required for 'updated' events
  actor: Actor;              // User/system that triggered the event
  version?: string;          // Schema version (defaults to "v1")
  domain?: string;           // Event domain (uses configured default if omitted)
}

// Actor information
type Actor = BaseActor & Partial<ActorEntity>;

// Event types
export type PublishEventType = 'created' | 'read' | 'updated' | 'deleted';
```

**Possible event types** are `created`, `read`, `updated` and `deleted`.

### Basic Publishing

```typescript
import { Injectable } from '@nestjs/common';
import { EventBusPublisher } from '@vcita/event-bus-nestjs';
import { AuthorizationPayloadEntity } from '@vcita/oauth-client-nestjs';

@Injectable()
export class ResourceService {
  constructor(private readonly eventBusPublisher: EventBusPublisher<ResourceData>) {}

  async createResource(resourceData: ResourceData, actor: AuthorizationPayloadEntity): Promise<void> {
    // Business logic to create resource
    const resourceEntity = await this.someMethod(resourceData);

    // Publish event
    await this.eventBusPublisher.publish({
      entityType: 'resource',
      eventType: 'created',
      domain: 'scheduling',
      data: resourceEntity,
      actor: actor.actor
    });
  }
}
```

### Entity Updated Events

When publishing events of type `updated`, you **must** also supply the `prevData` parameter containing the entity data before it was updated:

```typescript
import { Injectable } from '@nestjs/common';
import { EventBusPublisher } from '@vcita/event-bus-nestjs';
import { AuthorizationPayloadEntity } from '@vcita/oauth-client-nestjs';

@Injectable()
export class ResourceService {
  constructor(private readonly eventBusPublisher: EventBusPublisher<ResourceData>) {}

  async updateResource(
    resourceId: string,
    updates: Partial<ResourceData>,
    actor: AuthorizationPayloadEntity
  ): Promise<void> {
    const oldResource = await this.fetchResource(resourceId);
    const updatedResource = await this.performUpdate(resourceId, updates);

    await this.eventBusPublisher.publish({
      entityType: 'resource',
      eventType: 'updated',
      data: updatedResource,
      prevData: oldResource,  // Required for updated events
      actor: actor.actor,
      domain: 'scheduling',   // Optional: defaults to configured EVENT_BUS_DEFAULT_DOMAIN
      version: 'v2'           // Optional: defaults to 'v1'
    });
  }
}
```

### Error Handling

The publisher automatically validates input and throws descriptive errors:

```typescript
try {
  await this.eventBusPublisher.publish({
    entityType: '',  // Invalid: empty string
    eventType: 'created',
    data: resourceData,
    actor: actor.actor
  });
} catch (error) {
  // Error: "entityType is required and cannot be empty"
  console.error('Publishing failed:', error.message);
}
```

## Consuming Events

Event subscribers use the `@SubscribeTo` decorator to declaratively subscribe to events with automatic queue management and retry handling.

### Interface Definitions

```typescript
// Subscription options
interface SubscribeToOptions {
  domain: '*' | '#' | string;     // Domain(s) to subscribe to
  entity: '*' | '#' | string;     // Entity type(s) to subscribe to
  action: EventType;              // Action(s) to subscribe to (supports wildcards)
  queue?: string;                 // Custom queue name (optional)
  // Used when you'd like to register a 2nd+ handler for the same event
  queueOptions?: Record<string, any>;      // Additional queue options (optional)
  errorQueueOptions?: Record<string, any>; // Error queue configuration (optional)
}

// Event Type
type EventType = 'created' | 'read' | 'updated' | 'deleted' | '*';

// Event headers received by subscribers
interface EventHeaders {
  event_uid: string;
  entity_type: string;
  event_type: string;
  timestamp: string;
  source_service: string;  // Core, availability, permissionsmanager, etc
  trace_id: string;        // Useful for consistent logging
  actor: Actor;
  version: string;
}

// Event payload wrapper
interface EventPayload<T = unknown> {
  data: T;
  prev_data?: T;
  schema_ref: string;
}
```

### Method Signature

All subscriber methods must follow this exact signature:

```typescript
async methodName(
  actor: AuthorizationPayloadEntity,  // Authentication context
  event: EventPayload<T>,             // Typed event data
  headers: EventHeaders               // Event metadata
): Promise<void>
```

### Basic Subscription

The `SubscribeTo` decorator should be called adjacently to the handler function in order to be able to use metadata-related decorators such as `ApiMaxDuration`.

```typescript
@SubscribeTo({
  domain: 'scheduling',
  entity: 'resource',
  action: 'created'
})
async handleResourceCreated(
  actor: AuthorizationPayloadEntity,
  event: EventPayload<ResourceData>,
  headers: EventHeaders
): Promise<void> {
  // do something...
}
```

### Wildcard Patterns

The system supports wildcard patterns for flexible subscriptions:

```typescript
// Single word wildcard (*)
@SubscribeTo({
  domain: 'scheduling',
  entity: '*',      // All entities in scheduling domain
  action: 'created'
})
```

### Default Retry Policy

Events have a default retry policy consisting of:

* 1 retry attempt; i.e., if an event fails and the error is not a `NonRetryableError` it will be tried one more time before being routed to the error queue
* 10 seconds delay between retries; i.e., on event failure there will be a period of 10 seconds before the event is retried

### Custom Retry Parameters

```typescript
// Custom retry configuration example
@SubscribeTo({
  domain: 'scheduling',
  entity: 'resource',
  action: 'created',
  retry: {
    count: 3,      // Override default max retries (default: 1)
    delayMs: 30000 // Override default delay (default: 10000ms)
  }
})
async handleEvent(
  actor: AuthorizationPayloadEntity,
  event: EventPayload<any>,
  headers: EventHeaders
): Promise<void> {
  // This subscriber will retry up to 3 times with 30-second delays
  try {
    // Business logic
  } catch (error) {
    // Standard error handling - framework will handle retry logic
    throw error;
  }
}
```

**Note:** Changing retry parameters (`retry.count` or `retry.delayMs`) for an existing subscriber requires deletion and recreation of the subscriber's retry infrastructure queues in RabbitMQ. This is because TTL and dead letter exchange configurations are set at queue creation time and cannot be modified.

### Error Handling

```typescript
import { NonRetryableError } from '@vcita/event-bus-nestjs';

// For permanent failures that should skip retry
throw new NonRetryableError(
  'Invalid event schema',
  originalError
);
```

**Important**: All errors thrown from subscriber methods that are **not** of type `NonRetryableError` will be automatically rethrown internally as `RetryError` instances and will be retried according to the TTL-based retry policy. This means:

* If you throw a `NonRetryableError`, the message goes directly to the dead letter queue.
* If you throw any other error type (including standard `Error`, `TypeError`, etc.), it will be automatically converted to a `RetryError` and retried.
* Only explicitly throw `NonRetryableError` when you're certain the error is permanent and should not be retried.

### Queue Configuration

Queues are automatically named using the pattern: `{appName}.{domain}.{entity}.{action}`.

```typescript
// Custom queue name and options
@SubscribeTo({
  domain: 'scheduling',
  entity: 'resource',
  action: 'created',
  queue: 'custom-resource-processor', // Override default naming
  queueOptions: {
    // Optional: RabbitMQ queue arguments
  },
  errorQueueOptions: {
    // Optional: RabbitMQ DLQ arguments
  }
})
```

## Legacy Event Subscription

The event bus provides backward compatibility support for legacy event systems through the `@LegacySubscribeTo` decorator. This feature allows services to subscribe to existing legacy topic exchanges without requiring the structured domain/entity/action classification used by standard events.

This decorator is especially useful for consuming events produced by the model-change triggering mechanism used by the core and vcita services (`vcita.model_updates` exchange).

### Key Differences from Standard Events

* **No Event Structure Requirements**: Legacy events can contain any JSON payload without requiring `data` and `schema_ref` fields
* **No Actor Context**: Legacy events don't require actor authentication context in headers
* **Direct Routing Keys**: Use raw routing key patterns instead of domain/entity/action classification
* **Simplified Method Signature**: Handlers receive `(payload: unknown, headers: any)` instead of the standard format
* **Legacy Exchange**: Connects to configured legacy exchanges (default: `vcita.model_updates`)

Subscribers can use both standard decorators and legacy decorators in the same class.

### Method Signature

All legacy subscriber methods must follow this exact signature:

```typescript
async methodName(
  payload: unknown,  // Raw event payload (any JSON structure)
  headers: any       // Raw message headers (any structure)
): Promise<void>
```

### Legacy Subscriber Implementation

```typescript
import { Injectable } from '@nestjs/common';
import { InfraLoggerService } from '@vcita/infra-nestjs';
import { LegacySubscribeTo } from '@vcita/event-bus-nestjs';

@Injectable()
export class LegacyApplicationSubscriber {
  // Legacy subscription with custom queue name and retry config
  @LegacySubscribeTo({
    routingKey: 'model_change.application',
    queue: 'numbers_manager.model_changes.application', // default is legacy.{service_name}.{routing_key}
    retry: {
      count: 3,      // Custom retry count
      delayMs: 30000 // Custom retry delay
    }
  })
  async handleLegacyApplicationEvent(payload: unknown, headers: any): Promise<void> {
    // Handling logic
  }
}
```

### Queue Naming Convention

Legacy subscriptions create queues with a specific naming pattern and isolated per-subscriber retry infrastructure:

* **Main Queue**: `{queue} || legacy.{appName}.{routingKey}`
* **Retry Exchange**: `{main_queue_name}.retry`
* **Retry Queue**: `{main_queue_name}.retry` (with TTL)
* **Requeue Exchange**: `{main_queue_name}.requeue`
* **Error Exchange**: `{main_queue_name}.error`
* **Error Queue**: `{main_queue_name}.error`

**Note:** Changing retry parameters (`retry.count` or `retry.delayMs`) for an existing subscriber requires deletion and recreation of the subscriber's retry infrastructure queues in RabbitMQ. This is because TTL and dead letter exchange configurations are set at queue creation time and cannot be modified.

### Interface Definitions

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
    prev_data: {                                        // Previous state (for updated/deleted events)
      id: "user-456",
      email: "olduser@example.com", 
      name: "Old User"
    },
    schema_ref: "user/created/v1"                       // Schema reference
  }
}
```

**Note:** The `prev_data` field usage varies by event type:
- **`created` events**: `prevData` is optional (typically undefined)
- **`updated` events**: `prevData` is **required** (validation error if missing)  
- **`deleted` events**: `prevData` is optional but recommended for comprehensive audit trails

### Routing Keys

Events are routed using the pattern: `{domain}.{entityType}.{eventType}`

Examples:
- `scheduling.user.created`
- `payments.product.updated`
- `billing.subscription.deleted`

## Error Handling & Retries

### Built-in Retry Logic

The module automatically retries failed event processing:

```typescript
@SubscribeTo({
  domain: 'payments',
  entity: 'product',
  action: 'created',
  retry: {
    count: 5,        // Retry up to 5 times
    delayMs: 10000   // Delay between retries
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

### Error Queues

After all retries are exhausted, messages are sent to error queues for manual inspection.

## Testing

### Publisher Testing

#### Setup and Success Cases

```typescript
describe('ResourceService', () => {
  const mockEventBusPublisher = {
    publish: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<EventBusPublisher>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ResourceService(/* deps */, mockEventBusPublisher);
  });

  it('should publish event on successful creation', async () => {
    await service.createResource(validDto, mockActor);

    expect(mockEventBusPublisher.publish).toHaveBeenCalledWith({
      entityType: 'resource',
      eventType: 'created',
      data: expect.any(Object),
      actor: mockActor,
    });
  });
});
```

#### Failure Cases

```typescript
it('should NOT publish event when operation fails', async () => {
  jest.spyOn(repository, 'create').mockRejectedValue(new Error('Validation failed'));

  await expect(service.createResource(invalidDto, mockActor)).rejects.toThrow();
  expect(mockEventBusPublisher.publish).not.toHaveBeenCalled();
});
```

**Key Patterns**: Mock publisher, verify `publish` called on success, verify `publish` NOT called on failure.

### Subscriber Testing

Disable event bus subscriptions in test environments:

```bash
DISABLE_EVENT_BUS=true
```

This prevents actual queue creation and message consumption during unit tests while keeping the decorator syntax intact.

#### Testing Event Subscribers

```typescript
// Mock decorator before imports
jest.mock('@vcita/event-bus-nestjs/decorators/subscribe-to.decorator', () => ({
  SubscribeTo: () => () => {},
}));

describe('ResourceSubscriber', () => {
  let subscriber: ResourceSubscriber;
  let mockService: jest.Mocked<SomeService>;

  beforeEach(() => {
    mockService = { someMethod: jest.fn() } as any;
    subscriber = new ResourceSubscriber(mockService);
    jest.clearAllMocks();
  });

  it('should handle event and call business logic', async () => {
    const mockAuth = { actor: { uid: 'user-123' } } as any;
    const mockEvent = { data: { uid: 'resource-123' }, schema_ref: 'resource-v1' };
    const mockHeaders = { event_type: 'created', event_uid: 'evt-123' } as any;

    await subscriber.handleResourceEvent(mockAuth, mockEvent, mockHeaders);

    expect(mockService.someMethod).toHaveBeenCalledWith('resource-123', 'resource');
  });

  it('should propagate errors for retry mechanism', async () => {
    mockService.someMethod.mockRejectedValue(new Error('Service failed'));

    await expect(subscriber.handleResourceEvent(mockAuth, mockEvent, mockHeaders))
      .rejects.toThrow('Service failed');
  });
});
```

**Key Patterns**: Mock decorator, test handler methods directly, verify business logic calls, let errors bubble up for retry.

## Migration to v2.0.0

Introducing the following changes:

**You must note the breaking changes and fix your code accordingly!**
Failing to do so would cause errors.

### Breaking Changes

* **Publisher Validation**: `prevData` is now **required** for `updated` events
* **Event Type Validation**: Event type must be one of: `created`, `read`, `updated`, `deleted`
* **EventBuilder API**: Parameter order changed to `buildPayload(entityType, data, prevData?, version?)`
* **Subscriber Method Signatures**: Methods now receive `(auth, currentData, previousData, headers)`

### Added Features

* **Change Detection**: Added `prev_data` field to event payload structure
* **Enhanced Validation**: Stricter validation with clear error messages

### Migration Steps

#### 1. Add `prevData` to Updated Events

**Before:**
```typescript
await this.eventBusPublisher.publish({
  entityType: 'entity',
  eventType: 'updated',
  data: updatedEntity,
  actor: this.getCurrentActor(),
});
```

**After:**
```typescript
const currentEntity = await this.entityRepository.findById(entityId);
const updatedEntity = await this.entityRepository.update(entityId, updates);

await this.eventBusPublisher.publish({
  entityType: 'entity',
  eventType: 'updated',
  data: updatedEntity,
  prevData: currentEntity, // ✅ Required!
  actor: this.getCurrentActor(),
});
```

#### 2. Update EventBuilder Usage (if used)

**Before:**
```typescript
EventBuilder.buildPayload(entityData, 'entity', 'v1', prevEntityData);
```

**After:**
```typescript
EventBuilder.buildPayload('entity', entityData, prevEntityData, 'v1');
```

#### 3. Update Subscriber Method Signatures

**Before:**
```typescript
async handleEntityUpdated(
  auth: AuthorizationPayloadEntity,
  event: EventPayload<EntityData>,
  headers: EventHeaders,
): Promise<void>
```

**After:**
```typescript
async handleEntityUpdated(
  auth: AuthorizationPayloadEntity,
  entityData: EventPayload<EntityData>,    // Current state
  prevEntityData: EventPayload<EntityData>, // Previous state
  headers: EventHeaders,
): Promise<void>
```

#### 4. Update Tests

```typescript
expect(eventBusPublisher.publish).toHaveBeenCalledWith({
  entityType: 'entity',
  eventType: 'updated',
  data: updatedEntity,
  prevData: originalEntity, // ✅ Include in test expectations
  actor: mockActor,
});
```

## Environment Variables

See the [Configuration](#configuration) section for detailed information about all environment variables.


## License

ISC 