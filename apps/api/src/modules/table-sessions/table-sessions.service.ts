import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, TableSessionStatus, TableStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { REALTIME_EVENTS } from '../realtime/realtime-events.constants';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import { OpenTableSessionDto } from './dto/open-table-session.dto';
import { ensureTableAllowsSessionOpen } from './domain/table-session.rules';

@Injectable()
export class TableSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  async open(branchId: string, actorUserId: string, dto: OpenTableSessionDto) {
    const table = await this.prisma.table.findFirst({
      where: {
        id: dto.tableId,
        branchId,
      },
      select: {
        id: true,
        branchId: true,
        status: true,
      },
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    ensureTableAllowsSessionOpen(table.status);

    const openSession = await this.prisma.tableSession.findFirst({
      where: {
        tableId: table.id,
        branchId,
        status: TableSessionStatus.OPEN,
      },
      select: { id: true },
    });

    if (openSession) {
      throw new ConflictException('Table already has an OPEN session');
    }

    if (dto.assignedWaiterId) {
      const waiter = await this.prisma.user.findFirst({
        where: {
          id: dto.assignedWaiterId,
          branchId,
        },
        select: { id: true },
      });

      if (!waiter) {
        throw new NotFoundException('Assigned waiter not found in current branch');
      }
    }

    let session: { id: string };
    try {
      session = await this.prisma.$transaction(async (tx) => {
        const created = await tx.tableSession.create({
          data: {
            branchId,
            tableId: table.id,
            openedByUserId: actorUserId,
            assignedWaiterId: dto.assignedWaiterId,
            guestCount: dto.guestCount,
            status: TableSessionStatus.OPEN,
            openedAt: new Date(),
            notes: dto.notes,
          },
          select: {
            id: true,
          },
        });

        await tx.table.update({
          where: { id: table.id },
          data: {
            status: TableStatus.OCCUPIED,
          },
        });

        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Table already has an OPEN session');
      }
      throw error;
    }

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'OPEN_TABLE_SESSION',
      entity: 'table_session',
      metadata: {
        tableSessionId: session.id,
        tableId: table.id,
        branchId,
      },
    });

    this.realtimeEvents.emitToBranch(branchId, REALTIME_EVENTS.TABLE_UPDATED, {
      tableId: table.id,
      tableSessionId: session.id,
      status: TableStatus.OCCUPIED,
      reason: 'table_session_opened',
    });

    return this.findById(branchId, session.id);
  }

  async close(branchId: string, sessionId: string, actorUserId: string) {
    const session = await this.prisma.tableSession.findFirst({
      where: {
        id: sessionId,
        branchId,
      },
      include: {
        table: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Table session not found');
    }

    if (session.status !== TableSessionStatus.OPEN) {
      throw new ConflictException('Only OPEN table sessions can be closed');
    }

    const blockingOrderCount = await this.prisma.order.count({
      where: {
        tableSessionId: session.id,
        branchId,
        status: {
          notIn: [OrderStatus.PAID, OrderStatus.CANCELLED],
        },
      },
    });

    if (blockingOrderCount > 0) {
      throw new ConflictException('Cannot close session while there are unpaid or active orders');
    }

    const closedSession = await this.prisma.$transaction(async (tx) => {
      const updatedSession = await tx.tableSession.update({
        where: {
          id: session.id,
        },
        data: {
          status: TableSessionStatus.CLOSED,
          closedAt: new Date(),
        },
      });

      const openSessionCount = await tx.tableSession.count({
        where: {
          branchId,
          tableId: session.tableId,
          status: TableSessionStatus.OPEN,
        },
      });

      if (openSessionCount === 0) {
        await tx.table.update({
          where: {
            id: session.tableId,
          },
          data: {
            status: TableStatus.AVAILABLE,
          },
        });
      }

      return updatedSession;
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CLOSE_TABLE_SESSION',
      entity: 'table_session',
      metadata: {
        tableSessionId: session.id,
        tableId: session.tableId,
        branchId,
      },
    });

    this.realtimeEvents.emitToBranch(branchId, REALTIME_EVENTS.TABLE_UPDATED, {
      tableId: session.tableId,
      tableSessionId: closedSession.id,
      status: TableStatus.AVAILABLE,
      reason: 'table_session_closed',
    });

    return this.findById(branchId, closedSession.id);
  }

  async findById(branchId: string, sessionId: string) {
    const session = await this.prisma.tableSession.findFirst({
      where: {
        id: sessionId,
        branchId,
      },
      include: {
        table: true,
        openedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedWaiter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Table session not found');
    }

    return session;
  }

  async findOpenByTable(branchId: string, tableId: string) {
    const table = await this.prisma.table.findFirst({
      where: {
        id: tableId,
        branchId,
      },
      select: { id: true },
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    return this.prisma.tableSession.findFirst({
      where: {
        branchId,
        tableId,
        status: TableSessionStatus.OPEN,
      },
      include: {
        table: true,
      },
      orderBy: {
        openedAt: 'desc',
      },
    });
  }
}
