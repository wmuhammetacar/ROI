import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';
import type { ListOrdersQuery, OrderPaymentsResponse, OrderSummary, Refund } from './finance-types';

export function createFinanceOrdersApi(client: ApiClient) {
  return {
    list(query: ListOrdersQuery = {}, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      if (query.status) params.set('status', query.status);
      if (query.serviceType) params.set('serviceType', query.serviceType);
      if (query.limit) params.set('limit', String(query.limit));
      return client.get<OrderSummary[]>(withQuery('/orders', params));
    },
    getById(id: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<OrderSummary & { items?: unknown[] }>(withQuery(`/orders/${id}`, params));
    },
    getPayments(orderId: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<OrderPaymentsResponse>(withQuery(`/orders/${orderId}/payments`, params));
    },
    getRefunds(orderId: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<Refund[]>(withQuery(`/orders/${orderId}/refunds`, params));
    },
  };
}

export const financeOrdersApi = createFinanceOrdersApi(adminApiClient);
