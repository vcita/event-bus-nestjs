export default () => ({
  eventBus: {
    rabbitmqDsn: process.env.RABBITMQ_DSN,
    appName: process.env.APP_NAME,
    exchange: process.env.EXCHANGE,
    legacy: {
      exchange: process.env.LEGACY_EXCHANGE,
    },
    retry: {
      defaultMaxRetries: parseInt(process.env.DEFAULT_MAX_RETRIES, 10),
      defaultRetryDelayMs: parseInt(process.env.DEFAULT_RETRY_DELAY_MS, 10),
    },
  },
});
