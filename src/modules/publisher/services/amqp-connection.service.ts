import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InfraLoggerService } from '@vcita/infra-nestjs';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { eventBusConfig } from '../../../configuration';

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

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    this.logger.debug('Initializing persistent AMQP connection');

    const { rabbitmqDsn, exchange } = eventBusConfig;
    if (!rabbitmqDsn) {
      throw new Error('RABBITMQ_DSN configuration is required');
    }

    this.connection = amqp.connect(rabbitmqDsn);
    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: async (channel) => {
        await channel.assertExchange(exchange, 'topic', { durable: true });
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
