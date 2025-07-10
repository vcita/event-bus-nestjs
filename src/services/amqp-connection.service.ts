import { Injectable, OnModuleDestroy, OnModuleInit, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InfraLoggerService } from '@vcita/infra-nestjs';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { EventBusConfig } from '../interfaces/config.interface';
import { EVENT_BUS_CONFIG } from '../constants';

const MOCKED_CHANNEL_WRAPPER: ChannelWrapper = {
  publish: async () => {
    // Mocked publish method for testing purposes
  },
} as unknown as ChannelWrapper;

/**
 * Service responsible for managing AMQP connection and channel lifecycle
 */
@Injectable()
export class AmqpConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new InfraLoggerService(AmqpConnectionService.name);

  private connection: AmqpConnectionManager;

  private channelWrapper: ChannelWrapper;

  private config: EventBusConfig;

  constructor(
    @Optional() private readonly configService?: ConfigService,
    @Optional() @Inject(EVENT_BUS_CONFIG) private readonly directConfig?: EventBusConfig,
  ) {
    if (directConfig) {
      this.config = directConfig;
    } else if (configService) {
      this.config = {
        rabbitmqDsn: configService.get<string>('eventBus.rabbitmqDsn'),
        sourceService: configService.get<string>('eventBus.sourceService'),
        exchangeName: configService.get<string>('eventBus.exchangeName'),
        defaultDomain: configService.get<string>('eventBus.defaultDomain'),
      };
    } else {
      throw new Error('Either ConfigService or EventBusConfig must be provided');
    }
  }

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    this.logger.debug('Initializing persistent AMQP connection');

    const { rabbitmqDsn, exchangeName } = this.config;
    if (!rabbitmqDsn) {
      throw new Error('RABBITMQ_DSN configuration is required');
    }

    this.connection = amqp.connect(rabbitmqDsn);
    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: async (channel) => {
        await channel.assertExchange(exchangeName, 'topic', { durable: true });
        return channel;
      },
    });

    this.connection.on('connect', () => {
      this.logger.debug('AMQP connection established');
    });

    this.connection.on('disconnect', (params) => {
      this.logger.warn('AMQP connection lost', params?.err?.message);
    });

    this.connection.on('connectFailed', (params) => {
      this.logger.error('AMQP connection failed', params?.err?.message);
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.debug('Closing persistent AMQP connection');

    if (this.channelWrapper) {
      await this.channelWrapper.close();
    }

    if (this.connection) {
      await this.connection.close();
    }
  }

  /**
   * Gets the channel wrapper for publishing messages
   */
  getChannelWrapper(): ChannelWrapper {
    if (process.env.NODE_ENV === 'test') {
      return MOCKED_CHANNEL_WRAPPER;
    }

    if (!this.channelWrapper) {
      throw new Error(
        'AMQP connection not initialized. Make sure the module is properly initialized.',
      );
    }
    return this.channelWrapper;
  }
}
