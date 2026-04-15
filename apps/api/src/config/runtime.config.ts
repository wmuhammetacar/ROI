import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3100',
  'http://127.0.0.1:3100',
  'http://localhost:3200',
  'http://127.0.0.1:3200',
  'http://localhost:3201',
  'http://127.0.0.1:3201',
  'http://localhost:3300',
  'http://127.0.0.1:3300',
  'http://localhost:3400',
  'http://127.0.0.1:3400',
  'http://localhost:3401',
  'http://127.0.0.1:3401',
] as const;

function parseCsv(value?: string | null): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function resolveCorsOrigins(configService: ConfigService): string[] {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const configured = parseCsv(configService.get<string>('CORS_ORIGINS'));

  if (configured.length > 0) {
    return configured;
  }

  if (nodeEnv === 'production') {
    throw new Error('CORS_ORIGINS must be configured in production');
  }

  return [...DEFAULT_DEV_ORIGINS];
}

export function resolveRealtimeAllowedOrigins(configService: ConfigService): string[] {
  const explicit = parseCsv(configService.get<string>('REALTIME_ALLOWED_ORIGINS'));
  if (explicit.length > 0) {
    return explicit;
  }

  return resolveCorsOrigins(configService);
}

export function logSafeRuntimeSummary(configService: ConfigService, logger: Logger) {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const port = configService.get<number>('PORT', 3000);
  const trustProxy = configService.get<boolean>('TRUST_PROXY', false);
  const rateLimitTtl = configService.get<number>('RATE_LIMIT_TTL_SECONDS', 60);
  const rateLimitMax = configService.get<number>('RATE_LIMIT_MAX', 200);
  const corsOrigins = resolveCorsOrigins(configService);
  const realtimeOrigins = resolveRealtimeAllowedOrigins(configService);

  logger.log(
    `Runtime config: env=${nodeEnv} port=${port} trustProxy=${String(trustProxy)} ` +
      `rateLimit=${rateLimitMax}/${rateLimitTtl}s corsOrigins=${corsOrigins.length} realtimeOrigins=${realtimeOrigins.length}`,
    'Bootstrap',
  );
}

