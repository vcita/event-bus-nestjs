import { DynamicModule, Module } from '@nestjs/common';
import { PublisherModule } from './modules/publisher/publisher.module';
import { EventBusConfig } from './interfaces/event-bus-config.interface';
import { EVENT_BUS_CONFIG } from './constants';
import { SubscriberModule } from './modules/subscriber/subscriber.module';

const modules = [PublisherModule, SubscriberModule];
/**
 * Module providing event bus functionality for publishing events
 */
@Module({
  imports: modules,
  exports: modules,
})
export class EventBusModule {
  /**
   * Register the module with direct configuration
   */
  static forRoot(config: EventBusConfig): DynamicModule {
    return {
      module: EventBusModule,
      imports: modules,
      providers: [
        {
          provide: EVENT_BUS_CONFIG,
          useValue: config,
        },
      ],
      exports: modules,
    };
  }
}
