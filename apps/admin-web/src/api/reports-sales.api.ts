import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';

export interface SalesSummaryResponse {
  scope: {
    type: string;
    shiftId?: string;
    status?: string;
    closedAt?: string | null;
  };
  summary: {
    grossPaidTotal: string;
    refundedTotal: string;
    netPaidTotal: string;
    totalsByPaymentMethod: Array<{
      paymentMethod: string;
      gross: string;
      refunded: string;
      net: string;
      transactionCount: number;
    }>;
    transactionCounts: Record<string, number>;
  };
}

export interface PaymentMixResponse {
  scope: {
    type: string;
    shiftId?: string;
  };
  totalsByPaymentMethod: Array<{
    paymentMethod: string;
    gross: string;
    refunded: string;
    net: string;
    transactionCount: number;
  }>;
  grossPaidTotal: string;
  refundedTotal: string;
  netPaidTotal: string;
}

export interface ShiftsOverviewResponse {
  openShiftCount: number;
  closedShiftCount: number;
  openShifts: Array<{ id: string; status: string; openedAt: string; openingCashAmount: string }>;
  recentShifts: Array<{ id: string; status: string; openedAt: string; closedAt?: string | null; varianceAmount?: string | null }>;
}

export function createReportsSalesApi(client: ApiClient) {
  return {
    getSalesSummary(shiftId?: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      if (shiftId) params.set('shiftId', shiftId);
      return client.get<SalesSummaryResponse>(withQuery('/reports/sales-summary', params));
    },
    getPaymentMix(shiftId?: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      if (shiftId) params.set('shiftId', shiftId);
      return client.get<PaymentMixResponse>(withQuery('/reports/payment-mix', params));
    },
    getShiftsOverview(branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<ShiftsOverviewResponse>(withQuery('/reports/shifts-overview', params));
    },
  };
}

export const reportsSalesApi = createReportsSalesApi(adminApiClient);
