import type { ApiClient } from '@roi/api-client';
import { qrApiClient } from './client';
import type { PublicMenuResponse } from './types';

export function createPublicCatalogApi(client: ApiClient) {
  return {
    getMenu(branchId: string, tableId?: string) {
      const params = new URLSearchParams();
      params.set('branchId', branchId);
      if (tableId) {
        params.set('tableId', tableId);
      }
      return client.get<PublicMenuResponse>(`/public/menu?${params.toString()}`);
    },
  };
}

export const publicCatalogApi = createPublicCatalogApi(qrApiClient);
