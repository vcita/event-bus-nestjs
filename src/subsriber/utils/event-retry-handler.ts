import { ConsumeMessage, Channel } from 'amqplib';
import { InfraLoggerService } from '@vcita/infra-nestjs';

class EventError extends Error {
  eventUid?: string;
  attemptNumber?: number;
  shouldRetry: boolean;
  originalError?: Error;

  constructor(message: string) {
    super(message);
    this.shouldRetry = true; // Default to true for regular errors
  }
}

/**
 * Error class to indicate that an event should not be retried and should be sent straight to the error exchange
 */
export class NonRetryableError extends EventError {
  constructor(
    message: string,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = 'NonRetryableError';
    this.shouldRetry = false;
  }
}

/**
 * Internal error class to indicate that an event should be retried
 * This is used by the interceptor to signal retry attempts
 */
export class RetryError extends EventError {
  constructor(
    message: string,
    public readonly originalError: Error,
    public readonly attemptNumber: number,
  ) {
    super(message);
    this.name = 'RetryError';
    this.shouldRetry = true;
    this.attemptNumber = attemptNumber;
  }
}

export const RetryHeaders = {
  RETRY_LATEST_TIMESTAMP: 'x-retry-latest-timestamp',
  RETRY_ORIGINAL_ERROR: 'x-retry-original-error',
};

/**
 * Error handler that supports retry logic
 * - RetryError instances get requeued for retry with updated headers
 * - All other errors get sent to error exchange
 */
export function createEventRetryHandler(logger: InfraLoggerService, queueConfig: Record<string, any>) {
  return async (channel: Channel, msg: ConsumeMessage, error: Error): Promise<void> => {
    const eventUid = msg.properties.headers?.event_uid || 'unknown';

    try {
      if (error instanceof EventError && error.shouldRetry) {
        // Retry the message - NACK to route via DLX to retry exchange
        logger.log(`Requeuing event ${eventUid} for retry (attempt ${error.attemptNumber}) via NACK to retry exchange`);
        channel.nack(msg, false, false);
      } else {
        logger.warn(`Sending event ${eventUid} to error exchange: ${error.message}`);
        await publishToErrorExchange(channel, msg, queueConfig, error);
        channel.ack(msg);
      }
    } catch (handlerError) {
      logger.error(`Error in retry error handler for event ${eventUid}:`, handlerError);
      await publishToErrorExchange(channel, msg, queueConfig, handlerError);
      channel.ack(msg);
    }
  };
}

async function publishToErrorExchange(
  channel: Channel,
  originalMsg: ConsumeMessage,
  queueConfig: Record<string, any>,
  error: Error,
): Promise<void> {
  const now = new Date().toISOString();

  let errorSpecificHeaders: Record<string, any> = {};
  if (error instanceof NonRetryableError) {
    errorSpecificHeaders = {
      'x-non-retryable': true,
      [RetryHeaders.RETRY_ORIGINAL_ERROR]: error.originalError?.message || error.message,
    };
  } else {
    errorSpecificHeaders = {
      [RetryHeaders.RETRY_ORIGINAL_ERROR]: error.message,
    };
  }
  // Add retry metadata headers when publishing to error exchange
  const errorHeaders = {
    ...originalMsg.properties.headers,
    ...errorSpecificHeaders,
    [RetryHeaders.RETRY_LATEST_TIMESTAMP]: now,
  };
  await channel.publish(
    queueConfig.errorExchangeName,
    queueConfig.routingKey,
    originalMsg.content,
    {
      ...originalMsg.properties,
      headers: errorHeaders,
    }
  );
}

