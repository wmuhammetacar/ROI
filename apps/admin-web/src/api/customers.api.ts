import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';
import type { OperationsOrder } from './operations-order-actions.api';

export interface CustomerRecord {
  id: string;
  branchId: string;
  fullName: string;
  phonePrimary: string;
  phoneSecondary?: string | null;
  phoneTertiary?: string | null;
  addressLine?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerHistoryOrder {
  id: string;
  orderNumber: string;
  serviceType: string;
  status: string;
  grandTotal: string | number;
  customerName?: string | null;
  customerPhone?: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    productId?: string | null;
    productNameSnapshot: string;
    variantNameSnapshot?: string | null;
    quantity: string | number;
    lineTotal: string | number;
    notes?: string | null;
    status: string;
  }>;
}

export function createCustomersApi(client: ApiClient) {
  return {
    list(query?: { q?: string; limit?: number }, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      if (query?.q) params.set('q', query.q);
      if (query?.limit) params.set('limit', String(query.limit));
      return client.get<CustomerRecord[]>(withQuery('/customers', params));
    },
    getById(customerId: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<CustomerRecord>(withQuery(`/customers/${customerId}`, params));
    },
    create(payload: {
      fullName: string;
      phonePrimary: string;
      phoneSecondary?: string;
      phoneTertiary?: string;
      addressLine?: string;
      notes?: string;
      isActive?: boolean;
    }) {
      return client.post<CustomerRecord>('/customers', payload);
    },
    update(
      customerId: string,
      payload: Partial<{
        fullName: string;
        phonePrimary: string;
        phoneSecondary: string;
        phoneTertiary: string;
        addressLine: string;
        notes: string;
        isActive: boolean;
      }>,
    ) {
      return client.patch<CustomerRecord>(`/customers/${customerId}`, payload);
    },
    getOrderHistory(customerId: string) {
      return client.get<CustomerHistoryOrder[]>(`/customers/${customerId}/orders`);
    },
    startOrder(customerId: string, payload?: { serviceType?: 'TAKEAWAY' | 'DELIVERY'; notes?: string }) {
      return client.post<OperationsOrder>(`/customers/${customerId}/start-order`, payload ?? {});
    },
    repeatOrder(customerId: string, sourceOrderId: string, payload?: { notes?: string }) {
      return client.post<{ order: OperationsOrder; copiedCount: number; skippedCount: number }>(
        `/customers/${customerId}/repeat-order/${sourceOrderId}`,
        payload ?? {},
      );
    },
  };
}

export const customersApi = createCustomersApi(adminApiClient);
