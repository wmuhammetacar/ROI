import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

interface ParsedIpv4Cidr {
  network: number;
  mask: number;
}

@Injectable()
export class NetworkPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async assertAllowed(branchId: string, sourceIp: string | undefined) {
    if (!this.isEnforced()) {
      return;
    }

    const normalizedSourceIp = this.normalizeIpv4(sourceIp);
    if (!normalizedSourceIp) {
      throw new ForbiddenException('Network access denied: source IP is invalid');
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { allowedNetworkCidrs: true },
    });

    if (!branch) {
      throw new ForbiddenException('Network access denied: unknown branch scope');
    }

    const allowList = this.normalizeAllowList(branch.allowedNetworkCidrs ?? []);
    if (allowList.length === 0) {
      return;
    }

    const sourceInt = this.ipv4ToInt(normalizedSourceIp);
    const isAllowed = allowList.some((entry) => {
      const parsed = this.parseIpv4Cidr(entry);
      return parsed ? (sourceInt & parsed.mask) === parsed.network : false;
    });

    if (!isAllowed) {
      throw new ForbiddenException('Network access denied for this venue branch');
    }
  }

  validateAndNormalizeCidrs(cidrs: string[]): string[] {
    const normalized = Array.from(new Set(cidrs.map((cidr) => cidr.trim()).filter(Boolean)));
    for (const cidr of normalized) {
      if (!this.parseIpv4Cidr(cidr)) {
        throw new ForbiddenException(`Invalid allowed network CIDR: ${cidr}`);
      }
    }
    return normalized;
  }

  extractClientIp(rawIp: string | string[] | undefined) {
    if (Array.isArray(rawIp)) {
      return this.normalizeIpv4(rawIp[0]);
    }
    return this.normalizeIpv4(rawIp);
  }

  private isEnforced() {
    const env = this.configService.get<string>('NODE_ENV', 'development');
    const explicit = this.configService.get<boolean>('INTERNAL_NETWORK_ENFORCE', env === 'production');
    return explicit;
  }

  private normalizeAllowList(cidrs: string[]) {
    return Array.from(new Set(cidrs.map((item) => item.trim()).filter(Boolean)));
  }

  private normalizeIpv4(rawIp: string | undefined | null) {
    if (!rawIp) return null;
    const candidate = rawIp.split(',')[0]?.trim() ?? '';
    if (!candidate) return null;

    const withoutV6Prefix = candidate.startsWith('::ffff:') ? candidate.slice(7) : candidate;
    const parts = withoutV6Prefix.split('.');
    if (parts.length !== 4) return null;
    for (const part of parts) {
      const value = Number(part);
      if (!Number.isInteger(value) || value < 0 || value > 255) {
        return null;
      }
    }
    return withoutV6Prefix;
  }

  private parseIpv4Cidr(cidr: string): ParsedIpv4Cidr | null {
    const [ipPart, prefixPart] = cidr.includes('/') ? cidr.split('/') : [cidr, '32'];
    const normalizedIp = this.normalizeIpv4(ipPart);
    if (!normalizedIp) {
      return null;
    }

    const prefix = Number(prefixPart);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
      return null;
    }

    const ipInt = this.ipv4ToInt(normalizedIp);
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    const network = ipInt & mask;

    return { network, mask };
  }

  private ipv4ToInt(ip: string) {
    return ip
      .split('.')
      .map((part) => Number(part))
      .reduce((acc, part) => ((acc << 8) + part) >>> 0, 0);
  }
}
