/**
 * Configuration interface for direct config usage
 */
export interface EventBusConfig {
  rabbitmqDsn: string;
  sourceService: string;
  exchangeName: string;
  defaultDomain: string;
}
