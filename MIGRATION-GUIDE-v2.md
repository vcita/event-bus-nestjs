# Migration Guide: v1.x to v2.0

This guide helps you migrate from version 1.x to 2.0 of `@vcita/event-bus-nestjs`, which introduces **mandatory change detection** for updated and deleted events.

## ⚠️ Breaking Changes

### 1. **Required `prevData` for Non-Created Events**

**Before (v1.x):**
```typescript
// This worked in v1.x but will throw an error in v2.0
await eventBusPublisher.publish({
  entityType: 'user',
  eventType: 'updated',
  data: { id: '123', name: 'New Name' },
  actor: auth.actor,
});
```

**After (v2.0):**
```typescript
// v2.0 requires prevData for updated/deleted events
await eventBusPublisher.publish({
  entityType: 'user',
  eventType: 'updated',
  data: { id: '123', name: 'New Name' },
  prevData: { id: '123', name: 'Old Name' }, // ✅ Required!
  actor: auth.actor,
});
```

### 2. **EventBuilder API Changes**

**Before (v1.x):**
```typescript
EventBuilder.buildPayload(data, entityType, version, prevData);
```

**After (v2.0):**
```typescript
EventBuilder.buildPayload(entityType, data, prevData, version);
```

## 🔧 How to Migrate

### Step 1: Update Publisher Code

Find all instances where you publish `updated` or `deleted` events and add the `prevData` field:

```typescript
// ❌ Before - Will throw error in v2.0
async updateUser(userId: string, updates: Partial<User>) {
  const updatedUser = await this.userRepository.update(userId, updates);
  
  await this.eventBusPublisher.publish({
    entityType: 'user',
    eventType: 'updated',
    data: updatedUser,
    actor: this.getCurrentActor(),
  });
}

// ✅ After - Required in v2.0
async updateUser(userId: string, updates: Partial<User>) {
  // Get current state before updating
  const currentUser = await this.userRepository.findById(userId);
  
  const updatedUser = await this.userRepository.update(userId, updates);
  
  await this.eventBusPublisher.publish({
    entityType: 'user',
    eventType: 'updated',
    data: updatedUser,
    prevData: currentUser, // ✅ Required!
    actor: this.getCurrentActor(),
  });
}
```

### Step 2: Update Deletion Code

```typescript
// ❌ Before - Will throw error in v2.0
async deleteUser(userId: string) {
  await this.userRepository.delete(userId);
  
  await this.eventBusPublisher.publish({
    entityType: 'user',
    eventType: 'deleted',
    data: { id: userId },
    actor: this.getCurrentActor(),
  });
}

// ✅ After - Required in v2.0
async deleteUser(userId: string) {
  // Get current state before deleting
  const userToDelete = await this.userRepository.findById(userId);
  
  await this.userRepository.delete(userId);
  
  await this.eventBusPublisher.publish({
    entityType: 'user',
    eventType: 'deleted',
    data: { id: userId },
    prevData: userToDelete, // ✅ Required for audit trail!
    actor: this.getCurrentActor(),
  });
}
```

### Step 3: Update Tests

Update your test expectations to include `prevData`:

```typescript
// ❌ Before - Incomplete test
expect(eventBusPublisher.publish).toHaveBeenCalledWith({
  entityType: 'user',
  eventType: 'updated',
  data: updatedUser,
  actor: mockActor,
});

// ✅ After - Complete test with prevData
expect(eventBusPublisher.publish).toHaveBeenCalledWith({
  entityType: 'user',
  eventType: 'updated',
  data: updatedUser,
  prevData: originalUser, // ✅ Include in test expectations
  actor: mockActor,
});
```

## 📋 Migration Checklist

- [ ] **Search codebase** for `eventType: 'updated'` and add `prevData`
- [ ] **Search codebase** for `eventType: 'deleted'` and add `prevData`
- [ ] **Update service methods** to fetch current state before modifications
- [ ] **Update test expectations** to include `prevData` fields
- [ ] **Review error handling** for new validation errors
- [ ] **Update any custom EventBuilder usage** with new parameter order

## 🔍 Finding Code to Update

Use these search patterns to find code that needs updating:

```bash
# Find updated events without prevData
grep -r "eventType.*updated" --include="*.ts" .
grep -r "eventType.*deleted" --include="*.ts" .

# Find EventBuilder.buildPayload usage
grep -r "buildPayload" --include="*.ts" .
```

## 🚨 Error Messages You Might See

When migrating, you'll encounter these errors:

### Missing prevData Error
```
Error: prevData is required
```

**Solution:** Add `prevData` field to your publish options for `updated`/`deleted` events.

### TypeScript Compilation Errors
```
Argument of type '...' is not assignable to parameter of type 'PublishEventOptions<...>'
```

**Solution:** Ensure you're providing all required fields including `prevData` for non-created events.

## 💡 Best Practices

### 1. **Efficient Data Retrieval**
```typescript
// ✅ Good - Single query before update
async updateUserEmail(userId: string, newEmail: string) {
  const currentUser = await this.userRepository.findById(userId);
  const updatedUser = { ...currentUser, email: newEmail };
  
  await this.userRepository.save(updatedUser);
  
  await this.eventBusPublisher.publish({
    entityType: 'user',
    eventType: 'updated',
    data: updatedUser,
    prevData: currentUser,
    actor: this.getCurrentActor(),
  });
}
```

### 2. **Transaction Safety**
```typescript
// ✅ Good - Ensure consistency
async updateUser(userId: string, updates: Partial<User>) {
  return this.dataSource.transaction(async (manager) => {
    const currentUser = await manager.findOne(User, { where: { id: userId } });
    const updatedUser = await manager.save({ ...currentUser, ...updates });
    
    // Publish after successful DB transaction
    await this.eventBusPublisher.publish({
      entityType: 'user',
      eventType: 'updated',
      data: updatedUser,
      prevData: currentUser,
      actor: this.getCurrentActor(),
    });
    
    return updatedUser;
  });
}
```

### 3. **Subscriber Updates (New Signature)**
Update your subscriber method signatures to receive separate current and previous data parameters:

**Before (v1.x):**
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
  const user = event.data;
  // No previous data available in v1.x
}
```

**After (v2.0):**
```typescript
@SubscribeTo({
  domain: 'users',
  entity: 'user',
  action: 'updated',
})
async handleUserUpdated(
  auth: AuthorizationPayloadEntity,
  userData: EventPayload<UserData>,        // ✅ Current state
  prevUserData: EventPayload<UserData>,    // ✅ Previous state
  headers: EventHeaders,
): Promise<void> {
  const currentUser = userData.data;
  const previousUser = prevUserData?.data;

  // ✅ New - Selective processing based on what changed
  if (previousUser && currentUser.email !== previousUser.email) {
    await this.handleEmailChange(currentUser.id, previousUser.email, currentUser.email);
  }
  
  if (previousUser && currentUser.status !== previousUser.status) {
    await this.handleStatusChange(currentUser.id, previousUser.status, currentUser.status);
  }
  
  // Always process the general update
  await this.processUserUpdate(currentUser);
}
```

## 🆘 Need Help?

1. **Check the error message** - v2.0 provides clear validation errors
2. **Review the examples** in the updated README
3. **Run your tests** - they'll help identify missing `prevData` fields
4. **Use TypeScript** - it will catch missing required fields at compile time

## 🎯 Benefits After Migration

Once migrated, you'll have:

- **🔍 Complete change tracking** - Know exactly what changed in every event
- **🚀 Better performance** - Subscribers can process only relevant changes
- **📊 Enhanced audit trails** - Full before/after state for compliance
- **🛡️ Improved reliability** - Mandatory change detection prevents data loss

The migration effort pays off with more robust and observable event-driven architecture! 