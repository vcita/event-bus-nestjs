# Change Detection Enhancement

## Overview

This enhancement adds support for including the previous entity state in events (except for `created` events), enabling subscribers to detect meaningful changes and implement selective processing logic.

## Changes Made

### 1. **Interface Updates**

#### `EventPayload<T>` Interface
```typescript
export interface EventPayload<T = unknown> {
  data: T;
  prev_data?: T; // NEW: Previous entity state for updated/deleted events
  schema_ref: string;
}
```

#### `PublishEventOptions<T>` Interface
```typescript
export interface PublishEventOptions<T = unknown> {
  entityType: string;
  eventType: EventType;
  data: T;
  prevData?: T; // NEW: Previous entity state (required for updated/deleted events)
  actor: Actor;
  version?: string;
  domain?: string;
}
```

### 2. **EventBuilder Updates**

- Modified `buildPayload()` to accept optional `prevData` parameter
- Updated `buildEvent()` to extract and pass `prevData` from options
- `prev_data` is only included in payload when `prevData` is provided

### 3. **Publisher Validation**

Enhanced `EventBusPublisher` with strict validation:

- **Required `prevData`**: Throws error when publishing `updated` or `deleted` events without `prevData`
- **Validation for unnecessary `prevData`**: Prevents providing `prevData` for `created` events
- **Breaking change**: `prevData` is now mandatory for non-created events

### 4. **Documentation Updates**

- Updated README with change detection examples
- Added new section explaining the feature and benefits
- Updated API reference to include `prevData` field
- Added practical subscriber examples showing field-specific change detection

## Usage Examples

### Publishing Events with Previous State

```typescript
// For updates - include previous state
await eventBusPublisher.publish({
  entityType: 'user',
  eventType: 'updated',
  data: { id: '123', email: 'new@example.com', status: 'active' },
  prevData: { id: '123', email: 'old@example.com', status: 'inactive' },
  actor: auth.actor,
});

// For deletions - include previous state for audit
await eventBusPublisher.publish({
  entityType: 'user',
  eventType: 'deleted',
  data: { id: '123' },
  prevData: { id: '123', email: 'user@example.com', status: 'active' },
  actor: auth.actor,
});

// For creation - no previous state needed
await eventBusPublisher.publish({
  entityType: 'user',
  eventType: 'created',
  data: { id: '123', email: 'user@example.com', status: 'active' },
  actor: auth.actor,
});
```

### Consuming Events with Change Detection

```typescript
@SubscribeTo({
  domain: 'users',
  entity: 'user',
  action: 'updated',
})
async handleUserUpdated(
  auth: AuthorizationPayloadEntity,
  event: EventPayload<UserData>,
  headers: EventHeaders,
): Promise<void> {
  const { data: currentUser, prev_data: previousUser } = event;

  if (previousUser) {
    // Selective processing based on what changed
    if (currentUser.email !== previousUser.email) {
      await this.handleEmailChange(currentUser.id, previousUser.email, currentUser.email);
    }
    
    if (currentUser.status !== previousUser.status) {
      await this.handleStatusChange(currentUser.id, previousUser.status, currentUser.status);
    }
  }

  // Always process the general update
  await this.processUserUpdate(currentUser);
}
```

## Benefits

### 🎯 **Selective Processing**
- Only react to meaningful changes
- Avoid unnecessary processing when irrelevant fields change
- Implement field-specific business logic

### 📊 **Better Observability**
- Track exactly what changed in each event
- Comprehensive audit trails
- Enhanced debugging capabilities

### ⚡ **Performance Optimization**
- Skip expensive operations when specific fields haven't changed
- Reduce downstream system load
- More efficient resource utilization

### 🔧 **Enhanced Business Logic**
- Implement different handling for different types of changes
- Support complex validation rules based on previous state
- Enable sophisticated workflow triggers

## Breaking Changes

❗ **Breaking change for publishers**
- `prevData` is now **required** for `updated` and `deleted` events
- Publishing these events without `prevData` will throw an error
- Existing code must be updated to provide previous entity state
- Subscribers remain backward compatible and can handle missing `prev_data`

## Event Structure Example

```json
{
  "headers": {
    "event_uid": "550e8400-e29b-41d4-a716-446655440000",
    "entity_type": "user",
    "event_type": "updated",
    "timestamp": "2023-01-01T12:00:00.000Z",
    "source_service": "user-service",
    "trace_id": "abc123",
    "actor": { "id": "user-123", "type": "user" },
    "version": "v1"
  },
  "payload": {
    "data": {
      "id": "user-456",
      "email": "newemail@example.com",
      "name": "John Doe",
      "status": "active"
    },
    "prev_data": {
      "id": "user-456",
      "email": "oldemail@example.com",
      "name": "John Doe",
      "status": "inactive"
    },
    "schema_ref": "user@v1"
  }
}
```

## Migration Strategy

### For Publishers
1. **Immediate action required**: All `updated`/`deleted` events must include `prevData`
2. **Update existing code**: Fix any publishing code that doesn't provide `prevData`
3. **Error handling**: Handle the new validation errors appropriately

### For Subscribers
1. **Check availability**: Always check if `prev_data` exists before using
2. **Graceful fallback**: Handle cases where `prev_data` is missing
3. **Selective enhancement**: Add change detection where it provides value

## Best Practices

1. **Always provide `prevData`** for `updated` and `deleted` events
2. **Never provide `prevData`** for `created` events
3. **Check for existence** of `prev_data` in subscribers before using
4. **Use deep comparison** for complex objects when detecting changes
5. **Implement specific handlers** for different types of changes
6. **Maintain audit trails** using the previous state information

This enhancement enables more sophisticated event-driven architectures while maintaining full backward compatibility with existing systems. 