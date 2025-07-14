import { EventBusConfig } from './interfaces/event-bus-config.interface';

export const eventBusConfig: EventBusConfig = {
  rabbitmqDsn: process.env.RABBITMQ_DSN,
  exchange: process.env.EVENT_BUS_EXCHANGE_NAME || 'event_bus',
  appName: process.env.APP_NAME,
  defaultDomain: process.env.EVENT_BUS_DEFAULT_DOMAIN,
  legacy: {
    exchange: process.env.EVENT_BUS_LEGACY_EXCHANGE || 'vcita.model_updates',
  },
  retry: {
    defaultMaxRetries: parseInt(process.env.EVENT_BUS_DEFAULT_MAX_RETRIES || '1', 10),
    defaultRetryDelayMs: parseInt(process.env.EVENT_BUS_DEFAULT_RETRY_DELAY_MS || '10000', 10),
  },
};
