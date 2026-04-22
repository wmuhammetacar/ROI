import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AuditService } from '../../modules/audit/audit.service';
import { AuthUser } from '../interfaces/auth-user.interface';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request & { user?: AuthUser }>();
    const response = httpContext.getResponse<Response>();
    const startedAt = Date.now();
    const method = request.method.toUpperCase();

    if (!this.shouldAudit(method, request.originalUrl ?? request.url)) {
      return next.handle();
    }

    return next.handle().pipe(
      finalize(() => {
        const action = this.resolveActionType(request.method);
        const entity = this.resolveEntity(request.originalUrl ?? request.url);
        const userId = request.user?.sub ?? null;

        void this.auditService.logAction({
          userId,
          action,
          entity,
          metadata: {
            method: request.method,
            path: request.originalUrl ?? request.url,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
          },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
      }),
    );
  }

  private resolveEntity(path: string): string {
    const normalized = path.replace(/^\/api\/v1\//, '').split('?')[0];
    const [firstSegment] = normalized.split('/').filter(Boolean);
    return firstSegment ?? 'system';
  }

  private resolveActionType(method: string): string {
    const map: Record<string, string> = {
      GET: 'READ',
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };

    return map[method.toUpperCase()] ?? 'ACTION';
  }

  private shouldAudit(method: string, path: string): boolean {
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return false;
    }

    if (path.startsWith('/api/v1/public/menu')) {
      return false;
    }

    return true;
  }
}
