import { Injectable } from '@nestjs/common';
import { PaymentMethod, PaymentTransactionStatus, ProductionTicketItemStatus, RegisterShiftStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { isEffectivePaymentStatus } from '../payments/domain/payment.rules';

const PAYMENT_METHODS: PaymentMethod[] = [
  PaymentMethod.CASH,
  PaymentMethod.CARD,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.OTHER,
];

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async getDashboardSummary(branchId: string) {
    const [salesSummary, paymentMix, shiftsOverview, inventorySummary, ordersSummary, operationsSummary] =
      await Promise.all([
        this.getSalesSummary(branchId, {}),
        this.getPaymentMixSummary(branchId, {}),
        this.getShiftsOverview(branchId, { limit: 5 }),
        this.getInventorySummary(branchId, { limit: 5 }),
        this.getOrdersSummary(branchId),
        this.getOperationsSummary(branchId, { limit: 5 }),
      ]);

    return {
      salesSnapshot: salesSummary,
      paymentMixSnapshot: paymentMix,
      shiftSnapshot: shiftsOverview,
      inventoryRiskSnapshot: inventorySummary,
      ordersSnapshot: ordersSummary,
      operationsSnapshot: operationsSummary,
    };
  }

  async getSalesSummary(branchId: string, input: { shiftId?: string }) {
    const shift = input.shiftId
      ? await this.prisma.registerShift.findFirst({
          where: { id: input.shiftId, branchId },
        })
      : await this.getLatestClosedShift(branchId);

    if (!shift) {
      return {
        scope: { type: 'none' },
        summary: this.emptyPaymentSummary(),
      };
    }

    const payments = await this.prisma.paymentTransaction.findMany({
      where: {
        branchId,
        registerShiftId: shift.id,
      },
      include: {
        refunds: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const summary = this.buildPaymentSummary(payments);

    return {
      scope: {
        type: shift.status === RegisterShiftStatus.CLOSED ? 'latest_closed_shift' : 'selected_shift',
        shiftId: shift.id,
        status: shift.status,
        closedAt: shift.closedAt,
      },
      summary,
    };
  }

  async getPaymentMixSummary(branchId: string, input: { shiftId?: string }) {
    const sales = await this.getSalesSummary(branchId, input);

    return {
      scope: sales.scope,
      totalsByPaymentMethod: sales.summary.totalsByPaymentMethod,
      grossPaidTotal: sales.summary.grossPaidTotal,
      refundedTotal: sales.summary.refundedTotal,
      netPaidTotal: sales.summary.netPaidTotal,
    };
  }

  async getOrdersSummary(branchId: string) {
    const statusCounts = await this.prisma.order.groupBy({
      by: ['status'],
      where: { branchId },
      _count: { status: true },
    });

    const orderCountByStatus = statusCounts.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count.status;
      return acc;
    }, {});

    const totalOrders = statusCounts.reduce((acc, row) => acc + row._count.status, 0);

    return {
      totalOrders,
      orderCountByStatus,
    };
  }

  async getInventorySummary(branchId: string, input: { limit?: number }) {
    const summary = await this.inventoryService.getInventorySummary(branchId, {
      activeOnly: true,
      limit: input.limit ?? 20,
    });

    const lowestStock = [...summary.items]
      .sort((a, b) => Number(a.currentStock) - Number(b.currentStock))
      .slice(0, input.limit ?? 5);

    const [wasteCount, latestWaste] = await Promise.all([
      this.prisma.wasteRecord.count({ where: { branchId } }),
      this.prisma.wasteRecord.findFirst({
        where: { branchId },
        orderBy: [{ createdAt: 'desc' }],
        select: { createdAt: true },
      }),
    ]);

    return {
      totalIngredients: summary.totalIngredients,
      activeIngredients: summary.activeIngredients,
      inactiveIngredients: summary.totalIngredients - summary.activeIngredients,
      lowestStockItems: lowestStock,
      wasteRecordCount: wasteCount,
      latestWasteAt: latestWaste?.createdAt ?? null,
    };
  }

  async getOperationsSummary(branchId: string, input: { limit?: number }) {
    const [openShiftCount, recentShifts, productionCounts] = await Promise.all([
      this.prisma.registerShift.count({
        where: { branchId, status: RegisterShiftStatus.OPEN },
      }),
      this.prisma.registerShift.findMany({
        where: { branchId },
        orderBy: [{ openedAt: 'desc' }],
        take: input.limit ?? 5,
      }),
      this.prisma.productionTicketItem.groupBy({
        by: ['status'],
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
        _count: { status: true },
      }),
    ]);

    const productionStatusCounts = productionCounts.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count.status;
      return acc;
    }, {});

    return {
      openShiftCount,
      recentShifts,
      productionStatusCounts,
    };
  }

  async getShiftsOverview(branchId: string, input: { limit?: number }) {
    const [openShifts, recentShifts] = await Promise.all([
      this.prisma.registerShift.findMany({
        where: { branchId, status: RegisterShiftStatus.OPEN },
        orderBy: [{ openedAt: 'desc' }],
        take: input.limit ?? 10,
      }),
      this.prisma.registerShift.findMany({
        where: { branchId, status: RegisterShiftStatus.CLOSED },
        orderBy: [{ closedAt: 'desc' }],
        take: input.limit ?? 10,
      }),
    ]);

    return {
      openShiftCount: openShifts.length,
      closedShiftCount: recentShifts.length,
      openShifts,
      recentShifts,
    };
  }

  async getPaymentMix(branchId: string, input: { shiftId?: string }) {
    return this.getPaymentMixSummary(branchId, input);
  }

  private async getLatestClosedShift(branchId: string) {
    return this.prisma.registerShift.findFirst({
      where: { branchId, status: RegisterShiftStatus.CLOSED },
      orderBy: [{ closedAt: 'desc' }],
    });
  }

  private buildPaymentSummary(
    payments: Array<
      {
        paymentMethod: PaymentMethod;
        status: PaymentTransactionStatus;
        amount: { toString(): string };
        refunds: Array<{ amount: { toString(): string } }>;
      }
    >,
  ) {
    const totalsByPaymentMethod: Record<PaymentMethod, { gross: number; refunded: number; net: number; transactionCount: number }> = {
      CASH: { gross: 0, refunded: 0, net: 0, transactionCount: 0 },
      CARD: { gross: 0, refunded: 0, net: 0, transactionCount: 0 },
      BANK_TRANSFER: { gross: 0, refunded: 0, net: 0, transactionCount: 0 },
      OTHER: { gross: 0, refunded: 0, net: 0, transactionCount: 0 },
    };

    const transactionCounts: Record<PaymentTransactionStatus, number> = {
      COMPLETED: 0,
      VOIDED: 0,
      REFUNDED_PARTIAL: 0,
      REFUNDED_FULL: 0,
    };

    let grossPaidTotal = 0;
    let refundedTotal = 0;

    for (const payment of payments) {
      transactionCounts[payment.status] += 1;
      totalsByPaymentMethod[payment.paymentMethod].transactionCount += 1;

      const refundSum = payment.refunds.reduce((acc, refund) => acc + Number(refund.amount.toString()), 0);

      if (isEffectivePaymentStatus(payment.status)) {
        const amount = Number(payment.amount.toString());
        grossPaidTotal += amount;
        refundedTotal += refundSum;

        totalsByPaymentMethod[payment.paymentMethod].gross += amount;
        totalsByPaymentMethod[payment.paymentMethod].refunded += refundSum;
        totalsByPaymentMethod[payment.paymentMethod].net += amount - refundSum;
      }
    }

    const netPaidTotal = grossPaidTotal - refundedTotal;

    return {
      grossPaidTotal: grossPaidTotal.toString(),
      refundedTotal: refundedTotal.toString(),
      netPaidTotal: netPaidTotal.toString(),
      totalsByPaymentMethod: PAYMENT_METHODS.map((method) => ({
        paymentMethod: method,
        gross: totalsByPaymentMethod[method].gross.toString(),
        refunded: totalsByPaymentMethod[method].refunded.toString(),
        net: totalsByPaymentMethod[method].net.toString(),
        transactionCount: totalsByPaymentMethod[method].transactionCount,
      })),
      transactionCounts,
    };
  }

  private emptyPaymentSummary() {
    return {
      grossPaidTotal: '0',
      refundedTotal: '0',
      netPaidTotal: '0',
      totalsByPaymentMethod: PAYMENT_METHODS.map((method) => ({
        paymentMethod: method,
        gross: '0',
        refunded: '0',
        net: '0',
        transactionCount: 0,
      })),
      transactionCounts: {
        COMPLETED: 0,
        VOIDED: 0,
        REFUNDED_PARTIAL: 0,
        REFUNDED_FULL: 0,
      },
    };
  }
}
