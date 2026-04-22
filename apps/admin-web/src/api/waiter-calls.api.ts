import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';

export interface WaiterCall {
  id: string;
  branchId: string;
  tableId: string;
  callType: 'WAITER' | 'BILL' | 'SERVICE';
  status: 'PENDING' | 'RESOLVED';
  note?: string | null;
  requestedAt: string;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  table?: {
    id: string;
    name: string;
    status: string;
  };
}

export function createWaiterCallsApi(client: ApiClient) {
  return {
    list(branchId?: string, status?: 'PENDING' | 'RESOLVED') {
      const params = appendBranchScope(undefined, branchId);
      if (status) params.set('status', status);
      return client.get<WaiterCall[]>(withQuery('/waiter-calls', params));
    },
    create(payload: { tableId: string; callType?: 'WAITER' | 'BILL' | 'SERVICE'; note?: string }) {
      return client.post<WaiterCall>('/waiter-calls', payload);
    },
    resolve(id: string) {
      return client.patch<WaiterCall>(`/waiter-calls/${id}/resolve`);
    },
  };
}

export const waiterCallsApi = createWaiterCallsApi(adminApiClient);
