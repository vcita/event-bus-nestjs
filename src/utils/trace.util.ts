import { v4 as uuidv4 } from 'uuid';
import { ContextStore } from '@vcita/infra-nestjs/dist/infra/utils/context-store.utils';

/**
 * Utility class for handling trace IDs in distributed tracing
 */
export class TraceUtil {
  /**
   * Generates a new trace ID with event prefix
   */
  private static generateTraceId(): string {
    return `event-${uuidv4()}`;
  }

  /**
   * Gets trace ID from current context or generates a new one
   */
  static getOrGenerateTraceId(): string {
    const context = ContextStore.getContext();
    return context?.named_tags?.trace_id || TraceUtil.generateTraceId();
  }
}
