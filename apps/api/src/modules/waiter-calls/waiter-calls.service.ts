import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { WaiterCallStatus, WaiterCallType } from '@prisma/client';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { REALTIME_EVENTS } from '../realtime/realtime-events.constants';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import { CreateWaiterCallDto } from './dto/create-waiter-call.dto';
import { ListWaiterCallsDto } from './dto/list-waiter-calls.dto';

@Injectable()
export class WaiterCallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  async list(branchId: string, query: ListWaiterCallsDto) {
    return this.prisma.waiterCall.findMany({
      where: {
        branchId,
        status: query.status,
      },
      include: {
        table: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: [{ requestedAt: 'desc' }],
      take: 100,
    });
  }

  async create(branchId: string, actor: AuthUser, dto: CreateWaiterCallDto) {
    const table = await this.prisma.table.findFirst({
      where: {
        id: dto.tableId,
        branchId,
      },
      select: { id: true, name: true },
    });

    if (!table) {
      throw new BadRequestException('Table not found in current branch');
    }

    const call = await this.prisma.waiterCall.create({
      data: {
        branchId,
        tableId: table.id,
        callType: dto.callType ?? WaiterCallType.WAITER,
        note: dto.note?.trim() || null,
      },
      include: {
        table: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'CREATE_WAITER_CALL',
      entity: 'waiter_call',
      metadata: {
        waiterCallId: call.id,
        branchId,
        tableId: table.id,
        callType: call.callType,
      },
    });

    this.realtimeEvents.emitToBranch(branchId, REALTIME_EVENTS.WAITER_CALL_UPDATED, {
      waiterCallId: call.id,
      status: call.status,
      callType: call.callType,
      tableId: call.tableId,
      tableName: call.table?.name,
      type: 'created',
    });

    return call;
  }

  async resolve(branchId: string, actor: AuthUser, id: string) {
    const existing = await this.prisma.waiterCall.findFirst({
      where: {
        id,
        branchId,
      },
      include: {
        table: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Waiter call not found');
    }

    if (existing.status === WaiterCallStatus.RESOLVED) {
      return existing;
    }

    const updated = await this.prisma.waiterCall.update({
      where: { id: existing.id },
      data: {
        status: WaiterCallStatus.RESOLVED,
        resolvedAt: new Date(),
      },
      include: {
        table: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'RESOLVE_WAITER_CALL',
      entity: 'waiter_call',
      metadata: {
        waiterCallId: updated.id,
        branchId,
        tableId: updated.tableId,
        callType: updated.callType,
      },
    });

    this.realtimeEvents.emitToBranch(branchId, REALTIME_EVENTS.WAITER_CALL_UPDATED, {
      waiterCallId: updated.id,
      status: updated.status,
      callType: updated.callType,
      tableId: updated.tableId,
      tableName: updated.table?.name,
      type: 'resolved',
    });

    return updated;
  }
}
