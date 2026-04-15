import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';
import type {
  ListRegisterShiftQuery,
  RegisterShift,
  RegisterShiftOrdersResponse,
  RegisterShiftSummaryResponse,
  RegisterShiftPaymentsListItem,
} from './finance-types';

export function createFinanceShiftsApi(client: ApiClient) {
  return {
    list(query: ListRegisterShiftQuery = {}, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      if (query.status) params.set('status', query.status);
      if (query.openedByUserId) params.set('openedByUserId', query.openedByUserId);
      if (query.limit) params.set('limit', String(query.limit));
      return client.get<RegisterShift[]>(withQuery('/register-shifts', params));
    },
    getCurrentOpen(branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<RegisterShift | null>(withQuery('/register-shifts/open/current', params));
    },
    getById(id: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<RegisterShift>(withQuery(`/register-shifts/${id}`, params));
    },
    getSummary(id: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<RegisterShiftSummaryResponse>(withQuery(`/register-shifts/${id}/summary`, params));
    },
    getPayments(id: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<RegisterShiftPaymentsListItem[]>(withQuery(`/register-shifts/${id}/payments`, params));
    },
    getOrders(id: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<RegisterShiftOrdersResponse>(withQuery(`/register-shifts/${id}/orders`, params));
    },
  };
}

export const financeShiftsApi = createFinanceShiftsApi(adminApiClient);
