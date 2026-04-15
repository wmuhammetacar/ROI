import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublicOrderIdempotencyStatus, ServiceType, TableSessionStatus, TableStatus } from '@prisma/client';
import { APP_ROLES } from '../../common/constants/roles';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { BranchesService } from '../branches/branches.service';
import { CatalogService } from '../catalog/catalog.service';
import { AddCatalogOrderItemDto } from '../orders/dto/add-catalog-order-item.dto';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { OrdersService } from '../orders/orders.service';
import { OpenTableSessionDto } from '../table-sessions/dto/open-table-session.dto';
import { TableSessionsService } from '../table-sessions/table-sessions.service';
import { CreatePublicOrderDto } from './dto/create-public-order.dto';
import { PublicMenuQueryDto } from './dto/public-menu-query.dto';
import { REALTIME_EVENTS } from '../realtime/realtime-events.constants';
import { RealtimeEventsService } from '../realtime/realtime-events.service';

interface CreatePublicOrderOptions {
  idempotencyKey?: string;
}

@Injectable()
export class PublicOrderingService {
  private readonly idempotencyWindowMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly branchesService: BranchesService,
    private readonly catalogService: CatalogService,
    private readonly ordersService: OrdersService,
    private readonly tableSessionsService: TableSessionsService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {
    const windowMinutes = this.configService.get<number>('PUBLIC_ORDER_IDEMPOTENCY_WINDOW_MINUTES', 15);
    this.idempotencyWindowMs = Math.max(1, windowMinutes) * 60 * 1000;
  }

  async getPublicMenu(query: PublicMenuQueryDto) {
    await this.ensureBranchExists(query.branchId);

    const table = query.tableId
      ? await this.ensureTableInBranch(query.branchId, query.tableId)
      : null;

    const menu = await this.catalogService.getPosProducts(query.branchId, {});

    return {
      context: {
        branchId: query.branchId,
        tableId: table?.id ?? null,
        tableName: table?.name ?? null,
        tableStatus: table?.status ?? null,
        suggestedServiceType: table ? ServiceType.DINE_IN : ServiceType.TAKEAWAY,
      },
      menu,
    };
  }

  async createPublicOrder(dto: CreatePublicOrderDto, options: CreatePublicOrderOptions) {
    await this.ensureBranchExists(dto.branchId);
    const idempotencyKey = this.normalizeIdempotencyKey(options.idempotencyKey ?? dto.idempotencyKey);
    const clientSessionId = dto.clientSessionId?.trim() || undefined;

    const idempotency = await this.resolvePublicOrderIdempotency({
      branchId: dto.branchId,
      idempotencyKey,
      clientSessionId,
    });

    if (idempotency.replayOrderId) {
      const replayOrder = await this.ordersService.findById(dto.branchId, idempotency.replayOrderId);
      return {
        orderId: replayOrder.id,
        orderNumber: replayOrder.orderNumber,
        status: replayOrder.status,
        serviceType: replayOrder.serviceType,
        tableSessionId: replayOrder.tableSessionId,
        grandTotal: replayOrder.grandTotal,
        createdAt: replayOrder.createdAt,
        idempotentReplay: true,
      };
    }

    const actor = await this.resolveBranchSystemActor(dto.branchId, Boolean(dto.tableId));
    const tableSessionId = dto.tableId
      ? await this.resolvePublicTableSessionId(dto.branchId, dto.tableId, actor.sub)
      : undefined;
    const serviceType = dto.tableId ? ServiceType.DINE_IN : ServiceType.TAKEAWAY;

    const orderCreatePayload: CreateOrderDto = {
      serviceType,
      tableSessionId,
      customerName: dto.customerName?.trim() || undefined,
      customerPhone: dto.customerPhone?.trim() || undefined,
      notes: this.buildPublicOrderNote(dto.notes),
    };

    const created = await this.ordersService.create(dto.branchId, actor, orderCreatePayload);

    try {
      for (const item of dto.items) {
        const catalogItem: AddCatalogOrderItemDto = {
          productId: item.productId,
          variantId: item.variantId ?? null,
          quantity: item.quantity,
          notes: item.notes,
          modifierSelections: item.modifierSelections ?? [],
        };

        await this.ordersService.addCatalogItem(dto.branchId, actor, created.id, catalogItem);
      }
    } catch (error) {
      await this.cancelOrderSafely(dto.branchId, actor, created.id);
      await this.markPublicOrderIdempotencyFailed(idempotency.recordId, error);
      throw error;
    }

    const order = await this.ordersService.findById(dto.branchId, created.id);

    const response = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      serviceType: order.serviceType,
      tableSessionId: order.tableSessionId,
      grandTotal: order.grandTotal,
      createdAt: order.createdAt,
    };

    this.realtimeEvents.emitToBranch(dto.branchId, REALTIME_EVENTS.PUBLIC_ORDER_SUBMITTED, {
      orderId: response.orderId,
      orderNumber: response.orderNumber,
      tableSessionId: response.tableSessionId,
      serviceType: response.serviceType,
      status: response.status,
      grandTotal: response.grandTotal.toString(),
    });

    await this.markPublicOrderIdempotencyCompleted(idempotency.recordId, order.id);

    return response;
  }

  private normalizeIdempotencyKey(raw?: string) {
    const key = raw?.trim();
    if (!key) {
      throw new BadRequestException('x-idempotency-key header is required');
    }

    if (key.length > 120) {
      throw new BadRequestException('x-idempotency-key is too long');
    }

    return key;
  }

  private async resolvePublicOrderIdempotency(input: {
    branchId: string;
    idempotencyKey: string;
    clientSessionId?: string;
  }) {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.idempotencyWindowMs);

    const existing = await this.prisma.publicOrderIdempotency.findUnique({
      where: {
        branchId_idempotencyKey: {
          branchId: input.branchId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      select: {
        id: true,
        orderId: true,
        createdAt: true,
        clientSessionId: true,
      },
    });

    if (existing) {
      if (
        existing.clientSessionId &&
        input.clientSessionId &&
        existing.clientSessionId !== input.clientSessionId
      ) {
        throw new BadRequestException('Idempotency key is already used by a different client session');
      }

      if (existing.createdAt >= windowStart) {
        if (existing.orderId) {
          return {
            recordId: existing.id,
            replayOrderId: existing.orderId,
          };
        }

        throw new BadRequestException('Duplicate order request is already being processed');
      }

      await this.prisma.publicOrderIdempotency.delete({
        where: {
          id: existing.id,
        },
      });
    }

    let created: { id: string };
    try {
      created = await this.prisma.publicOrderIdempotency.create({
        data: {
          branchId: input.branchId,
          idempotencyKey: input.idempotencyKey,
          clientSessionId: input.clientSessionId,
        },
        select: {
          id: true,
        },
      });
    } catch {
      throw new BadRequestException('Duplicate order request is already being processed');
    }

    return {
      recordId: created.id,
      replayOrderId: null,
    };
  }

  private async markPublicOrderIdempotencyCompleted(recordId: string, orderId: string) {
    await this.prisma.publicOrderIdempotency.update({
      where: {
        id: recordId,
      },
      data: {
        orderId,
        status: PublicOrderIdempotencyStatus.COMPLETED,
        errorMessage: null,
      },
    });
  }

  private async markPublicOrderIdempotencyFailed(recordId: string, error: unknown) {
    const message = error instanceof Error && error.message ? error.message : 'Public order create failed';

    await this.prisma.publicOrderIdempotency.update({
      where: {
        id: recordId,
      },
      data: {
        status: PublicOrderIdempotencyStatus.FAILED,
        errorMessage: message.slice(0, 500),
      },
    });
  }

  private async resolvePublicTableSessionId(branchId: string, tableId: string, actorUserId: string) {
    const table = await this.ensureTableInBranch(branchId, tableId);

    if (table.status === TableStatus.OUT_OF_SERVICE) {
      throw new BadRequestException('Selected table is out of service');
    }

    const existing = await this.prisma.tableSession.findFirst({
      where: {
        branchId,
        tableId,
        status: TableSessionStatus.OPEN,
      },
      select: { id: true },
      orderBy: [{ openedAt: 'desc' }],
    });

    if (existing) {
      return existing.id;
    }

    const openPayload: OpenTableSessionDto = {
      tableId,
      guestCount: 1,
      notes: 'Opened by public QR self-order flow',
    };

    const opened = await this.tableSessionsService.open(branchId, actorUserId, openPayload);
    return opened.id;
  }

  private async resolveBranchSystemActor(branchId: string, forDineIn: boolean): Promise<AuthUser> {
    const users = await this.prisma.user.findMany({
      where: {
        branchId,
        userRoles: {
          some: {
            role: {
              name: {
                in: [APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER],
              },
            },
          },
        },
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    if (users.length === 0) {
      throw new NotFoundException('No operational user found in branch for public ordering');
    }

    const scoredUsers = users.map((user) => {
      const roleNames = user.userRoles.map((entry) => entry.role.name);
      const hasAdmin = roleNames.includes(APP_ROLES.ADMIN);
      const hasCashier = roleNames.includes(APP_ROLES.CASHIER);
      const hasWaiter = roleNames.includes(APP_ROLES.WAITER);

      let score = 10;
      if (hasAdmin) score = 1;
      else if (hasCashier) score = 2;
      else if (hasWaiter && forDineIn) score = 3;
      else if (hasWaiter) score = 4;

      return { user, roleNames, score };
    });

    const eligible = forDineIn
      ? scoredUsers
      : scoredUsers.filter((item) => item.roleNames.includes(APP_ROLES.ADMIN) || item.roleNames.includes(APP_ROLES.CASHIER));

    if (eligible.length === 0) {
      throw new NotFoundException(
        forDineIn
          ? 'No operational user found in branch for dine-in public ordering'
          : 'No admin/cashier user found in branch for takeaway public ordering',
      );
    }

    eligible.sort((a, b) => a.score - b.score);
    const chosen = eligible[0];

    const permissions = Array.from(
      new Set(
        chosen.user.userRoles.flatMap((entry) =>
          entry.role.rolePermissions.map((rp) => rp.permission.name),
        ),
      ),
    );

    return {
      sub: chosen.user.id,
      email: chosen.user.email,
      branchId: chosen.user.branchId,
      roles: chosen.roleNames,
      permissions,
    };
  }

  private async ensureTableInBranch(branchId: string, tableId: string) {
    const table = await this.prisma.table.findFirst({
      where: {
        id: tableId,
        branchId,
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    if (!table) {
      throw new NotFoundException('Table not found in selected branch');
    }

    return table;
  }

  private async ensureBranchExists(branchId: string) {
    const exists = await this.branchesService.exists(branchId);
    if (!exists) {
      throw new NotFoundException('Branch not found');
    }
  }

  private buildPublicOrderNote(rawNotes?: string) {
    const prefix = '[PUBLIC_QR_ORDER]';
    const normalized = rawNotes?.trim();
    if (!normalized) {
      return prefix;
    }

    return `${prefix} ${normalized}`.slice(0, 500);
  }

  private async cancelOrderSafely(branchId: string, actor: AuthUser, orderId: string) {
    try {
      await this.ordersService.cancel(branchId, actor, orderId);
    } catch {
      // best-effort rollback
    }
  }
}
