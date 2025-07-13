import { Module } from '@nestjs/common';
import { PublisherModule } from './modules/publisher/publisher.module';
import { SubscriberModule } from './modules/subscriber/subscriber.module';

/**
 * Event Bus Module
 * This module provides a complete event bus solution with both publishing and subscribing capabilities.
 *
 * @example
 * @Module({
 *   imports: [EventBusModule],
 * })
 * export class AppModule {}
 */
@Module({
  imports: [PublisherModule, SubscriberModule],
  exports: [PublisherModule, SubscriberModule],
})
export class EventBusModule {}
