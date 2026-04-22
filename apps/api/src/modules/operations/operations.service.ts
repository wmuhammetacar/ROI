import { Injectable } from '@nestjs/common';
import { OrderStatus, ProductionTicketItemStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

const INACTIVE_ORDER_STATUSES = new Set<OrderStatus>([OrderStatus.CANCELLED, OrderStatus.PAID]);

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(branchId: string, orderLimit = 80) {
    const [tables, openSessions, activeOrdersRaw, todaysCompletedCount, paymentRows, productionItems] =
      await Promise.all([
        this.prisma.table.findMany({
          where: { branchId },
          select: {
            id: true,
            name: true,
            status: true,
            floorId: true,
            floor: { select: { id: true, name: true } },
          },
          orderBy: [{ name: 'asc' }],
        }),
        this.prisma.tableSession.findMany({
          where: {
            branchId,
            status: 'OPEN',
          },
          select: {
            id: true,
            tableId: true,
            openedAt: true,
            guestCount: true,
          },
        }),
        this.prisma.order.findMany({
          where: {
            branchId,
            status: {
              notIn: Array.from(INACTIVE_ORDER_STATUSES),
            },
          },
          include: {
            tableSession: {
              select: {
                id: true,
                tableId: true,
                table: {
                  select: { id: true, name: true },
                },
              },
            },
            items: {
              where: { status: 'ACTIVE' },
              select: {
                id: true,
                quantity: true,
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }],
          take: orderLimit,
        }),
        this.prisma.order.count({
          where: {
            branchId,
            status: OrderStatus.PAID,
            paidAt: {
              gte: this.startOfDay(),
            },
          },
        }),
        this.prisma.paymentTransaction.findMany({
          where: {
            branchId,
            createdAt: {
              gte: this.startOfDay(),
            },
          },
          select: {
            status: true,
            amount: true,
            refunds: {
              select: {
                amount: true,
              },
            },
          },
        }),
        this.prisma.productionTicketItem.findMany({
          where: {
            branchId,
            status: {
              in: [
                ProductionTicketItemStatus.QUEUED,
                ProductionTicketItemStatus.IN_PROGRESS,
                ProductionTicketItemStatus.READY,
              ],
            },
          },
          select: {
            station: {
              select: {
                code: true,
              },
            },
            status: true,
          },
        }),
      ]);

    const openSessionByTableId = new Map(openSessions.map((session) => [session.tableId, session]));

    const activeOrders = activeOrdersRaw.map((order) => {
      const itemCount = order.items.reduce((acc, item) => acc + Number(item.quantity), 0);
      return {
        id: order.id,
        status: order.status,
        orderNumber: order.orderNumber,
        grandTotal: order.grandTotal,
        tableSessionId: order.tableSessionId,
        tableId: order.tableSession?.tableId ?? null,
        tableName: order.tableSession?.table?.name ?? null,
        itemCount,
        createdAt: order.createdAt,
      };
    });

    const orderByTableSessionId = new Map<string, (typeof activeOrders)[number]>();
    for (const order of activeOrders) {
      if (order.tableSessionId && !orderByTableSessionId.has(order.tableSessionId)) {
        orderByTableSessionId.set(order.tableSessionId, order);
      }
    }

    const tablesPanel = tables.map((table) => {
      const openSession = openSessionByTableId.get(table.id);
      const order = openSession ? orderByTableSessionId.get(openSession.id) : undefined;
      return {
        id: table.id,
        name: table.name,
        status: table.status,
        floor: table.floor,
        openSessionId: openSession?.id ?? null,
        openedAt: openSession?.openedAt ?? null,
        guestCount: openSession?.guestCount ?? null,
        currentTotal: order?.grandTotal ?? '0',
        itemCount: order?.itemCount ?? 0,
        orderId: order?.id ?? null,
        orderStatus: order?.status ?? null,
      };
    });

    let todayRevenue = 0;
    for (const payment of paymentRows) {
      if (payment.status === 'VOIDED') {
        continue;
      }
      const gross = Number(payment.amount);
      const refunded = payment.refunds.reduce((acc, refund) => acc + Number(refund.amount), 0);
      todayRevenue += gross - refunded;
    }

    const activeUnpaidAmount = activeOrders
      .filter((order) => order.status !== OrderStatus.PAID)
      .reduce((acc, order) => acc + Number(order.grandTotal), 0);

    const kitchenBarStatus: Record<string, { queued: number; inProgress: number; ready: number }> = {
      BAR: { queued: 0, inProgress: 0, ready: 0 },
      KITCHEN: { queued: 0, inProgress: 0, ready: 0 },
    };

    for (const item of productionItems) {
      const stationCode = item.station?.code ?? 'KITCHEN';
      if (!kitchenBarStatus[stationCode]) {
        kitchenBarStatus[stationCode] = { queued: 0, inProgress: 0, ready: 0 };
      }

      if (item.status === ProductionTicketItemStatus.QUEUED) {
        kitchenBarStatus[stationCode].queued += 1;
      }
      if (item.status === ProductionTicketItemStatus.IN_PROGRESS) {
        kitchenBarStatus[stationCode].inProgress += 1;
      }
      if (item.status === ProductionTicketItemStatus.READY) {
        kitchenBarStatus[stationCode].ready += 1;
      }
    }

    return {
      branchId,
      generatedAt: new Date().toISOString(),
      tables: tablesPanel,
      liveOrders: activeOrders,
      salesSnapshot: {
        todayRevenue,
        activeUnpaidAmount,
        openOrderCount: activeOrders.length,
        completedOrderCount: todaysCompletedCount,
      },
      kitchenBarStatus,
    };
  }

  private startOfDay() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
}
