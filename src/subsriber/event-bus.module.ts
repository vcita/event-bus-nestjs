import { Module } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from 'nestjs-redis';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import { ProductSubscriber } from './handlers/product.subscriber';
import { EventBusProcessingInterceptor } from './interceptors/event-bus-processing.interceptor';
import { EventBusMetricsService } from './services/event-bus-metrics.service';

@Module({
  imports: [
    ConfigModule,
    RedisModule,
    PrometheusModule.register({
      defaultMetrics: {
        enabled: false,
      },
    }),
    RabbitMQModule.forRootAsync(RabbitMQModule, {
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get('eventBus.rabbitmqDsn'),
        exchanges: [
          {
            name: configService.get('eventBus.exchange'),
            type: 'topic',
            options: {
              durable: true,
            },
          },
          {
            name: configService.get('eventBus.legacy.exchange'),
            type: 'topic',
            options: {
              durable: false, // Legacy events are not durable
            },
          },
        ],
      }),
    }),
  ],
  providers: [
    ProductSubscriber,
    EventBusProcessingInterceptor,
    EventBusMetricsService,
    makeCounterProvider({
      name: 'eventbus_events_total',
      help: 'Total number of events processed by the event bus',
      labelNames: [
        'status',
        'event_type',
        'domain',
        'entity',
        'action',
        'queue_name',
        'routing_key',
      ],
    }),
    makeHistogramProvider({
      name: 'eventbus_processing_duration_seconds',
      help: 'Time spent processing events',
      labelNames: ['event_type', 'domain', 'entity', 'action', 'queue_name', 'routing_key'],
    }),
    makeCounterProvider({
      name: 'eventbus_validation_failures_total',
      help: 'Total number of validation failures',
      labelNames: [
        'failure_type',
        'event_type',
        'domain',
        'entity',
        'action',
        'queue_name',
        'routing_key',
      ],
    }),
  ],
  exports: [RabbitMQModule, EventBusProcessingInterceptor, EventBusMetricsService],
})
export class EventBusModule {}
