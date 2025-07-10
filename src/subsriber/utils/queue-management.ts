import { connect, ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';
import { InfraLoggerService } from '@vcita/infra-nestjs';

/**
 * Assert retry and error infrastructure using a single connection
 */
export async function assertSubscriberRetryInfrastructure(
  logger: InfraLoggerService,
  rabbitmqDsn: string,
  queueConfig: Record<string, any>,
  mainQueueOptions: Record<string, any>,
  retryQueueOptions: Record<string, any>,
  errorQueueOptions: Record<string, any>,
): Promise<void> {
  const connection = connect([rabbitmqDsn]);
  
  const channelWrapper: ChannelWrapper = connection.createChannel({
    setup: async (channel: ConfirmChannel) => {
      channel.once('error', (err) => {
        logger.error(`Channel error: ${err.message}`, err);
      });
      
      logger.debug(`Asserting retry infrastructure for subscriber: ${queueConfig.queueName}`);
      // Assert retry exchange
      await channel.assertExchange(queueConfig.retryExchangeName, 'topic', { durable: true });
      logger.debug(`Retry exchange ${queueConfig.retryExchangeName} asserted`);
      
      // Assert retry queue
      await channel.assertQueue(queueConfig.retryQueueName, retryQueueOptions);
      logger.debug(`Retry queue ${queueConfig.retryQueueName} asserted`);
      
      // Bind retry queue to retry exchange
      await channel.bindQueue(queueConfig.retryQueueName, queueConfig.retryExchangeName, '#');
      logger.debug(`Retry queue bound to retry exchange`);
      
      // Assert requeue exchange
      await channel.assertExchange(queueConfig.requeueExchangeName, 'topic', { durable: true });
      logger.debug(`Requeue exchange ${queueConfig.requeueExchangeName} asserted`);

      // Assert main queue
      await channel.assertQueue(queueConfig.queueName, mainQueueOptions);
      logger.debug(`Main queue ${queueConfig.queueName} asserted`);

      // Bind main queue to requeue exchange
      await channel.bindQueue(queueConfig.queueName, queueConfig.requeueExchangeName, queueConfig.routingKey);
      logger.debug(`Main queue bound to requeue exchange`);
      
      // Assert error exchange
      await channel.assertExchange(queueConfig.errorExchangeName, 'topic', { durable: true });
      logger.debug(`Error exchange ${queueConfig.errorExchangeName} asserted`);
      
      // Assert error queue
      await channel.assertQueue(queueConfig.errorQueueName, errorQueueOptions);
      logger.debug(`Error queue ${queueConfig.errorQueueName} asserted`);
      
      // Bind error queue to error exchange
      await channel.bindQueue(queueConfig.errorQueueName, queueConfig.errorExchangeName, queueConfig.routingKey);
      logger.debug(`Error queue bound to error exchange`);

      logger.debug(`Infrastructure setup completed for subscriber: ${queueConfig.queueName}`);
    },
  });

  try {
    await channelWrapper.waitForConnect();
    logger.log(`Subscriber infrastructure ready for: ${queueConfig.queueName}`);
  } catch (error) {
    logger.error(`Failed to assert subscriber infrastructure for: ${queueConfig.queueName}`, error);
    // Don't throw - infrastructure setup shouldn't block application startup
  } finally {
    try {
      await channelWrapper.close();
      logger.debug('Infrastructure ChannelWrapper closed');
    } catch (closeErr) {
      logger.warn(`Error closing infrastructure ChannelWrapper: ${closeErr.message}`);
    }

    try {
      await connection.close();
      logger.debug('Infrastructure Connection manager closed');
    } catch (closeErr) {
      logger.warn(`Error closing infrastructure connection manager: ${closeErr.message}`);
    }
  }
}