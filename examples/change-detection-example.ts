import { Injectable } from '@nestjs/common';
import { EventBusPublisher, SubscribeTo, EventPayload, EventHeaders } from '@vcita/event-bus-nestjs';
import { AuthorizationPayloadEntity } from '@vcita/oauth-client-nestjs';

interface UserData {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  lastLogin?: Date;
}

/**
 * Example service demonstrating how to publish events with previous data
 */
@Injectable()
export class UserService {
  constructor(private readonly eventBusPublisher: EventBusPublisher) {}

  async updateUser(userId: string, updates: Partial<UserData>, actor: any): Promise<UserData> {
    // Simulate getting current user state
    const currentUser: UserData = {
      id: userId,
      email: 'old@example.com',
      name: 'John Doe',
      status: 'inactive',
    };

    // Apply updates
    const updatedUser: UserData = {
      ...currentUser,
      ...updates,
    };

    // Save to database (simulated)
    await this.saveUser(updatedUser);

    // Publish event with previous state for change detection
    await this.eventBusPublisher.publish({
      entityType: 'user',
      eventType: 'updated',
      data: updatedUser,
      prevData: currentUser, // Required for updated events
      actor,
    });

    return updatedUser;
  }

  async deleteUser(userId: string, actor: any): Promise<void> {
    // Get current user state before deletion
    const currentUser: UserData = await this.getUser(userId);

    // Delete from database (simulated)
    await this.removeUser(userId);

    // Publish deletion event with previous state
    await this.eventBusPublisher.publish({
      entityType: 'user',
      eventType: 'deleted',
      data: { id: userId }, // Minimal data for deletion
      prevData: currentUser, // Required for deleted events (full previous state for audit)
      actor,
    });
  }

  async createUser(userData: Omit<UserData, 'id'>, actor: any): Promise<UserData> {
    const user: UserData = {
      id: this.generateId(),
      ...userData,
    };

    await this.saveUser(user);

    // For created events, no prevData is needed
    await this.eventBusPublisher.publish({
      entityType: 'user',
      eventType: 'created',
      data: user,
      // prevData not provided for created events
      actor,
    });

    return user;
  }

  private async saveUser(user: UserData): Promise<void> {
    // Database save logic
  }

  private async getUser(userId: string): Promise<UserData> {
    // Database retrieval logic
    return {} as UserData;
  }

  private async removeUser(userId: string): Promise<void> {
    // Database deletion logic
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

/**
 * Example subscriber demonstrating change detection with previous data
 */
@Injectable()
export class UserEventSubscriber {
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

    if (!previousUser) {
      console.log('No previous data available, processing all fields as changed');
      await this.processUserUpdate(currentUser);
      return;
    }

    console.log(`Processing user update for ${currentUser.id}`);

    // Check specific field changes
    if (currentUser.email !== previousUser.email) {
      console.log(`Email changed: ${previousUser.email} → ${currentUser.email}`);
      await this.handleEmailChange(currentUser.id, previousUser.email, currentUser.email);
    }

    if (currentUser.status !== previousUser.status) {
      console.log(`Status changed: ${previousUser.status} → ${currentUser.status}`);
      await this.handleStatusChange(currentUser.id, previousUser.status, currentUser.status);
    }

    if (currentUser.name !== previousUser.name) {
      console.log(`Name changed: ${previousUser.name} → ${currentUser.name}`);
      await this.handleNameChange(currentUser.id, previousUser.name, currentUser.name);
    }

    // Always process the update (for example, updating search indexes)
    await this.processUserUpdate(currentUser);
  }

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
      
      // Use previous data for cleanup operations
      await this.cleanupUserData(deletedUser);
      await this.sendDeletionNotification(deletedUser);
      
      // Audit the deletion with full context
      await this.auditUserDeletion(deletionInfo.id, deletedUser, auth.actor);
    } else {
      console.log(`User ${deletionInfo.id} deleted (no previous data available)`);
      await this.cleanupUserDataById(deletionInfo.id);
    }
  }

  private async handleEmailChange(userId: string, oldEmail: string, newEmail: string): Promise<void> {
    // Email-specific change logic
    console.log(`Updating email notifications for user ${userId}`);
    // - Update email subscription services
    // - Send verification email to new address
    // - Update external systems
  }

  private async handleStatusChange(userId: string, oldStatus: string, newStatus: string): Promise<void> {
    // Status-specific change logic
    console.log(`Processing status change for user ${userId}: ${oldStatus} → ${newStatus}`);
    
    if (newStatus === 'suspended') {
      // Handle suspension
      await this.suspendUserSessions(userId);
      await this.notifyAdmins(userId, 'suspended');
    } else if (oldStatus === 'suspended' && newStatus === 'active') {
      // Handle reactivation
      await this.restoreUserAccess(userId);
      await this.notifyUser(userId, 'account_reactivated');
    }
  }

  private async handleNameChange(userId: string, oldName: string, newName: string): Promise<void> {
    // Name-specific change logic
    console.log(`Updating display name for user ${userId}`);
    // - Update search indexes
    // - Update cached user profiles
    // - Send update to UI systems
  }

  private async processUserUpdate(user: UserData): Promise<void> {
    // General update processing
    console.log(`Processing general update for user ${user.id}`);
    // - Update search indexes
    // - Invalidate caches
    // - Update analytics
  }

  private async cleanupUserData(user: UserData): Promise<void> {
    // Cleanup using full user context
    console.log(`Cleaning up data for ${user.email}`);
  }

  private async cleanupUserDataById(userId: string): Promise<void> {
    // Cleanup with minimal context
    console.log(`Cleaning up data for user ID ${userId}`);
  }

  private async sendDeletionNotification(user: UserData): Promise<void> {
    // Send notifications with user context
  }

  private async auditUserDeletion(userId: string, deletedUser: UserData, actor: any): Promise<void> {
    // Comprehensive audit logging
    console.log(`Audit: User ${deletedUser.email} deleted by ${actor.email}`);
  }

  private async suspendUserSessions(userId: string): Promise<void> {
    // Suspend active sessions
  }

  private async restoreUserAccess(userId: string): Promise<void> {
    // Restore user access
  }

  private async notifyAdmins(userId: string, action: string): Promise<void> {
    // Notify administrators
  }

  private async notifyUser(userId: string, notificationType: string): Promise<void> {
    // Notify user
  }
} 