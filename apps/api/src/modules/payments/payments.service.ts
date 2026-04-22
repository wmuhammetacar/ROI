import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentTransactionStatus,
  Prisma,
  RegisterShiftStatus,
} from '@prisma/client';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { ORDER_EVENT_TYPES } from '../orders/domain/order-events.constants';
import { assertWaiterScope } from '../orders/domain/order.rules';
import { REALTIME_EVENTS } from '../realtime/realtime-events.constants';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import { CloseRegisterShiftDto } from './dto/close-register-shift.dto';
import { CreateOrderPaymentDto } from './dto/create-order-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { ListRegisterShiftsDto } from './dto/list-register-shifts.dto';
import { OpenRegisterShiftDto } from './dto/open-register-shift.dto';
import { VoidPaymentDto } from './dto/void-payment.dto';
import {
  assertOrderIsBillable,
  assertOrderIsPayableForSettlement,
  isEffectivePaymentStatus,
} from './domain/payment.rules';

interface OrderFinancialSnapshot {
  grandTotal: Prisma.Decimal;
  paidGrossTotal: Prisma.Decimal;
  refundedTotal: Prisma.Decimal;
  netPaidTotal: Prisma.Decimal;
  outstandingBalance: Prisma.Decimal;
}

const EFFECTIVE_PAYMENT_STATUSES: PaymentTransactionStatus[] = [
  PaymentTransactionStatus.COMPLETED,
  PaymentTransactionStatus.REFUNDED_PARTIAL,
  PaymentTransactionStatus.REFUNDED_FULL,
];

const PAYMENT_METHODS: PaymentMethod[] = [
  PaymentMethod.CASH,
  PaymentMethod.CARD,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.OTHER,
];

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly inventoryService: InventoryService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  async openRegisterShift(branchId: string, actorUserId: string, dto: OpenRegisterShiftDto) {
    const openingCashAmount = new Prisma.Decimal(dto.openingCashAmount);

    let shift: { id: string };
    try {
      shift = await this.prisma.$transaction(async (tx) => {
        // Policy: one OPEN shift per user per branch to avoid double-cashier sessions.
        const existingOpenShift = await tx.registerShift.findFirst({
          where: {
            branchId,
            openedByUserId: actorUserId,
            status: RegisterShiftStatus.OPEN,
          },
          select: {
            id: true,
          },
        });

        if (existingOpenShift) {
          throw new ConflictException('User already has an OPEN register shift in this branch');
        }

        return tx.registerShift.create({
          data: {
            branchId,
            openedByUserId: actorUserId,
            openingCashAmount,
            status: RegisterShiftStatus.OPEN,
            notes: dto.notes,
            openedAt: new Date(),
          },
          select: {
            id: true,
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('User already has an OPEN register shift in this branch');
      }
      throw error;
    }

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'OPEN_REGISTER_SHIFT',
      entity: 'register_shift',
      metadata: {
        registerShiftId: shift.id,
        branchId,
        openingCashAmount: openingCashAmount.toString(),
      },
    });

    return this.getRegisterShiftById(branchId, shift.id);
  }

  async closeRegisterShift(
    branchId: string,
    shiftId: string,
    actorUserId: string,
    dto: CloseRegisterShiftDto,
  ) {
    const actualCashAmount = new Prisma.Decimal(dto.closingCashAmountActual);

    const closedShift = await this.prisma.$transaction(async (tx) => {
      const shift = await tx.registerShift.findFirst({
        where: {
          id: shiftId,
          branchId,
        },
        select: {
          id: true,
          openingCashAmount: true,
          status: true,
          notes: true,
        },
      });

      if (!shift) {
        throw new NotFoundException('Register shift not found');
      }

      if (shift.status !== RegisterShiftStatus.OPEN) {
        throw new ConflictException('Register shift is already closed');
      }

      const closingCashAmountExpected = await this.computeShiftExpectedCashTx(tx, shift.id, shift.openingCashAmount);
      const varianceAmount = actualCashAmount.minus(closingCashAmountExpected);

      return tx.registerShift.update({
        where: {
          id: shift.id,
        },
        data: {
          status: RegisterShiftStatus.CLOSED,
          closedByUserId: actorUserId,
          closedAt: new Date(),
          closingCashAmountExpected,
          closingCashAmountActual: actualCashAmount,
          varianceAmount,
          notes: dto.notes ?? shift.notes,
        },
      });
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CLOSE_REGISTER_SHIFT',
      entity: 'register_shift',
      metadata: {
        registerShiftId: closedShift.id,
        branchId,
        closingCashAmountExpected: closedShift.closingCashAmountExpected?.toString() ?? null,
        closingCashAmountActual: closedShift.closingCashAmountActual?.toString() ?? null,
        varianceAmount: closedShift.varianceAmount?.toString() ?? null,
      },
    });

    return this.getRegisterShiftById(branchId, closedShift.id);
  }

  async getRegisterShiftById(branchId: string, shiftId: string) {
    const shift = await this.prisma.registerShift.findFirst({
      where: {
        id: shiftId,
        branchId,
      },
      include: {
        openedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        closedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!shift) {
      throw new NotFoundException('Register shift not found');
    }

    return shift;
  }

  async getCurrentOpenRegisterShift(branchId: string, actorUserId: string) {
    return this.prisma.registerShift.findFirst({
      where: {
        branchId,
        openedByUserId: actorUserId,
        status: RegisterShiftStatus.OPEN,
      },
      include: {
        openedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        openedAt: 'desc',
      },
    });
  }

  async listRegisterShifts(branchId: string, query: ListRegisterShiftsDto) {
    return this.prisma.registerShift.findMany({
      where: {
        branchId,
        status: query.status,
        openedByUserId: query.openedByUserId,
      },
      include: {
        openedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        closedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ openedAt: 'desc' }],
      take: query.limit,
    });
  }

  async billOrder(branchId: string, actor: AuthUser, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        branchId,
      },
      select: {
        id: true,
        status: true,
        serviceType: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    assertWaiterScope(actor, order.serviceType);
    assertOrderIsBillable(order.status);

    const result = await this.prisma.$transaction(async (tx) => {
      const lockedOrder = await tx.order.findFirst({
        where: {
          id: order.id,
          branchId,
        },
        select: {
          id: true,
          status: true,
          grandTotal: true,
          billedAt: true,
        },
      });

      if (!lockedOrder) {
        throw new NotFoundException('Order not found');
      }

      if (lockedOrder.status === OrderStatus.CANCELLED) {
        throw new ConflictException('Cancelled order cannot be billed');
      }

      if (lockedOrder.status === OrderStatus.READY || lockedOrder.status === OrderStatus.SERVED) {
        const billedAt = lockedOrder.billedAt ?? new Date();

        await tx.order.update({
          where: {
            id: lockedOrder.id,
          },
          data: {
            status: OrderStatus.BILLED,
            billedAt,
          },
        });

        await this.createOrderEvent(tx, {
          orderId: lockedOrder.id,
          actorUserId: actor.sub,
          eventType: ORDER_EVENT_TYPES.ORDER_BILLED,
          payloadJson: {
            fromStatus: lockedOrder.status,
            toStatus: OrderStatus.BILLED,
            billedAt: billedAt.toISOString(),
            trigger: 'EXPLICIT_BILL',
          },
        });
      }

      const financial = await this.computeOrderFinancialSnapshotTx(tx, lockedOrder.id, lockedOrder.grandTotal);

      return {
        orderId: lockedOrder.id,
        financial,
      };
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'BILL_ORDER',
      entity: 'order',
      metadata: {
        orderId,
        branchId,
      },
    });

    const refreshedOrder = await this.prisma.order.findFirst({
      where: {
        id: order.id,
        branchId,
      },
      select: {
        id: true,
        status: true,
        billedAt: true,
        paidAt: true,
      },
    });

    const response = {
      orderId: result.orderId,
      status: refreshedOrder?.status,
      billedAt: refreshedOrder?.billedAt,
      paidAt: refreshedOrder?.paidAt,
      financial: this.serializeFinancialSnapshot(result.financial),
    };

    if (refreshedOrder?.status === OrderStatus.BILLED) {
      this.realtimeEvents.emitToBranch(branchId, REALTIME_EVENTS.ORDER_STATUS_CHANGED, {
        orderId,
        previousStatus: order.status,
        nextStatus: refreshedOrder.status,
        billedAt: refreshedOrder.billedAt?.toISOString() ?? null,
        paidAt: refreshedOrder.paidAt?.toISOString() ?? null,
      });
    }

    return response;
  }

  async createOrderPayment(
    branchId: string,
    actor: AuthUser,
    orderId: string,
    dto: CreateOrderPaymentDto,
  ) {
    const amount = new Prisma.Decimal(dto.amount);

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        branchId,
      },
      select: {
        id: true,
        status: true,
        serviceType: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    assertWaiterScope(actor, order.serviceType);

    const transactionResult = await this.prisma.$transaction(async (tx) => {
      const lockedOrder = await tx.order.findFirst({
        where: {
          id: order.id,
          branchId,
        },
        select: {
          id: true,
          status: true,
          grandTotal: true,
          billedAt: true,
          paidAt: true,
        },
      });

      if (!lockedOrder) {
        throw new NotFoundException('Order not found');
      }

      if (lockedOrder.status === OrderStatus.CANCELLED) {
        throw new ConflictException('Cancelled order cannot receive payments');
      }

      assertOrderIsPayableForSettlement(lockedOrder.status);

      const shift = await tx.registerShift.findFirst({
        where: {
          id: dto.registerShiftId,
          branchId,
        },
        select: {
          id: true,
          status: true,
          openedByUserId: true,
        },
      });

      if (!shift) {
        throw new NotFoundException('Register shift not found in current branch');
      }

      if (shift.status !== RegisterShiftStatus.OPEN) {
        throw new ConflictException('Payments can only be recorded against OPEN register shifts');
      }

      if (lockedOrder.status === OrderStatus.READY || lockedOrder.status === OrderStatus.SERVED) {
        const billedAt = lockedOrder.billedAt ?? new Date();

        await tx.order.update({
          where: {
            id: lockedOrder.id,
          },
          data: {
            status: OrderStatus.BILLED,
            billedAt,
          },
        });

        await this.createOrderEvent(tx, {
          orderId: lockedOrder.id,
          actorUserId: actor.sub,
          eventType: ORDER_EVENT_TYPES.ORDER_BILLED,
          payloadJson: {
            fromStatus: lockedOrder.status,
            toStatus: OrderStatus.BILLED,
            billedAt: billedAt.toISOString(),
            trigger: 'AUTO_ON_PAYMENT',
          },
        });
      }

      const financialBefore = await this.computeOrderFinancialSnapshotTx(
        tx,
        lockedOrder.id,
        lockedOrder.grandTotal,
      );

      if (financialBefore.outstandingBalance.equals(0)) {
        throw new ConflictException('Order is already fully paid');
      }

      if (amount.greaterThan(financialBefore.outstandingBalance)) {
        throw new ConflictException(
          `Payment amount exceeds outstanding balance (${financialBefore.outstandingBalance.toString()})`,
        );
      }

      const payment = await tx.paymentTransaction.create({
        data: {
          branchId,
          orderId: lockedOrder.id,
          registerShiftId: shift.id,
          paymentMethod: dto.paymentMethod,
          amount,
          status: PaymentTransactionStatus.COMPLETED,
          referenceNo: dto.referenceNo,
          notes: dto.notes,
          createdByUserId: actor.sub,
        },
      });

      await this.createOrderEvent(tx, {
        orderId: lockedOrder.id,
        actorUserId: actor.sub,
        eventType: ORDER_EVENT_TYPES.PAYMENT_RECORDED,
        payloadJson: {
          paymentId: payment.id,
          shiftId: shift.id,
          method: payment.paymentMethod,
          amount: payment.amount.toString(),
          status: payment.status,
          referenceNo: payment.referenceNo,
          note: payment.notes,
        },
      });

      const financialOutcome = await this.recomputeOrderFinancialStatusTx(tx, {
        branchId,
        orderId: lockedOrder.id,
        actorUserId: actor.sub,
        reason: 'PAYMENT_RECORDED',
      });

      return {
        payment,
        financialOutcome,
      };
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'RECORD_ORDER_PAYMENT',
      entity: 'payment_transaction',
      metadata: {
        orderId,
        paymentId: transactionResult.payment.id,
        registerShiftId: dto.registerShiftId,
        paymentMethod: dto.paymentMethod,
        amount: amount.toString(),
      },
    });

    this.realtimeEvents.emitToBranch(branchId, REALTIME_EVENTS.PAYMENT_RECORDED, {
      orderId,
      paymentId: transactionResult.payment.id,
      paymentMethod: transactionResult.payment.paymentMethod,
      amount: transactionResult.payment.amount.toString(),
      status: transactionResult.payment.status,
      orderStatus: transactionResult.financialOutcome.nextStatus,
      outstandingBalance: transactionResult.financialOutcome.financial.outstandingBalance.toString(),
    });

    if (transactionResult.financialOutcome.nextStatus !== transactionResult.financialOutcome.previousStatus) {
      this.realtimeEvents.emitToBranch(branchId, REALTIME_EVENTS.ORDER_STATUS_CHANGED, {
        orderId,
        previousStatus: transactionResult.financialOutcome.previousStatus,
        nextStatus: transactionResult.financialOutcome.nextStatus,
        source: 'payment',
      });
    }

    if (transactionResult.financialOutcome.nextStatus === OrderStatus.PAID) {
      this.realtimeEvents.emitToBranch(branchId, REALTIME_EVENTS.ORDER_PAID, {
        orderId,
        paymentId: transactionResult.payment.id,
        paidAt: new Date().toISOString(),
      });
    }

    if (transactionResult.financialOutcome.stockConsumptionRequired) {
      await this.consumeOrderStockPostSettlement(branchId, orderId, actor.sub);
    }

    return {
      payment: transactionResult.payment,
      orderStatus: transactionResult.financialOutcome.nextStatus,
      financial: this.serializeFinancialSnapshot(transactionResult.financialOutcome.financial),
    };
  }

  async getOrderPayments(branchId: string, actor: AuthUser, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        branchId,
      },
      select: {
        id: true,
        status: true,
        serviceType: true,
        grandTotal: true,
        billedAt: true,
        paidAt: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    assertWaiterScope(actor, order.serviceType);

    const payments = await this.prisma.paymentTransaction.findMany({
      where: {
        branchId,
        orderId: order.id,
      },
      include: {
        refunds: {
          orderBy: [{ createdAt: 'asc' }],
        },
        registerShift: {
          select: {
            id: true,
            status: true,
            openedAt: true,
            closedAt: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const financial = this.computeOrderFinancialSnapshotFromPayments(order.grandTotal, payments);

    return {
      orderId: order.id,
      status: order.status,
      billedAt: order.billedAt,
      paidAt: order.paidAt,
      financial: this.serializeFinancialSnapshot(financial),
      payments,
    };
  }

  async getOrderRefunds(branchId: string, actor: AuthUser, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        branchId,
      },
      select: {
        id: true,
        serviceType: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    assertWaiterScope(actor, order.serviceType);

    return this.prisma.refund.findMany({
      where: {
        branchId,
        orderId: order.id,
      },
      include: {
        paymentTransaction: {
          select: {
            id: true,
            paymentMethod: true,
            amount: true,
            status: true,
            registerShiftId: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  async voidPayment(branchId: string, actor: AuthUser, paymentId: string, dto: VoidPaymentDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.paymentTransaction.findFirst({
        where: {
          id: paymentId,
          branchId,
        },
        include: {
          order: {
            select: {
              id: true,
              status: true,
            },
          },
          refunds: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment transaction not found');
      }

      if (payment.status === PaymentTransactionStatus.VOIDED) {
        throw new ConflictException('Payment transaction is already voided');
      }

      if (payment.status === PaymentTransactionStatus.REFUNDED_PARTIAL || payment.status === PaymentTransactionStatus.REFUNDED_FULL) {
        throw new ConflictException('Refunded payment transaction cannot be voided');
      }

      if (payment.refunds.length > 0) {
        throw new ConflictException('Payment transaction with refunds cannot be voided');
      }

      const note = dto.reason ? [payment.notes, `VOID_REASON: ${dto.reason}`].filter(Boolean).join(' | ') : payment.notes;

      const updatedPayment = await tx.paymentTransaction.update({
        where: {
          id: payment.id,
        },
        data: {
          status: PaymentTransactionStatus.VOIDED,
          notes: note,
        },
      });

      await this.createOrderEvent(tx, {
        orderId: payment.orderId,
        actorUserId: actor.sub,
        eventType: ORDER_EVENT_TYPES.PAYMENT_VOIDED,
        payloadJson: {
          paymentId: payment.id,
          previousStatus: payment.status,
          newStatus: PaymentTransactionStatus.VOIDED,
          amount: payment.amount.toString(),
          reason: dto.reason ?? null,
        },
      });

      const financialOutcome = await this.recomputeOrderFinancialStatusTx(tx, {
        branchId,
        orderId: payment.orderId,
        actorUserId: actor.sub,
        reason: 'PAYMENT_VOIDED',
      });

      return {
        payment: updatedPayment,
        financialOutcome,
      };
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'VOID_PAYMENT',
      entity: 'payment_transaction',
      metadata: {
        paymentId,
        branchId,
        reason: dto.reason ?? null,
      },
    });

    if (result.financialOutcome.nextStatus !== result.financialOutcome.previousStatus) {
      this.realtimeEvents.emitToBranch(branchId, REALTIME_EVENTS.ORDER_STATUS_CHANGED, {
        orderId: result.payment.orderId,
        previousStatus: result.financialOutcome.previousStatus,
        nextStatus: result.financialOutcome.nextStatus,
        source: 'payment_voided',
      });
    }

    return {
      payment: result.payment,
      orderStatus: result.financialOutcome.nextStatus,
      financial: this.serializeFinancialSnapshot(result.financialOutcome.financial),
    };
  }

  async createRefund(branchId: string, actor: AuthUser, paymentId: string, dto: CreateRefundDto) {
    const refundAmount = new Prisma.Decimal(dto.amount);

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.paymentTransaction.findFirst({
        where: {
          id: paymentId,
          branchId,
        },
        include: {
          refunds: {
            select: {
              amount: true,
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment transaction not found');
      }

      if (payment.status === PaymentTransactionStatus.VOIDED) {
        throw new ConflictException('Voided payment transaction cannot be refunded');
      }

      const refundedSoFar = payment.refunds.reduce(
        (acc, item) => acc.plus(item.amount),
        new Prisma.Decimal(0),
      );

      const refundableAmount = payment.amount.minus(refundedSoFar);
      if (refundAmount.greaterThan(refundableAmount)) {
        throw new ConflictException(
          `Refund amount exceeds refundable balance (${refundableAmount.toString()})`,
        );
      }

      const refund = await tx.refund.create({
        data: {
          branchId,
          orderId: payment.orderId,
          paymentTransactionId: payment.id,
          amount: refundAmount,
          reason: dto.reason.trim(),
          createdByUserId: actor.sub,
        },
      });

      const updatedRefundedTotal = refundedSoFar.plus(refundAmount);
      const nextPaymentStatus = updatedRefundedTotal.equals(payment.amount)
        ? PaymentTransactionStatus.REFUNDED_FULL
        : PaymentTransactionStatus.REFUNDED_PARTIAL;

      const updatedPayment = await tx.paymentTransaction.update({
        where: {
          id: payment.id,
        },
        data: {
          status: nextPaymentStatus,
        },
      });

      await this.createOrderEvent(tx, {
        orderId: payment.orderId,
        actorUserId: actor.sub,
        eventType: ORDER_EVENT_TYPES.REFUND_CREATED,
        payloadJson: {
          paymentId: payment.id,
          refundId: refund.id,
          amount: refundAmount.toString(),
          reason: refund.reason,
          previousPaymentStatus: payment.status,
          newPaymentStatus: nextPaymentStatus,
        },
      });

      const financialOutcome = await this.recomputeOrderFinancialStatusTx(tx, {
        branchId,
        orderId: payment.orderId,
        actorUserId: actor.sub,
        reason: 'REFUND_CREATED',
      });

      return {
        refund,
        payment: updatedPayment,
        financialOutcome,
      };
    });

    await this.auditService.logAction({
      userId: actor.sub,
      action: 'CREATE_REFUND',
      entity: 'refund',
      metadata: {
        refundId: result.refund.id,
        paymentId,
        orderId: result.refund.orderId,
        amount: refundAmount.toString(),
      },
    });

    if (result.financialOutcome.nextStatus !== result.financialOutcome.previousStatus) {
      this.realtimeEvents.emitToBranch(branchId, REALTIME_EVENTS.ORDER_STATUS_CHANGED, {
        orderId: result.refund.orderId,
        previousStatus: result.financialOutcome.previousStatus,
        nextStatus: result.financialOutcome.nextStatus,
        source: 'refund_created',
      });
    }

    return {
      refund: result.refund,
      payment: result.payment,
      orderStatus: result.financialOutcome.nextStatus,
      financial: this.serializeFinancialSnapshot(result.financialOutcome.financial),
    };
  }

  async getPaymentRefunds(branchId: string, paymentId: string) {
    const payment = await this.prisma.paymentTransaction.findFirst({
      where: {
        id: paymentId,
        branchId,
      },
      select: {
        id: true,
        orderId: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment transaction not found');
    }

    const refunds = await this.prisma.refund.findMany({
      where: {
        branchId,
        paymentTransactionId: payment.id,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      refunds,
    };
  }

  async getRegisterShiftPayments(branchId: string, shiftId: string) {
    await this.ensureShiftInBranch(branchId, shiftId);

    return this.prisma.paymentTransaction.findMany({
      where: {
        branchId,
        registerShiftId: shiftId,
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            serviceType: true,
            grandTotal: true,
          },
        },
        refunds: {
          orderBy: [{ createdAt: 'asc' }],
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  async getRegisterShiftOrders(branchId: string, shiftId: string) {
    await this.ensureShiftInBranch(branchId, shiftId);

    const payments = await this.prisma.paymentTransaction.findMany({
      where: {
        branchId,
        registerShiftId: shiftId,
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            serviceType: true,
            grandTotal: true,
          },
        },
        refunds: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const orderMap = new Map<
      string,
      {
        orderId: string;
        orderNumber: string;
        orderStatus: OrderStatus;
        serviceType: string;
        grandTotal: Prisma.Decimal;
        paidGrossInShift: Prisma.Decimal;
        refundedInShift: Prisma.Decimal;
        netPaidInShift: Prisma.Decimal;
      }
    >();

    for (const payment of payments) {
      const existing = orderMap.get(payment.orderId);
      const refundedForPayment = payment.refunds.reduce(
        (acc, refund) => acc.plus(refund.amount),
        new Prisma.Decimal(0),
      );
      const grossForPayment = isEffectivePaymentStatus(payment.status)
        ? payment.amount
        : new Prisma.Decimal(0);
      const netForPayment = grossForPayment.minus(refundedForPayment);

      if (existing) {
        existing.paidGrossInShift = existing.paidGrossInShift.plus(grossForPayment);
        existing.refundedInShift = existing.refundedInShift.plus(refundedForPayment);
        existing.netPaidInShift = existing.netPaidInShift.plus(netForPayment);
      } else {
        orderMap.set(payment.orderId, {
          orderId: payment.order.id,
          orderNumber: payment.order.orderNumber,
          orderStatus: payment.order.status,
          serviceType: payment.order.serviceType,
          grandTotal: payment.order.grandTotal,
          paidGrossInShift: grossForPayment,
          refundedInShift: refundedForPayment,
          netPaidInShift: netForPayment,
        });
      }
    }

    const orders = Array.from(orderMap.values()).sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));

    return {
      shiftId,
      orderCount: orders.length,
      orders: orders.map((item) => ({
        ...item,
        grandTotal: item.grandTotal.toString(),
        paidGrossInShift: item.paidGrossInShift.toString(),
        refundedInShift: item.refundedInShift.toString(),
        netPaidInShift: item.netPaidInShift.toString(),
      })),
    };
  }

  async getRegisterShiftSummary(branchId: string, shiftId: string) {
    const shift = await this.getRegisterShiftById(branchId, shiftId);

    const payments = await this.prisma.paymentTransaction.findMany({
      where: {
        branchId,
        registerShiftId: shift.id,
      },
      include: {
        refunds: true,
        order: {
          select: {
            id: true,
            status: true,
            grandTotal: true,
          },
        },
      },
    });

    const summary = this.buildShiftSummary(shift.openingCashAmount, payments);

    return {
      shift: {
        id: shift.id,
        status: shift.status,
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        openingCashAmount: shift.openingCashAmount,
        closingCashAmountExpected: shift.closingCashAmountExpected,
        closingCashAmountActual: shift.closingCashAmountActual,
        varianceAmount: shift.varianceAmount,
      },
      summary,
    };
  }

  private buildShiftSummary(
    openingCashAmount: Prisma.Decimal,
    payments: Array<
      Prisma.PaymentTransactionGetPayload<{
        include: {
          refunds: true;
          order: {
            select: {
              id: true;
              status: true;
              grandTotal: true;
            };
          };
        };
      }>
    >,
  ) {
    const methodTotals: Record<
      PaymentMethod,
      {
        gross: Prisma.Decimal;
        refunded: Prisma.Decimal;
        net: Prisma.Decimal;
        transactionCount: number;
      }
    > = {
      CASH: {
        gross: new Prisma.Decimal(0),
        refunded: new Prisma.Decimal(0),
        net: new Prisma.Decimal(0),
        transactionCount: 0,
      },
      CARD: {
        gross: new Prisma.Decimal(0),
        refunded: new Prisma.Decimal(0),
        net: new Prisma.Decimal(0),
        transactionCount: 0,
      },
      BANK_TRANSFER: {
        gross: new Prisma.Decimal(0),
        refunded: new Prisma.Decimal(0),
        net: new Prisma.Decimal(0),
        transactionCount: 0,
      },
      OTHER: {
        gross: new Prisma.Decimal(0),
        refunded: new Prisma.Decimal(0),
        net: new Prisma.Decimal(0),
        transactionCount: 0,
      },
    };

    const statusCounts: Record<PaymentTransactionStatus, number> = {
      COMPLETED: 0,
      VOIDED: 0,
      REFUNDED_PARTIAL: 0,
      REFUNDED_FULL: 0,
    };

    let grossPaidTotal = new Prisma.Decimal(0);
    let refundedTotal = new Prisma.Decimal(0);

    const settledOrderIds = new Set<string>();
    const paidOrderIds = new Set<string>();
    const paidOrderTotalMap = new Map<string, Prisma.Decimal>();

    for (const payment of payments) {
      statusCounts[payment.status] += 1;

      const refundedForPayment = payment.refunds.reduce(
        (acc, refund) => acc.plus(refund.amount),
        new Prisma.Decimal(0),
      );

      const methodRow = methodTotals[payment.paymentMethod];
      methodRow.transactionCount += 1;

      if (isEffectivePaymentStatus(payment.status)) {
        grossPaidTotal = grossPaidTotal.plus(payment.amount);
        refundedTotal = refundedTotal.plus(refundedForPayment);

        methodRow.gross = methodRow.gross.plus(payment.amount);
        methodRow.refunded = methodRow.refunded.plus(refundedForPayment);
        methodRow.net = methodRow.net.plus(payment.amount.minus(refundedForPayment));

        settledOrderIds.add(payment.orderId);

        if (payment.order.status === OrderStatus.PAID) {
          paidOrderIds.add(payment.orderId);
          if (!paidOrderTotalMap.has(payment.orderId)) {
            paidOrderTotalMap.set(payment.orderId, payment.order.grandTotal);
          }
        }
      }
    }

    const netPaidTotal = grossPaidTotal.minus(refundedTotal);
    const expectedCashAmount = openingCashAmount
      .plus(methodTotals.CASH.gross)
      .minus(methodTotals.CASH.refunded);

    const paidOrderTotals = Array.from(paidOrderTotalMap.values()).reduce(
      (acc, grandTotal) => acc.plus(grandTotal),
      new Prisma.Decimal(0),
    );

    return {
      settledOrderCount: settledOrderIds.size,
      paidOrderCount: paidOrderIds.size,
      paidOrderTotal: paidOrderTotals.toString(),
      grossPaidTotal: grossPaidTotal.toString(),
      refundedTotal: refundedTotal.toString(),
      netPaidTotal: netPaidTotal.toString(),
      expectedCashAmount: expectedCashAmount.toString(),
      totalsByPaymentMethod: PAYMENT_METHODS.map((method) => ({
        paymentMethod: method,
        gross: methodTotals[method].gross.toString(),
        refunded: methodTotals[method].refunded.toString(),
        net: methodTotals[method].net.toString(),
        transactionCount: methodTotals[method].transactionCount,
      })),
      transactionCounts: statusCounts,
    };
  }

  private async ensureShiftInBranch(branchId: string, shiftId: string) {
    const shift = await this.prisma.registerShift.findFirst({
      where: {
        id: shiftId,
        branchId,
      },
      select: {
        id: true,
      },
    });

    if (!shift) {
      throw new NotFoundException('Register shift not found');
    }

    return shift;
  }

  private async computeShiftExpectedCashTx(
    tx: Prisma.TransactionClient,
    registerShiftId: string,
    openingCashAmount: Prisma.Decimal,
  ) {
    const [cashPaymentsAggregate, cashRefundsAggregate] = await Promise.all([
      tx.paymentTransaction.aggregate({
        where: {
          registerShiftId,
          paymentMethod: PaymentMethod.CASH,
          status: {
            in: EFFECTIVE_PAYMENT_STATUSES,
          },
        },
        _sum: {
          amount: true,
        },
      }),
      tx.refund.aggregate({
        where: {
          paymentTransaction: {
            registerShiftId,
            paymentMethod: PaymentMethod.CASH,
            status: {
              in: EFFECTIVE_PAYMENT_STATUSES,
            },
          },
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    const cashPayments = cashPaymentsAggregate._sum.amount ?? new Prisma.Decimal(0);
    const cashRefunds = cashRefundsAggregate._sum.amount ?? new Prisma.Decimal(0);

    return openingCashAmount.plus(cashPayments).minus(cashRefunds);
  }

  private async computeOrderFinancialSnapshotTx(
    tx: Prisma.TransactionClient,
    orderId: string,
    grandTotal: Prisma.Decimal,
  ): Promise<OrderFinancialSnapshot> {
    const [paidAggregate, refundedAggregate] = await Promise.all([
      tx.paymentTransaction.aggregate({
        where: {
          orderId,
          status: {
            in: EFFECTIVE_PAYMENT_STATUSES,
          },
        },
        _sum: {
          amount: true,
        },
      }),
      tx.refund.aggregate({
        where: {
          orderId,
          paymentTransaction: {
            status: {
              in: EFFECTIVE_PAYMENT_STATUSES,
            },
          },
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    const paidGrossTotal = paidAggregate._sum.amount ?? new Prisma.Decimal(0);
    const refundedTotal = refundedAggregate._sum.amount ?? new Prisma.Decimal(0);
    const netPaidTotal = paidGrossTotal.minus(refundedTotal);
    const outstandingRaw = grandTotal.minus(netPaidTotal);
    const outstandingBalance = outstandingRaw.lessThan(0) ? new Prisma.Decimal(0) : outstandingRaw;

    return {
      grandTotal,
      paidGrossTotal,
      refundedTotal,
      netPaidTotal,
      outstandingBalance,
    };
  }

  private computeOrderFinancialSnapshotFromPayments(
    grandTotal: Prisma.Decimal,
    payments: Array<
      Prisma.PaymentTransactionGetPayload<{
        include: { refunds: true };
      }>
    >,
  ): OrderFinancialSnapshot {
    let paidGrossTotal = new Prisma.Decimal(0);
    let refundedTotal = new Prisma.Decimal(0);

    for (const payment of payments) {
      if (isEffectivePaymentStatus(payment.status)) {
        paidGrossTotal = paidGrossTotal.plus(payment.amount);
        refundedTotal = refundedTotal.plus(
          payment.refunds.reduce((acc, refund) => acc.plus(refund.amount), new Prisma.Decimal(0)),
        );
      }
    }

    const netPaidTotal = paidGrossTotal.minus(refundedTotal);
    const outstandingRaw = grandTotal.minus(netPaidTotal);
    const outstandingBalance = outstandingRaw.lessThan(0) ? new Prisma.Decimal(0) : outstandingRaw;

    return {
      grandTotal,
      paidGrossTotal,
      refundedTotal,
      netPaidTotal,
      outstandingBalance,
    };
  }

  private serializeFinancialSnapshot(financial: OrderFinancialSnapshot) {
    return {
      grandTotal: financial.grandTotal.toString(),
      paidGrossTotal: financial.paidGrossTotal.toString(),
      refundedTotal: financial.refundedTotal.toString(),
      netPaidTotal: financial.netPaidTotal.toString(),
      outstandingBalance: financial.outstandingBalance.toString(),
    };
  }

  private async recomputeOrderFinancialStatusTx(
    tx: Prisma.TransactionClient,
    input: {
      branchId: string;
      orderId: string;
      actorUserId: string;
      reason: string;
    },
  ) {
    const order = await tx.order.findFirst({
      where: {
        id: input.orderId,
        branchId: input.branchId,
      },
      select: {
        id: true,
        status: true,
        grandTotal: true,
        billedAt: true,
        paidAt: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const financial = await this.computeOrderFinancialSnapshotTx(tx, order.id, order.grandTotal);

    let nextStatus = order.status;

    if (order.status !== OrderStatus.CANCELLED) {
      if (financial.outstandingBalance.equals(0)) {
        nextStatus = OrderStatus.PAID;
      } else if (
        order.status === OrderStatus.PAID ||
        order.status === OrderStatus.BILLED ||
        order.billedAt !== null ||
        financial.netPaidTotal.greaterThan(0)
      ) {
        nextStatus = OrderStatus.BILLED;
      }
    }

    const now = new Date();
    const nextBilledAt =
      nextStatus === OrderStatus.BILLED || nextStatus === OrderStatus.PAID
        ? order.billedAt ?? now
        : order.billedAt;
    const nextPaidAt = nextStatus === OrderStatus.PAID ? now : null;

    const shouldUpdateOrder =
      nextStatus !== order.status ||
      ((nextStatus === OrderStatus.PAID && order.paidAt === null) ||
        (nextStatus !== OrderStatus.PAID && order.paidAt !== null));

    const stockConsumptionRequired = nextStatus === OrderStatus.PAID && order.status !== OrderStatus.PAID;

    if (shouldUpdateOrder) {
      await tx.order.update({
        where: {
          id: order.id,
        },
        data: {
          status: nextStatus,
          billedAt: nextBilledAt,
          paidAt: nextPaidAt,
        },
      });

      if (stockConsumptionRequired) {
        await this.createOrderEvent(tx, {
          orderId: order.id,
          actorUserId: input.actorUserId,
          eventType: ORDER_EVENT_TYPES.ORDER_MARKED_PAID,
          payloadJson: {
            fromStatus: order.status,
            toStatus: OrderStatus.PAID,
            paidAt: now.toISOString(),
          },
        });
      }
    }

    await this.createOrderEvent(tx, {
      orderId: order.id,
      actorUserId: input.actorUserId,
      eventType: ORDER_EVENT_TYPES.ORDER_FINANCIAL_STATUS_RECOMPUTED,
      payloadJson: {
        reason: input.reason,
        previousStatus: order.status,
        newStatus: nextStatus,
        grandTotal: financial.grandTotal.toString(),
        paidGrossTotal: financial.paidGrossTotal.toString(),
        refundedTotal: financial.refundedTotal.toString(),
        netPaidTotal: financial.netPaidTotal.toString(),
        outstandingBalance: financial.outstandingBalance.toString(),
      },
    });

    return {
      previousStatus: order.status,
      nextStatus,
      financial,
      stockConsumptionRequired,
    };
  }

  private async consumeOrderStockPostSettlement(
    branchId: string,
    orderId: string,
    actorUserId: string,
  ) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.inventoryService.consumeOrderStockOnPaidTx(tx, {
          branchId,
          orderId,
          actorUserId,
        });
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown stock consumption failure';

      try {
        await this.prisma.$transaction(async (tx) => {
          await this.createOrderEvent(tx, {
            orderId,
            actorUserId,
            eventType: ORDER_EVENT_TYPES.STOCK_CONSUMPTION_FAILED,
            payloadJson: {
              reason,
              source: 'PAYMENT_SETTLEMENT',
            },
          });
        });
      } catch {
        // best-effort event persistence; settlement must not fail because of stock errors
      }

      try {
        await this.auditService.logAction({
          userId: actorUserId,
          action: 'STOCK_CONSUMPTION_FAILED_POST_PAYMENT',
          entity: 'order_consumption',
          metadata: {
            orderId,
            branchId,
            reason,
          },
        });
      } catch {
        // best-effort audit persistence
      }
    }
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
