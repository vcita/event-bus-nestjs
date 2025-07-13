import { Module } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { RedisModule } from 'nestjs-redis';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import { ProductSubscriber } from './handlers/product.subscriber';
import { EventBusProcessingInterceptor } from './interceptors/event-bus-processing.interceptor';
import { EventBusMetricsService } from './services/event-bus-metrics.service';
import { eventBusConfig } from '../../configuration';

@Module({
  imports: [
    RedisModule,
    PrometheusModule.register({
      defaultMetrics: {
        enabled: false,
      },
    }),
    RabbitMQModule.forRoot(RabbitMQModule, {
      uri: eventBusConfig.rabbitmqDsn,
      exchanges: [
        {
          name: eventBusConfig.exchange,
          type: 'topic',
          options: {
            durable: true,
          },
        },
        {
          name: eventBusConfig.legacy?.exchange,
          type: 'topic',
          options: {
            durable: false, // Legacy events are not durable
          },
        },
      ],
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
})
export class SubscriberModule {}
