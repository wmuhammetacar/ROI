import { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';

function getConfigNumber(context: ExecutionContext, key: string, fallback: number) {
  const request = context.switchToHttp().getRequest<{ app?: { get?: (token: unknown) => ConfigService } }>();
  const configService = request?.app?.get?.(ConfigService);
  const value = configService?.get<number>(key, fallback);
  return Number.isFinite(value) ? Number(value) : fallback;
}

export const throttlePolicies = {
  auth: {
    default: {
      limit: (context: ExecutionContext) => Math.max(1, getConfigNumber(context, 'AUTH_RATE_LIMIT_MAX', 20)),
      ttl: (context: ExecutionContext) =>
        Math.max(1, getConfigNumber(context, 'RATE_LIMIT_TTL_SECONDS', 60)) * 1000,
    },
  },
  publicMenu: {
    default: {
      limit: (context: ExecutionContext) =>
        Math.max(1, getConfigNumber(context, 'PUBLIC_MENU_RATE_LIMIT_MAX', 90)),
      ttl: (context: ExecutionContext) =>
        Math.max(1, getConfigNumber(context, 'RATE_LIMIT_TTL_SECONDS', 60)) * 1000,
    },
  },
  publicOrder: {
    default: {
      limit: (context: ExecutionContext) =>
        Math.max(1, getConfigNumber(context, 'PUBLIC_RATE_LIMIT_MAX', 30)),
      ttl: (context: ExecutionContext) =>
        Math.max(1, getConfigNumber(context, 'RATE_LIMIT_TTL_SECONDS', 60)) * 1000,
    },
  },
  integrationTest: {
    default: {
      limit: (context: ExecutionContext) =>
        Math.max(1, getConfigNumber(context, 'INTEGRATION_TEST_RATE_LIMIT_MAX', 15)),
      ttl: (context: ExecutionContext) =>
        Math.max(1, getConfigNumber(context, 'RATE_LIMIT_TTL_SECONDS', 60)) * 1000,
    },
  },
} as const;

