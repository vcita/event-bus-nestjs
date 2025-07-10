import { DynamicModule, Module } from '@nestjs/common';
import { PublisherModule } from './modules/publisher/publisher.module';
import { EventBusConfig } from './interfaces/event-bus-config.interface';
import { EVENT_BUS_CONFIG } from './constants';

/**
 * Module providing event bus functionality for publishing events
 */
@Module({
  imports: [PublisherModule],
  exports: [PublisherModule],
})
export class EventBusModule {
  /**
   * Register the module with direct configuration
   */
  static forRoot(config: EventBusConfig): DynamicModule {
    return {
      module: EventBusModule,
      imports: [PublisherModule],
      providers: [
        {
          provide: EVENT_BUS_CONFIG,
          useValue: config,
        },
      ],
      exports: [PublisherModule],
    };
  }
}
