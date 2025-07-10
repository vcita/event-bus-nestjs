import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EVENT_BUS_CONFIG } from 'src/constants';
import { EventBusConfig } from 'src/interfaces/event-bus-config.interface';

@Injectable()
export class EventBusConfigService {
  private config: EventBusConfig;

  constructor(
    @Optional() configService?: ConfigService,
    @Optional() @Inject(EVENT_BUS_CONFIG) directConfig?: EventBusConfig,
  ) {
    if (directConfig) {
      this.config = directConfig;
    } else if (configService) {
      this.config = configService.get('eventBus');
    } else {
      throw new Error('Either ConfigService or EventBusConfig must be provided');
    }
  }

  getConfig(): EventBusConfig {
    return this.config;
  }
}
