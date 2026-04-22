import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { NextFunction, Request, Response } from 'express';
import { NetworkPolicyService } from '../network/network-policy.service';

interface JwtBranchPayload {
  branchId?: string;
  sub?: string;
}

@Injectable()
export class InternalNetworkMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly networkPolicyService: NetworkPolicyService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const path = req.path;
    if (this.isPublicRoute(path)) {
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      next();
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtBranchPayload>(token);
      if (!payload.branchId) {
        next();
        return;
      }

      const ip = this.networkPolicyService.extractClientIp(req.headers['x-forwarded-for'] as string | undefined) ??
        this.networkPolicyService.extractClientIp(req.ip);

      await this.networkPolicyService.assertAllowed(payload.branchId, ip ?? undefined);
    } catch {
      // Let auth/guards decide token validity; only enforce when verifiable branch scope exists.
    }

    next();
  }

  private isPublicRoute(path: string) {
    return (
      path.startsWith('/api/v1/public-ordering') ||
      path.startsWith('/api/v1/health') ||
      path.startsWith('/api/v1/readiness') ||
      path === '/api/v1' ||
      path.startsWith('/api/v1/ui')
    );
  }
}
