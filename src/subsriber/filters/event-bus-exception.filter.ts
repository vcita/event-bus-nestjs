import { ExceptionFilter, ArgumentsHost, Catch } from '@nestjs/common';
import { InfraLoggerService } from '@vcita/infra-nestjs';

@Catch()
export class EventBusExceptionFilter implements ExceptionFilter {
  private readonly logger = new InfraLoggerService(EventBusExceptionFilter.name);

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  catch(exception: Error, host: ArgumentsHost) {
    this.logger.error(`Error processing event: ${exception?.message}`, exception?.stack);
  }
}
