import type { ApiClient } from '@roi/api-client';
import { posApiClient } from './client';
import type { PosCatalogResponse } from './pos-types';

export function createPosCatalogApi(client: ApiClient) {
  return {
    getPosProducts(query?: { routeSafe?: boolean }) {
      const params = new URLSearchParams();
      if (query?.routeSafe !== undefined) {
        params.set('routeSafe', String(query.routeSafe));
      }
      const suffix = params.toString();
      return client.get<PosCatalogResponse>(`/catalog/pos-products${suffix ? `?${suffix}` : ''}`);
    },
  };
}

export const posCatalogApi = createPosCatalogApi(posApiClient);
