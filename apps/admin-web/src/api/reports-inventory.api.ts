import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';

export interface ReportsInventorySummaryResponse {
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
}

export function createReportsInventoryApi(client: ApiClient) {
  return {
    getSummary(limit = 10, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      params.set('limit', String(limit));
      return client.get<ReportsInventorySummaryResponse>(withQuery('/reports/inventory-summary', params));
    },
  };
}

export const reportsInventoryApi = createReportsInventoryApi(adminApiClient);
