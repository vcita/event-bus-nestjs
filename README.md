# @vcita/event-bus-nestjs

A NestJS module for publishing standardized events to RabbitMQ/AMQP with built-in tracing and structured event formatting.

## What it does

This package provides a simple way to publish domain events from your NestJS application to RabbitMQ. It automatically:
- Structures events with standardized headers (timestamps, trace IDs, actor info)
- Handles AMQP connection management
- Provides distributed tracing support
- Uses consistent routing key patterns

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
          sourceService: process.env.APP_NAME,
          exchangeName: process.env.EVENT_BUS_EXCHANGE_NAME || 'event_bus',
          defaultDomain: process.env.EVENT_BUS_DEFAULT_DOMAIN || 'my-domain',
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
  sourceService: 'my-service',
  exchangeName: 'event_bus',
  defaultDomain: 'my-domain',
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

## Configuration Options

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `rabbitmqDsn` | ✅ | RabbitMQ connection string | - |
| `sourceService` | ✅ | Name of your service | - |
| `exchangeName` | ✅ | RabbitMQ exchange name | - |
| `defaultDomain` | ✅ | Default domain for routing keys | - |

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
- `RABBITMQ_DSN` - RabbitMQ connection string
- `APP_NAME` - Your service name
- `EVENT_BUS_EXCHANGE_NAME` - Exchange name (default: 'event_bus')
- `EVENT_BUS_DEFAULT_DOMAIN` - Default domain (default: 'scheduling')

## License

ISC 