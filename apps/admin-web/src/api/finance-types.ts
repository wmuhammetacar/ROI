export type RegisterShiftStatus = 'OPEN' | 'CLOSED';
export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';
export type PaymentTransactionStatus = 'COMPLETED' | 'VOIDED' | 'REFUNDED_PARTIAL' | 'REFUNDED_FULL';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

export interface RegisterShift {
  id: string;
  branchId: string;
  openedByUserId: string;
  closedByUserId?: string | null;
  openingCashAmount: string;
  closingCashAmountExpected?: string | null;
  closingCashAmountActual?: string | null;
  varianceAmount?: string | null;
  status: RegisterShiftStatus;
  notes?: string | null;
  openedAt: string;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  openedByUser?: UserSummary | null;
  closedByUser?: UserSummary | null;
}

export interface RegisterShiftSummaryResponse {
  shift: {
    id: string;
    status: RegisterShiftStatus;
    openedAt: string;
    closedAt?: string | null;
    openingCashAmount: string;
    closingCashAmountExpected?: string | null;
    closingCashAmountActual?: string | null;
    varianceAmount?: string | null;
  };
  summary: {
    settledOrderCount: number;
    paidOrderCount: number;
    paidOrderTotal: string;
    grossPaidTotal: string;
    refundedTotal: string;
    netPaidTotal: string;
    expectedCashAmount: string;
    totalsByPaymentMethod: Array<{
      paymentMethod: PaymentMethod;
      gross: string;
      refunded: string;
      net: string;
      transactionCount: number;
    }>;
    transactionCounts: Record<PaymentTransactionStatus, number>;
  };
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  serviceType?: string;
  grandTotal: string;
  billedAt?: string | null;
  paidAt?: string | null;
}

export interface RegisterShiftOrdersResponse {
  shiftId: string;
  orderCount: number;
  orders: Array<{
    orderId: string;
    orderNumber: string;
    orderStatus: string;
    serviceType: string;
    grandTotal: string;
    paidGrossInShift: string;
    refundedInShift: string;
    netPaidInShift: string;
  }>;
}

export interface Refund {
  id: string;
  branchId: string;
  orderId: string;
  paymentTransactionId: string;
  amount: string;
  reason: string;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
  paymentTransaction?: {
    id: string;
    paymentMethod: PaymentMethod;
    amount: string;
    status: PaymentTransactionStatus;
    registerShiftId?: string | null;
  };
}

export interface RegisterShiftLite {
  id: string;
  status: RegisterShiftStatus;
  openedAt: string;
  closedAt?: string | null;
}

export interface PaymentTransaction {
  id: string;
  branchId: string;
  orderId: string;
  registerShiftId: string;
  paymentMethod: PaymentMethod;
  amount: string;
  status: PaymentTransactionStatus;
  referenceNo?: string | null;
  notes?: string | null;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
  refunds?: Refund[];
  order?: OrderSummary;
  registerShift?: RegisterShiftLite | null;
}

export interface OrderPaymentsResponse {
  orderId: string;
  status: string;
  billedAt?: string | null;
  paidAt?: string | null;
  financial: {
    grandTotal: string;
    paidGrossTotal: string;
    refundedTotal: string;
    netPaidTotal: string;
    outstandingBalance: string;
  };
  payments: PaymentTransaction[];
}

export interface PaymentRefundsResponse {
  paymentId: string;
  orderId: string;
  refunds: Refund[];
}

export interface OrderRefundsResponse {
  refunds: Refund[];
}

export interface OrderPaymentsCreateResponse {
  payment: PaymentTransaction;
  orderStatus: string;
  financial: OrderPaymentsResponse['financial'];
}

export interface PaymentVoidResponse {
  payment: PaymentTransaction;
  orderStatus: string;
  financial: OrderPaymentsResponse['financial'];
}

export interface RegisterShiftSummary {
  shiftId: string;
  orderCount: number;
  orders: Array<{
    orderId: string;
    orderNumber: string;
    orderStatus: string;
    serviceType: string;
    grandTotal: string;
    paidGrossInShift: string;
    refundedInShift: string;
    netPaidInShift: string;
  }>;
}

export interface RegisterShiftOrderListItem {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  serviceType: string;
  grandTotal: string;
  paidGrossInShift: string;
  refundedInShift: string;
  netPaidInShift: string;
}

export interface RegisterShiftPaymentsListItem extends PaymentTransaction {
  order?: OrderSummary;
}

export interface ListRegisterShiftQuery {
  status?: RegisterShiftStatus;
  openedByUserId?: string;
  limit?: number;
}

export interface ListOrdersQuery {
  status?: string;
  serviceType?: string;
  limit?: number;
}

export interface VoidPaymentPayload {
  reason?: string;
}

export interface RefundPayload {
  amount: number;
  reason: string;
}
