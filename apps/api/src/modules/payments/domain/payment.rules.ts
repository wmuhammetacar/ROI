import { ConflictException } from '@nestjs/common';
import { OrderStatus, PaymentTransactionStatus } from '@prisma/client';

export const PAYABLE_ORDER_STATUSES = new Set<OrderStatus>([
  OrderStatus.READY,
  OrderStatus.SERVED,
  OrderStatus.BILLED,
  OrderStatus.PAID,
]);

export const BILLABLE_ORDER_STATUSES = new Set<OrderStatus>([
  OrderStatus.READY,
  OrderStatus.SERVED,
]);

export const EFFECTIVE_PAYMENT_STATUSES = new Set<PaymentTransactionStatus>([
  PaymentTransactionStatus.COMPLETED,
  PaymentTransactionStatus.REFUNDED_PARTIAL,
  PaymentTransactionStatus.REFUNDED_FULL,
]);

export function assertOrderIsPayableForSettlement(status: OrderStatus): void {
  if (!PAYABLE_ORDER_STATUSES.has(status)) {
    throw new ConflictException(
      'Only READY, SERVED, BILLED or partially-unpaid PAID orders can receive payments',
    );
  }
}

export function assertOrderIsBillable(status: OrderStatus): void {
  if (!BILLABLE_ORDER_STATUSES.has(status) && status !== OrderStatus.BILLED && status !== OrderStatus.PAID) {
    throw new ConflictException('Only READY, SERVED, BILLED or PAID orders are valid in billing flow');
  }
}

export function isEffectivePaymentStatus(status: PaymentTransactionStatus): boolean {
  return EFFECTIVE_PAYMENT_STATUSES.has(status);
}
