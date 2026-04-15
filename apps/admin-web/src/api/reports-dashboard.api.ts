import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';

export interface ReportsDashboardSummary {
  salesSnapshot: {
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
  };
  paymentMixSnapshot: {
    scope: { type: string; shiftId?: string };
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
  };
  shiftSnapshot: {
    openShiftCount: number;
    closedShiftCount: number;
    openShifts: Array<{
      id: string;
      status: string;
      openedAt: string;
      openedByUserId: string;
      openingCashAmount: string;
      openedByUser?: { id: string; name: string; email: string } | null;
    }>;
    recentShifts: Array<{
      id: string;
      status: string;
      openedAt: string;
      closedAt?: string | null;
      openingCashAmount: string;
      varianceAmount?: string | null;
    }>;
  };
  inventoryRiskSnapshot: {
    totalIngredients: number;
    activeIngredients: number;
    inactiveIngredients: number;
    lowestStockItems: Array<{
      id: string;
      name: string;
      currentStock: string | number;
      isActive: boolean;
      unit?: { code: string } | null;
    }>;
    wasteRecordCount: number;
    latestWasteAt?: string | null;
  };
  ordersSnapshot: {
    totalOrders: number;
    orderCountByStatus: Record<string, number>;
  };
  operationsSnapshot: {
    openShiftCount: number;
    recentShifts: Array<{
      id: string;
      status: string;
      openedAt: string;
    }>;
    productionStatusCounts: Record<string, number>;
  };
}

export function createReportsDashboardApi(client: ApiClient) {
  return {
    getSummary(branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<ReportsDashboardSummary>(withQuery('/reports/dashboard-summary', params));
    },
  };
}

export const reportsDashboardApi = createReportsDashboardApi(adminApiClient);
