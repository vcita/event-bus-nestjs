import { Module } from '@nestjs/common';
import { AmqpConnectionService } from './services/amqp-connection.service';
import { EventBusPublisher } from './services/event-bus-publisher.service';

/**
 * Module providing event bus functionality for publishing events
 */
@Module({
  providers: [AmqpConnectionService, EventBusPublisher],
  exports: [EventBusPublisher],
})
export class EventBusModule {}
