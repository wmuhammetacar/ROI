import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ErrorTrackingContext {
  source: string;
  requestId?: string;
  path?: string;
  method?: string;
  userId?: string;
  statusCode?: number;
}

@Injectable()
export class ErrorTrackerService {
  private readonly logger = new Logger(ErrorTrackerService.name);

  constructor(private readonly configService: ConfigService) {}

  captureException(error: unknown, context: ErrorTrackingContext) {
    const dsn = this.configService.get<string>('ERROR_TRACKING_DSN');
    const message = error instanceof Error ? error.message : String(error);

    this.logger.error(
      `[${context.source}] ${message} requestId=${context.requestId ?? '-'} status=${context.statusCode ?? '-'}`,
      error instanceof Error ? error.stack : undefined,
    );

    if (dsn) {
      // Hook point for Sentry or another vendor integration in production.
      this.logger.debug(`Error tracking DSN configured. Event captured for source=${context.source}`);
    }
  }
}

