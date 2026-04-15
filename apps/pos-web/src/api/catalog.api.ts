import type { ApiClient } from '@roi/api-client';
import { posApiClient } from './client';
import type { PosCatalogResponse } from './pos-types';

export function createPosCatalogApi(client: ApiClient) {
  return {
    getPosProducts() {
      return client.get<PosCatalogResponse>('/catalog/pos-products');
    },
  };
}

export const posCatalogApi = createPosCatalogApi(posApiClient);
