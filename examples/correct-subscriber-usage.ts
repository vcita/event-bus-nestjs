import { Injectable } from '@nestjs/common';
import { SubscribeTo, EventPayload, EventHeaders } from '@vcita/event-bus-nestjs';
import { AuthorizationPayloadEntity } from '@vcita/oauth-client-nestjs';

interface UserData {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  lastLogin?: Date;
}

/**
 * Example showing the CORRECT subscriber signature
 * with separate current and previous data parameters
 */
@Injectable()
export class UserSubscriber {

  // ✅ CORRECT: Separate parameters for current and previous data
  @SubscribeTo({
    domain: 'users',
    entity: 'user',
    action: 'created',
  })
  async handleUserCreated(
    auth: AuthorizationPayloadEntity,
    userData: EventPayload<UserData>,
    prevUserData: EventPayload<UserData>, // Will be undefined for 'created' events
    headers: EventHeaders,
  ): Promise<void> {
    const user = userData.data;
    // prevUserData will be undefined for created events
    
    console.log(`User created: ${user.name} (${user.email})`);
    console.log('Previous data:', prevUserData?.data || 'None (created event)');
    
    await this.processNewUser(user);
  }

  // ✅ CORRECT: Separate parameters allow easy access to both states
  @SubscribeTo({
    domain: 'users',
    entity: 'user',
    action: 'updated',
  })
  async handleUserUpdated(
    auth: AuthorizationPayloadEntity,
    userData: EventPayload<UserData>,
    prevUserData: EventPayload<UserData>,
    headers: EventHeaders,
  ): Promise<void> {
    const currentUser = userData.data;
    const previousUser = prevUserData?.data;

    console.log('=== User Update Event ===');
    console.log('Current user:', currentUser);
    console.log('Previous user:', previousUser);

    if (previousUser) {
      // ✅ Easy comparison between current and previous states
      await this.detectAndProcessChanges(currentUser, previousUser);
    } else {
      console.log('No previous data available');
      await this.processUserUpdate(currentUser);
    }
  }

  // ✅ CORRECT: Deletion events have access to full previous state
  @SubscribeTo({
    domain: 'users',
    entity: 'user',
    action: 'deleted',
  })
  async handleUserDeleted(
    auth: AuthorizationPayloadEntity,
    deletionData: EventPayload<{ id: string }>,
    prevUserData: EventPayload<UserData>,
    headers: EventHeaders,
  ): Promise<void> {
    const deletionInfo = deletionData.data;
    const deletedUser = prevUserData?.data;

    if (deletedUser) {
      console.log(`User deleted: ${deletedUser.name} (${deletedUser.email})`);
      console.log('Full deleted user data:', deletedUser);
      
      // ✅ Use complete previous user data for comprehensive cleanup
      await this.performFullCleanup(deletedUser);
      await this.auditDeletion(deletedUser, auth.actor);
    } else {
      console.log(`User ${deletionInfo.id} deleted (no previous data)`);
      await this.basicCleanup(deletionInfo.id);
    }
  }

  private async detectAndProcessChanges(current: UserData, previous: UserData): Promise<void> {
    const changes: string[] = [];

    // ✅ Field-by-field comparison is straightforward
    if (current.email !== previous.email) {
      changes.push(`email: ${previous.email} → ${current.email}`);
      await this.handleEmailChange(current.id, previous.email, current.email);
    }

    if (current.name !== previous.name) {
      changes.push(`name: ${previous.name} → ${current.name}`);
      await this.handleNameChange(current.id, previous.name, current.name);
    }

    if (current.status !== previous.status) {
      changes.push(`status: ${previous.status} → ${current.status}`);
      await this.handleStatusChange(current.id, previous.status, current.status);
    }

    console.log(`Changes detected: ${changes.join(', ')}`);
    
    // Always process the general update
    await this.processUserUpdate(current);
  }

  private async handleEmailChange(userId: string, oldEmail: string, newEmail: string): Promise<void> {
    console.log(`Processing email change for user ${userId}`);
    // Email-specific business logic
    await this.updateEmailSubscriptions(oldEmail, newEmail);
    await this.sendEmailVerification(newEmail);
  }

  private async handleNameChange(userId: string, oldName: string, newName: string): Promise<void> {
    console.log(`Processing name change for user ${userId}`);
    // Name-specific business logic
    await this.updateDisplayNameCaches(userId, newName);
    await this.updateSearchIndexes(userId, oldName, newName);
  }

  private async handleStatusChange(userId: string, oldStatus: string, newStatus: string): Promise<void> {
    console.log(`Processing status change for user ${userId}: ${oldStatus} → ${newStatus}`);
    
    if (newStatus === 'suspended') {
      await this.suspendUserAccess(userId);
    } else if (oldStatus === 'suspended' && newStatus === 'active') {
      await this.restoreUserAccess(userId);
    }
  }

  private async processNewUser(user: UserData): Promise<void> {
    console.log(`Processing new user: ${user.id}`);
    // New user processing logic
  }

  private async processUserUpdate(user: UserData): Promise<void> {
    console.log(`Processing user update: ${user.id}`);
    // General update processing logic
  }

  private async performFullCleanup(user: UserData): Promise<void> {
    console.log(`Performing full cleanup for user: ${user.email}`);
    // Use complete user data for thorough cleanup
    await this.removeUserFiles(user.id);
    await this.cleanupUserSessions(user.id);
    await this.removeEmailSubscriptions(user.email);
  }

  private async basicCleanup(userId: string): Promise<void> {
    console.log(`Performing basic cleanup for user ID: ${userId}`);
    // Limited cleanup when previous data not available
    await this.removeUserFiles(userId);
    await this.cleanupUserSessions(userId);
  }

  private async auditDeletion(user: UserData, actor: any): Promise<void> {
    console.log(`Auditing deletion: ${user.email} deleted by ${actor.email}`);
    // Comprehensive audit with full user context
  }

  // Mock methods for example
  private async updateEmailSubscriptions(oldEmail: string, newEmail: string): Promise<void> {}
  private async sendEmailVerification(email: string): Promise<void> {}
  private async updateDisplayNameCaches(userId: string, name: string): Promise<void> {}
  private async updateSearchIndexes(userId: string, oldName: string, newName: string): Promise<void> {}
  private async suspendUserAccess(userId: string): Promise<void> {}
  private async restoreUserAccess(userId: string): Promise<void> {}
  private async removeUserFiles(userId: string): Promise<void> {}
  private async cleanupUserSessions(userId: string): Promise<void> {}
  private async removeEmailSubscriptions(email: string): Promise<void> {}
}

/**
 * Key Benefits of this Signature:
 * 
 * 1. ✅ **Separate Parameters**: Current and previous data as distinct parameters
 * 2. ✅ **Type Safety**: Both parameters are properly typed as EventPayload<T>
 * 3. ✅ **Easy Access**: No need to destructure - direct access to .data
 * 4. ✅ **Clear Intent**: Method signature clearly shows what data is available
 * 5. ✅ **Consistent Pattern**: Same signature for all event types
 * 6. ✅ **IDE Support**: Better autocomplete and type checking
 */ 