import type { ApiClient } from '@roi/api-client';
import { posApiClient } from './client';
import type { Table } from './pos-types';

export function createTablesApi(client: ApiClient) {
  return {
    list() {
      return client.get<Table[]>('/tables');
    },
    getById(id: string) {
      return client.get<Table>(`/tables/${id}`);
    },
  };
}

export const tablesApi = createTablesApi(posApiClient);
