import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { ErrorTrackerService } from '../services/error-tracker.service';

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly errorTracker: ErrorTrackerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const typedResponse = exceptionResponse as { message?: string | string[]; details?: unknown };
        message = typedResponse.message ?? message;
        details = typedResponse.details;
      }
    }

    if (isProduction && statusCode >= 500) {
      message = 'Internal server error';
      details = undefined;
    }

    const requestId = request.requestId ?? response.getHeader('x-request-id')?.toString();
    const userId = (request.user as { sub?: string } | undefined)?.sub;

    this.logger.error(
      `${request.method} ${request.url} -> ${statusCode} requestId=${requestId ?? '-'}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    this.errorTracker.captureException(exception, {
      source: 'http',
      requestId,
      path: request.url,
      method: request.method,
      userId,
      statusCode,
    });

    response.status(statusCode).json({
      statusCode,
      error: {
        code: HttpStatus[statusCode] ?? 'ERROR',
        message,
        details,
      },
      path: request.url,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
