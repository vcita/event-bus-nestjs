import { Injectable } from '@nestjs/common';
import { AuthorizationPayloadEntity } from '@vcita/oauth-client-nestjs';
import { InfraLoggerService } from '@vcita/infra-nestjs';
import { SubscribeTo } from '../decorators/subscribe-to.decorator';
import { LegacySubscribeTo } from '../decorators/legacy-subscribe-to.decorator';
import { EventHeaders, EventPayload } from '../../interfaces/event.interface';
import { NonRetryableError } from '../utils/event-retry-handler';

@Injectable()
export class ProductSubscriber {
  private readonly logger = new InfraLoggerService(ProductSubscriber.name);

  @SubscribeTo({
    domain: 'payments',
    entity: 'product',
    action: '*',
    queue: 'availability-test-queue',
  })
  async handleProductCreated(
    auth: AuthorizationPayloadEntity,
    event: EventPayload<any>,
    headers: EventHeaders,
  ): Promise<void> {
    this.logger.log(
      `Starting to process event: ${headers.event_uid} for resource ${event.data.id}: ${JSON.stringify(event.data)} with routing key: ${JSON.stringify(headers)}`,
    );

    // throw new Error(`${headers.event_uid} not implemented`);
    throw new NonRetryableError(`${headers.event_uid} not implemented`);

    this.logger.log(`Successfully processed resource event: ${headers.event_uid}`);
  }

  @LegacySubscribeTo({
    routingKey: 'model_change.product',
    retry: { count: 1, delayMs: 5000 },
  })
  async handleLegacyProductEvent(payload: unknown, headers: any): Promise<void> {
    this.logger.log(`Processing legacy product event with headers: ${JSON.stringify(headers)}`);
    this.logger.log(`Legacy payload: ${JSON.stringify(payload)}`);

    // Process legacy product event - no validation, no actor context
    this.logger.log('Legacy product event processed successfully');
  }
}
