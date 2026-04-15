import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';
import type { InventorySummary } from './inventory-types';

export interface InventorySummaryQuery {
  activeOnly?: boolean;
  limit?: number;
}

export function createInventorySummaryApi(client: ApiClient) {
  return {
    getSummary(query?: InventorySummaryQuery, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      if (query?.activeOnly !== undefined) params.set('activeOnly', String(query.activeOnly));
      if (query?.limit) params.set('limit', String(query.limit));
      return client.get<InventorySummary>(withQuery('/inventory/summary', params));
    },
  };
}

export const inventorySummaryApi = createInventorySummaryApi(adminApiClient);
