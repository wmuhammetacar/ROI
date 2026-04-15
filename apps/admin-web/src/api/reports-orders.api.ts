import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';

export interface OrdersSummaryResponse {
  totalOrders: number;
  orderCountByStatus: Record<string, number>;
}

export function createReportsOrdersApi(client: ApiClient) {
  return {
    getSummary(branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<OrdersSummaryResponse>(withQuery('/reports/orders-summary', params));
    },
  };
}

export const reportsOrdersApi = createReportsOrdersApi(adminApiClient);
