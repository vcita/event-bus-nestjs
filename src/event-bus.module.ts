import { DynamicModule, Module } from '@nestjs/common';
import { AmqpConnectionService } from './services/amqp-connection.service';
import { EventBusPublisher } from './services/event-bus-publisher.service';
import { EventBusConfig } from './interfaces/config.interface';
import { EVENT_BUS_CONFIG } from './constants';

/**
 * Module providing event bus functionality for publishing events
 */
@Module({
  providers: [AmqpConnectionService, EventBusPublisher],
  exports: [EventBusPublisher],
})
export class EventBusModule {
  /**
   * Register the module with direct configuration
   */
  static forRoot(config: EventBusConfig): DynamicModule {
    return {
      module: EventBusModule,
      providers: [
        {
          provide: EVENT_BUS_CONFIG,
          useValue: config,
        },
        AmqpConnectionService,
        EventBusPublisher,
      ],
      exports: [EventBusPublisher],
    };
  }
}
