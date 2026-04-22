import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';

export interface OperationsOverviewTable {
  id: string;
  name: string;
  status: string;
  floor?: { id: string; name: string } | null;
  openSessionId: string | null;
  openedAt: string | null;
  guestCount: number | null;
  currentTotal: string | number;
  itemCount: number;
  orderId: string | null;
  orderStatus: string | null;
}

export interface OperationsOverviewOrder {
  id: string;
  status: string;
  orderNumber: string;
  grandTotal: string | number;
  tableSessionId: string | null;
  tableId: string | null;
  tableName: string | null;
  itemCount: number;
  createdAt: string;
}

export interface OperationsOverviewResponse {
  branchId: string;
  generatedAt: string;
  tables: OperationsOverviewTable[];
  liveOrders: OperationsOverviewOrder[];
  salesSnapshot: {
    todayRevenue: number;
    activeUnpaidAmount: number;
    openOrderCount: number;
    completedOrderCount: number;
  };
  kitchenBarStatus: Record<string, { queued: number; inProgress: number; ready: number }>;
}

export function createOperationsApi(client: ApiClient) {
  return {
    getOverview(branchId?: string, orderLimit = 120) {
      const params = appendBranchScope(undefined, branchId);
      params.set('orderLimit', String(orderLimit));
      return client.get<OperationsOverviewResponse>(withQuery('/operations/overview', params));
    },
  };
}

export const operationsApi = createOperationsApi(adminApiClient);
