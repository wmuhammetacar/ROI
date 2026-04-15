import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';
import type { RegisterShift, RegisterShiftSummaryResponse } from './finance-types';

export function createFinanceDayEndApi(client: ApiClient) {
  return {
    listOpenShifts(limit = 10, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      params.set('status', 'OPEN');
      params.set('limit', String(limit));
      return client.get<RegisterShift[]>(withQuery('/register-shifts', params));
    },
    listClosedShifts(limit = 10, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      params.set('status', 'CLOSED');
      params.set('limit', String(limit));
      return client.get<RegisterShift[]>(withQuery('/register-shifts', params));
    },
    getShiftSummary(id: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<RegisterShiftSummaryResponse>(withQuery(`/register-shifts/${id}/summary`, params));
    },
  };
}

export const financeDayEndApi = createFinanceDayEndApi(adminApiClient);
