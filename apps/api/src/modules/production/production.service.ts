import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderItemStatus,
  OrderStatus,
  Prisma,
  ProductionTicketItemStatus,
  ProductionTicketStatus,
} from '@prisma/client';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ORDER_EVENT_TYPES } from '../orders/domain/order-events.constants';
import { assertWaiterScope } from '../orders/domain/order.rules';
import { REALTIME_EVENTS } from '../realtime/realtime-events.constants';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import { ListProductionTicketsDto } from './dto/list-production-tickets.dto';
import { UpdateProductionTicketItemStatusDto } from './dto/update-production-ticket-item-status.dto';
import {
  assertValidProductionTicketItemTransition,
  deriveOrderStatusFromProduction,
  deriveProductionTicketStatus,
} from './domain/production.rules';

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  async sendOrderToStation(branchId: string, actor: AuthUser, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        branchId,
      },
      include: {
        items: {
          where: {
            status: OrderItemStatus.ACTIVE,
          },
          include: {
            productionTicketItems: {
              select: {
                id: true,
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    assertWaiterScope(actor, order.serviceType);

    if (order.status !== OrderStatus.DRAFT && order.status !== OrderStatus.PLACED) {
      throw new ConflictException('Only DRAFT or PLACED orders can be sent to station');
    }

    if (order.items.length === 0) {
      throw new BadRequestException('Order has no active items to send');
    }

    const manualItems = order.items.filter((item) => !item.productId);
    if (manualItems.length > 0) {
      throw new BadRequestException(
        `Order contains unsendable manual items: ${manualItems.map((item) => item.id).join(', ')}`,
      );
    }

    const unfiredItems = order.items.filter((item) => item.productionTicketItems.length === 0);

    if (unfiredItems.length === 0) {
      throw new ConflictException('No unfired eligible items found for station dispatch');
    }

    const productIds = Array.from(
      new Set(
        unfiredItems
          .map((item) => item.productId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const routes = await this.prisma.productStationRoute.findMany({
      where: {
        branchId,
        productId: {
          in: productIds,
        },
      },
      include: {
        station: {
          select: {
            id: true,
            name: true,
            isActive: true,
            branchId: true,
          },
        },
      },
    });

    const routeByProductId = new Map(routes.map((route) => [route.productId, route]));

    const missingRouteProductIds = productIds.filter((productId) => !routeByProductId.has(productId));
    if (missingRouteProductIds.length > 0) {
      throw new BadRequestException(
        `Missing station route for products: ${missingRouteProductIds.join(', ')}`,
      );
    }

    for (const route of routes) {
      if (route.station.branchId !== branchId) {
        throw new ConflictException('Cross-branch station routing detected');
      }

      if (!route.station.isActive) {
        throw new ConflictException(
          `Station ${route.station.name} is inactive and cannot receive production items`,
        );
      }
    }

    const groupedByStation = new Map<string, typeof unfiredItems>();

    for (const item of unfiredItems) {
      const route = routeByProductId.get(item.productId!);

      if (!route) {
        throw new BadRequestException(`No station route found for productId ${item.productId}`);
      }

      const current = groupedByStation.get(route.stationId);
      if (current) {
        current.push(item);
      } else {
        groupedByStation.set(route.stationId, [item]);
      }
    }

    const dispatchResult = await this.prisma.$transaction(async (tx) => {
      const lockedOrder = await tx.order.findFirst({
        where: {
          id: order.id,
          branchId,
        },
        select: {
          id: true,
          status: true,
          tableSessionId: true,
          serviceType: true,
        },
      });

      if (!lockedOrder) {
        throw new NotFoundException('Order not found');
      }

      if (lockedOrder.status !== OrderStatus.DRAFT && lockedOrder.status !== OrderStatus.PLACED) {
        throw new ConflictException('Order is no longer in a sendable state');
      }

      const concurrentDispatchCount = await tx.productionTicketItem.count({
        where: {
          orderItemId: {
            in: unfiredItems.map((item) => item.id),
          },
        },
      });

      if (concurrentDispatchCount > 0) {
        throw new ConflictException('Some order items were already dispatched by another process');
      }

      const now = new Date();
      const createdTickets: Array<{ ticketId: string; stationId: string; itemCount: number }> = [];

      for (const [stationId, items] of groupedByStation.entries()) {
        const ticket = await tx.productionTicket.create({
          data: {
            branchId,
            stationId,
            orderId: lockedOrder.id,
            tableSessionId: lockedOrder.tableSessionId,
            serviceType: lockedOrder.serviceType,
            status: ProductionTicketStatus.OPEN,
          },
        });

        createdTickets.push({
          ticketId: ticket.id,
          stationId,
          itemCount: items.length,
        });

        await this.createOrderEvent(tx, {
          orderId: lockedOrder.id,
          actorUserId: actor.sub,
          eventType: ORDER_EVENT_TYPES.PRODUCTION_TICKET_CREATED,
          payloadJson: {
            ticketId: ticket.id,
            stationId,
            itemCount: items.length,
          },
        });

        for (const item of items) {
          const createdItem = await tx.productionTicketItem.create({
            data: {
              productionTicketId: ticket.id,
              orderItemId: item.id,
              orderId: lockedOrder.id,
              branchId,
              stationId,
              productNameSnapshot: item.productNameSnapshot,
              variantNameSnapshot: item.variantNameSnapshot,
              notesSnapshot: item.notes,
              quantity: item.quantity,
              status: ProductionTicketItemStatus.QUEUED,
              firedAt: now,
            },
          });

          await tx.orderItem.update({
            where: {
              id: item.id,
            },
            data: {
              stationId,
            },
          });

          await this.createOrderEvent(tx, {
            orderId: lockedOrder.id,
            actorUserId: actor.sub,
            eventType: ORDER_EVENT_TYPES.PRODUCTION_ITEM_QUEUED,
            payloadJson: {
              ticketId: ticket.id,
              stationId,
              productionTicketItemId: createdItem.id,
              orderItemId: item.id,
            },
          });
        }
      }

      await tx.order.update({
        where: {
          id: lockedOrder.id,
        },
        data: {
          status: OrderStatus.SENT_TO_STATION,
        },
      });

      await this.createOrderEvent(tx, {
        orderId: lockedOrder.id,
        actorUserId: actor.sub,
        eventType: ORDER_EVENT_TYPES.ORDER_SENT_TO_STATION,
        payloadJson: {
          fromStatus: lockedOrder.status,
          toStatus: OrderStatus.SENT_TO_STATION,
          ticketCount: createdTickets.length,
          itemCount: unfiredItems.length,
          tickets: createdTickets,
        },
      });

      return {
        createdTickets,
      };
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'SEND_ORDER_TO_STATION',
      entity: 'order',
      metadata: {
        orderId: order.id,
        branchId,
        ticketCount: dispatchResult.createdTickets.length,
      },
    });

    const refreshedOrder = await this.prisma.order.findFirst({
      where: {
        id: order.id,
        branchId,
      },
      include: {
        productionTickets: {
          include: {
            items: {
              orderBy: [{ firedAt: 'asc' }, { createdAt: 'asc' }],
            },
          },
          orderBy: [{ createdAt: 'desc' }],
        },
      },
    });

    this.realtimeEvents.emitToBranch(branchId, REALTIME_EVENTS.ORDER_SENT_TO_STATION, {
      orderId: order.id,
      status: refreshedOrder?.status ?? OrderStatus.SENT_TO_STATION,
      ticketCount: dispatchResult.createdTickets.length,
      itemCount: dispatchResult.createdTickets.reduce((acc, row) => acc + row.itemCount, 0),
      tickets: dispatchResult.createdTickets,
    });

    for (const ticket of dispatchResult.createdTickets) {
      this.realtimeEvents.emitToBranch(branchId, REALTIME_EVENTS.PRODUCTION_TICKET_CREATED, {
        orderId: order.id,
        ticketId: ticket.ticketId,
        stationId: ticket.stationId,
        itemCount: ticket.itemCount,
      });

      this.realtimeEvents.emitToStation(
        branchId,
        ticket.stationId,
        REALTIME_EVENTS.PRODUCTION_TICKET_CREATED,
        {
          orderId: order.id,
          ticketId: ticket.ticketId,
          stationId: ticket.stationId,
          itemCount: ticket.itemCount,
        },
      );
    }

    return {
      orderId: order.id,
      status: refreshedOrder?.status ?? OrderStatus.SENT_TO_STATION,
      createdTickets: dispatchResult.createdTickets,
      productionTickets: refreshedOrder?.productionTickets ?? [],
    };
  }

  async listProductionTickets(branchId: string, query: ListProductionTicketsDto) {
    if (query.stationId) {
      await this.ensureStationInBranch(branchId, query.stationId);
    }

    return this.prisma.productionTicket.findMany({
      where: {
        branchId,
        stationId: query.stationId,
        orderId: query.orderId,
        status: query.status,
      },
      include: {
        station: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            serviceType: true,
            status: true,
            customerName: true,
            customerPhone: true,
            tableSessionId: true,
          },
        },
        tableSession: {
          include: {
            table: true,
          },
        },
        items: {
          orderBy: [{ firedAt: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: query.limit,
    });
  }

  async getProductionTicketById(branchId: string, ticketId: string) {
    const ticket = await this.prisma.productionTicket.findFirst({
      where: {
        id: ticketId,
        branchId,
      },
      include: {
        station: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            serviceType: true,
            status: true,
            customerName: true,
            customerPhone: true,
            tableSessionId: true,
          },
        },
        tableSession: {
          include: {
            table: true,
          },
        },
        items: {
          orderBy: [{ firedAt: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Production ticket not found');
    }

    return ticket;
  }

  async getStationProductionTickets(branchId: string, stationId: string) {
    await this.ensureStationInBranch(branchId, stationId);

    return this.prisma.productionTicket.findMany({
      where: {
        branchId,
        stationId,
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            serviceType: true,
            status: true,
            customerName: true,
            customerPhone: true,
            tableSessionId: true,
          },
        },
        tableSession: {
          include: {
            table: true,
          },
        },
        items: {
          orderBy: [{ firedAt: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async updateProductionTicketItemStatus(
    branchId: string,
    actor: AuthUser,
    itemId: string,
    dto: UpdateProductionTicketItemStatusDto,
  ) {
    const ticketItem = await this.prisma.productionTicketItem.findFirst({
      where: {
        id: itemId,
        branchId,
      },
      include: {
        productionTicket: {
          select: {
            id: true,
            status: true,
            stationId: true,
          },
        },
        order: {
          select: {
            id: true,
            status: true,
            serviceType: true,
          },
        },
      },
    });

    if (!ticketItem) {
      throw new NotFoundException('Production ticket item not found');
    }

    assertWaiterScope(actor, ticketItem.order.serviceType);
    assertValidProductionTicketItemTransition(ticketItem.status, dto.status);

    if (ticketItem.status === dto.status) {
      return this.getProductionTicketById(branchId, ticketItem.productionTicket.id);
    }

    const statusEventType = this.mapProductionItemStatusEventType(dto.status);

    const result = await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      const updateData: Prisma.ProductionTicketItemUpdateInput = {
        status: dto.status,
      };

      if (dto.status === ProductionTicketItemStatus.IN_PROGRESS) {
        updateData.startedAt = ticketItem.startedAt ?? now;
      }

      if (dto.status === ProductionTicketItemStatus.READY) {
        updateData.readyAt = ticketItem.readyAt ?? now;
      }

      if (dto.status === ProductionTicketItemStatus.COMPLETED) {
        updateData.completedAt = ticketItem.completedAt ?? now;
      }

      const updatedItem = await tx.productionTicketItem.update({
        where: {
          id: ticketItem.id,
        },
        data: updateData,
      });

      const ticketItems = await tx.productionTicketItem.findMany({
        where: {
          productionTicketId: ticketItem.productionTicketId,
        },
        select: {
          status: true,
        },
      });

      const nextTicketStatus = deriveProductionTicketStatus(ticketItems.map((item) => item.status));
      if (nextTicketStatus !== ticketItem.productionTicket.status) {
        await tx.productionTicket.update({
          where: {
            id: ticketItem.productionTicketId,
          },
          data: {
            status: nextTicketStatus,
          },
        });
      }

      await this.createOrderEvent(tx, {
        orderId: ticketItem.orderId,
        actorUserId: actor.sub,
        eventType: statusEventType,
        payloadJson: {
          ticketId: ticketItem.productionTicketId,
          stationId: ticketItem.stationId,
          productionTicketItemId: ticketItem.id,
          orderItemId: ticketItem.orderItemId,
          previousStatus: ticketItem.status,
          newStatus: dto.status,
          note: dto.note ?? null,
        },
      });

      const orderStatusRecord = await tx.order.findUnique({
        where: {
          id: ticketItem.orderId,
        },
        select: {
          status: true,
        },
      });

      if (!orderStatusRecord) {
        throw new NotFoundException('Order not found for production ticket item');
      }

      const allOrderProductionItemStatuses = await tx.productionTicketItem.findMany({
        where: {
          orderId: ticketItem.orderId,
          branchId,
        },
        select: {
          status: true,
        },
      });

      const nextOrderStatus = deriveOrderStatusFromProduction(
        orderStatusRecord.status,
        allOrderProductionItemStatuses.map((item) => item.status),
      );

      if (
        nextOrderStatus &&
        nextOrderStatus !== orderStatusRecord.status &&
        orderStatusRecord.status !== OrderStatus.CANCELLED &&
        orderStatusRecord.status !== OrderStatus.BILLED &&
        orderStatusRecord.status !== OrderStatus.PAID
      ) {
        await tx.order.update({
          where: {
            id: ticketItem.orderId,
          },
          data: {
            status: nextOrderStatus,
          },
        });

        await this.createOrderEvent(tx, {
          orderId: ticketItem.orderId,
          actorUserId: actor.sub,
          eventType: ORDER_EVENT_TYPES.ORDER_STATUS_CHANGED_BY_PRODUCTION,
          payloadJson: {
            fromStatus: orderStatusRecord.status,
            toStatus: nextOrderStatus,
            triggerProductionTicketItemId: ticketItem.id,
            triggerStatus: dto.status,
          },
        });
      }

      return {
        productionTicketId: ticketItem.productionTicketId,
        updatedItem,
      };
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'UPDATE_PRODUCTION_TICKET_ITEM_STATUS',
      entity: 'production_ticket_item',
      metadata: {
        productionTicketItemId: itemId,
        branchId,
        previousStatus: ticketItem.status,
        newStatus: dto.status,
      },
    });

    const refreshedTicket = await this.getProductionTicketById(branchId, result.productionTicketId);

    this.realtimeEvents.emitToBranch(branchId, REALTIME_EVENTS.PRODUCTION_ITEM_UPDATED, {
      orderId: ticketItem.orderId,
      ticketId: ticketItem.productionTicketId,
      stationId: ticketItem.stationId,
      productionItemId: ticketItem.id,
      previousStatus: ticketItem.status,
      nextStatus: dto.status,
      ticketStatus: refreshedTicket.status,
      orderStatus: refreshedTicket.order?.status ?? null,
    });

    this.realtimeEvents.emitToStation(
      branchId,
      ticketItem.stationId,
      REALTIME_EVENTS.PRODUCTION_ITEM_UPDATED,
      {
        orderId: ticketItem.orderId,
        ticketId: ticketItem.productionTicketId,
        stationId: ticketItem.stationId,
        productionItemId: ticketItem.id,
        previousStatus: ticketItem.status,
        nextStatus: dto.status,
        ticketStatus: refreshedTicket.status,
        orderStatus: refreshedTicket.order?.status ?? null,
      },
    );

    const nextOrderStatus = refreshedTicket.order?.status ?? null;
    if (nextOrderStatus && nextOrderStatus !== ticketItem.order.status) {
      this.realtimeEvents.emitToBranch(branchId, REALTIME_EVENTS.ORDER_STATUS_CHANGED, {
        orderId: ticketItem.orderId,
        previousStatus: ticketItem.order.status,
        nextStatus: nextOrderStatus,
        source: 'production',
      });
    }

    return refreshedTicket;
  }

  async getStationKdsQueue(branchId: string, stationId: string) {
    await this.ensureStationInBranch(branchId, stationId);

    const tickets = await this.prisma.productionTicket.findMany({
      where: {
        branchId,
        stationId,
        status: {
          in: [
            ProductionTicketStatus.OPEN,
            ProductionTicketStatus.IN_PROGRESS,
            ProductionTicketStatus.READY,
          ],
        },
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            serviceType: true,
            status: true,
            customerName: true,
            customerPhone: true,
            tableSessionId: true,
          },
        },
        tableSession: {
          include: {
            table: true,
          },
        },
        items: {
          where: {
            status: {
              in: [
                ProductionTicketItemStatus.QUEUED,
                ProductionTicketItemStatus.IN_PROGRESS,
                ProductionTicketItemStatus.READY,
              ],
            },
          },
          orderBy: [{ firedAt: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    return {
      stationId,
      generatedAt: new Date().toISOString(),
      tickets,
    };
  }

  async getStationKdsSummary(branchId: string, stationId: string) {
    await this.ensureStationInBranch(branchId, stationId);

    const [ticketCountsRaw, itemCountsRaw] = await Promise.all([
      this.prisma.productionTicket.groupBy({
        by: ['status'],
        where: {
          branchId,
          stationId,
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.productionTicketItem.groupBy({
        by: ['status'],
        where: {
          branchId,
          stationId,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const ticketStatusCounts: Record<ProductionTicketStatus, number> = {
      OPEN: 0,
      IN_PROGRESS: 0,
      READY: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    for (const row of ticketCountsRaw) {
      ticketStatusCounts[row.status] = row._count._all;
    }

    const itemStatusCounts: Record<ProductionTicketItemStatus, number> = {
      QUEUED: 0,
      IN_PROGRESS: 0,
      READY: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    for (const row of itemCountsRaw) {
      itemStatusCounts[row.status] = row._count._all;
    }

    return {
      stationId,
      ticketStatusCounts,
      itemStatusCounts,
      totals: {
        queuedTickets: ticketStatusCounts.OPEN,
        inProgressTickets: ticketStatusCounts.IN_PROGRESS,
        readyTickets: ticketStatusCounts.READY,
        queuedItems: itemStatusCounts.QUEUED,
        inProgressItems: itemStatusCounts.IN_PROGRESS,
        readyItems: itemStatusCounts.READY,
      },
    };
  }

  private mapProductionItemStatusEventType(status: ProductionTicketItemStatus): string {
    switch (status) {
      case ProductionTicketItemStatus.IN_PROGRESS:
        return ORDER_EVENT_TYPES.PRODUCTION_ITEM_STARTED;
      case ProductionTicketItemStatus.READY:
        return ORDER_EVENT_TYPES.PRODUCTION_ITEM_READY;
      case ProductionTicketItemStatus.COMPLETED:
        return ORDER_EVENT_TYPES.PRODUCTION_ITEM_COMPLETED;
      case ProductionTicketItemStatus.CANCELLED:
        return ORDER_EVENT_TYPES.PRODUCTION_ITEM_CANCELLED;
      default:
        throw new BadRequestException(`Unsupported production ticket item status event mapping: ${status}`);
    }
  }

  private async ensureStationInBranch(branchId: string, stationId: string) {
    const station = await this.prisma.station.findFirst({
      where: {
        id: stationId,
        branchId,
      },
      select: {
        id: true,
      },
    });

    if (!station) {
      throw new NotFoundException('Station not found in current branch');
    }

    return station;
  }

  private async createOrderEvent(
    tx: Prisma.TransactionClient,
    input: {
      orderId: string;
      eventType: string;
      actorUserId: string;
      payloadJson?: Prisma.InputJsonValue;
    },
  ) {
    await tx.orderEvent.create({
      data: {
        orderId: input.orderId,
        eventType: input.eventType,
        actorUserId: input.actorUserId,
        payloadJson: input.payloadJson,
      },
    });
  }
}
