import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';

export interface ReportsOperationsSummaryResponse {
  openShiftCount: number;
  recentShifts: Array<{
    id: string;
    status: string;
    openedAt: string;
  }>;
  productionStatusCounts: Record<string, number>;
}

export function createReportsOperationsApi(client: ApiClient) {
  return {
    getSummary(limit = 5, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      params.set('limit', String(limit));
      return client.get<ReportsOperationsSummaryResponse>(withQuery('/reports/operations-summary', params));
    },
  };
}

export const reportsOperationsApi = createReportsOperationsApi(adminApiClient);
