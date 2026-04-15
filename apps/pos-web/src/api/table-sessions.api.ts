import type { ApiClient } from '@roi/api-client';
import { posApiClient } from './client';
import type { TableSession } from './pos-types';

export interface OpenTableSessionPayload {
  tableId: string;
  guestCount: number;
  notes?: string;
}

export function createTableSessionsApi(client: ApiClient) {
  return {
    open(payload: OpenTableSessionPayload) {
      return client.post<TableSession>('/table-sessions/open', payload);
    },
    findOpenByTable(tableId: string) {
      return client.get<TableSession | null>(`/table-sessions/open/by-table/${tableId}`);
    },
    getById(id: string) {
      return client.get<TableSession>(`/table-sessions/${id}`);
    },
  };
}

export const tableSessionsApi = createTableSessionsApi(posApiClient);
