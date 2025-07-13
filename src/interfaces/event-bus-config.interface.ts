/**
 * Configuration interface for direct config usage
 */
export interface EventBusConfig {
  rabbitmqDsn: string;
  appName: string;
  exchange: string;
  defaultDomain: string;
  legacy?: {
    exchange: string;
  };
  retry?: {
    defaultMaxRetries: number;
    defaultRetryDelayMs: number;
  };
}
