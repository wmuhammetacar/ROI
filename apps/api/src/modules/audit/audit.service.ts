import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { GetAuditLogsDto } from './dto/get-audit-logs.dto';

interface AuditLogInput {
  userId?: string | null;
  action: string;
  entity: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logAction(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId ?? null,
          action: input.action,
          entity: input.entity,
          metadata: input.metadata,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      });
    } catch (error) {
      this.logger.error('Failed to write audit log', error instanceof Error ? error.stack : undefined);
    }
  }

  async findAll(query: GetAuditLogsDto) {
    return this.prisma.auditLog.findMany({
      where: {
        userId: query.userId,
        action: query.action,
        entity: query.entity,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: query.limit,
    });
  }
}
