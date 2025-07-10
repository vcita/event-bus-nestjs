import { Module } from '@nestjs/common';
import { AmqpConnectionService } from './services/amqp-connection.service';
import { EventBusPublisher } from './services/event-bus-publisher.service';

/**
 * Module providing event bus publishing functionality
 */
@Module({
  providers: [AmqpConnectionService, EventBusPublisher],
  exports: [EventBusPublisher],
})
export class PublisherModule {}
