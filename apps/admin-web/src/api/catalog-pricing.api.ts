import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';
import type { ApiDeleteResponse, BranchPriceOverride } from './catalog-types';

export interface CreateBranchPriceOverridePayload {
  variantId?: string;
  price: number;
}

export interface UpdateBranchPriceOverridePayload {
  variantId?: string;
  price?: number;
}

export function createCatalogPricingApi(client: ApiClient) {
  return {
    listByProduct(productId: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<BranchPriceOverride[]>(withQuery(`/products/${productId}/prices`, params));
    },
    create(productId: string, payload: CreateBranchPriceOverridePayload) {
      return client.post<BranchPriceOverride>(`/products/${productId}/prices`, payload);
    },
    update(productId: string, priceId: string, payload: UpdateBranchPriceOverridePayload) {
      return client.patch<BranchPriceOverride>(`/products/${productId}/prices/${priceId}`, payload);
    },
    remove(productId: string, priceId: string) {
      return client.delete<ApiDeleteResponse>(`/products/${productId}/prices/${priceId}`);
    },
  };
}

export const catalogPricingApi = createCatalogPricingApi(adminApiClient);
