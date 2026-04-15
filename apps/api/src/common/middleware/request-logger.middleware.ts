import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');
  private readonly enableLogs: boolean;
  private readonly excludeHealth: boolean;

  constructor(configService: ConfigService) {
    this.enableLogs = configService.get<boolean>('ENABLE_REQUEST_LOGS', true);
    this.excludeHealth = configService.get<boolean>('REQUEST_LOG_EXCLUDE_HEALTH', true);
  }

  use(request: Request, response: Response, next: NextFunction): void {
    if (!this.enableLogs) {
      next();
      return;
    }

    const startedAt = Date.now();
    const { method, originalUrl } = request;
    const requestId = request.headers['x-request-id']?.toString() ?? randomUUID();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    const isHealthRoute = originalUrl === '/api/v1/health' || originalUrl === '/api/v1/ready';
    if (this.excludeHealth && isHealthRoute) {
      next();
      return;
    }

    this.logger.log(`--> ${method} ${originalUrl} requestId=${requestId}`);

    response.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `<-- ${method} ${originalUrl} ${response.statusCode} ${durationMs}ms requestId=${requestId}`,
      );
    });

    next();
  }
}
