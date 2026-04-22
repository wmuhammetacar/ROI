import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';
import type {
  ApiDeleteResponse,
  Product,
  ProductModifierGroupLink,
  ProductType,
  ProductVariant,
} from './catalog-types';

export interface CreateProductPayload {
  categoryId: string;
  name: string;
  description?: string;
  allergenTags?: string[];
  sku?: string;
  imageUrl?: string;
  basePrice: number;
  sortOrder: number;
  isActive?: boolean;
  isAvailable?: boolean;
  productType: ProductType;
}

export interface UpdateProductPayload {
  categoryId?: string;
  name?: string;
  description?: string;
  allergenTags?: string[];
  sku?: string;
  imageUrl?: string;
  basePrice?: number;
  sortOrder?: number;
  isActive?: boolean;
  isAvailable?: boolean;
  productType?: ProductType;
}

export interface ProductActiveStatePayload {
  isActive: boolean;
}

export interface ProductAvailabilityPayload {
  isAvailable: boolean;
}

export interface CreateVariantPayload {
  name: string;
  sku?: string;
  priceDelta: number;
  sortOrder: number;
  isActive?: boolean;
}

export interface UpdateVariantPayload {
  name?: string;
  sku?: string;
  priceDelta?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateProductModifierLinkPayload {
  modifierGroupId: string;
  isRequired: boolean;
  sortOrder: number;
}

export interface UpdateProductModifierLinkPayload {
  isRequired?: boolean;
  sortOrder?: number;
}

export function createCatalogProductsApi(client: ApiClient) {
  return {
    list(branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<Product[]>(withQuery('/products', params));
    },
    getById(id: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<Product>(withQuery(`/products/${id}`, params));
    },
    create(payload: CreateProductPayload) {
      return client.post<Product>('/products', payload);
    },
    update(id: string, payload: UpdateProductPayload) {
      return client.patch<Product>(`/products/${id}`, payload);
    },
    remove(id: string) {
      return client.delete<ApiDeleteResponse>(`/products/${id}`);
    },
    updateAvailability(id: string, payload: ProductAvailabilityPayload) {
      return client.patch<Product>(`/products/${id}/availability`, payload);
    },
    updateActiveState(id: string, payload: ProductActiveStatePayload) {
      return client.patch<Product>(`/products/${id}/active-state`, payload);
    },
    listVariants(productId: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<ProductVariant[]>(withQuery(`/products/${productId}/variants`, params));
    },
    createVariant(productId: string, payload: CreateVariantPayload) {
      return client.post<ProductVariant>(`/products/${productId}/variants`, payload);
    },
    updateVariant(productId: string, variantId: string, payload: UpdateVariantPayload) {
      return client.patch<ProductVariant>(`/products/${productId}/variants/${variantId}`, payload);
    },
    removeVariant(productId: string, variantId: string) {
      return client.delete<ApiDeleteResponse>(`/products/${productId}/variants/${variantId}`);
    },
    listModifierLinks(productId: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<ProductModifierGroupLink[]>(withQuery(`/products/${productId}/modifier-groups`, params));
    },
    createModifierLink(productId: string, payload: CreateProductModifierLinkPayload) {
      return client.post<ProductModifierGroupLink>(`/products/${productId}/modifier-groups`, payload);
    },
    updateModifierLink(
      productId: string,
      linkId: string,
      payload: UpdateProductModifierLinkPayload,
    ) {
      return client.patch<ProductModifierGroupLink>(
        `/products/${productId}/modifier-groups/${linkId}`,
        payload,
      );
    },
    removeModifierLink(productId: string, linkId: string) {
      return client.delete<ApiDeleteResponse>(`/products/${productId}/modifier-groups/${linkId}`);
    },
    createStationRoute(productId: string, payload: { stationId: string }) {
      return client.post<{ id: string; productId: string; stationId: string; station?: { id: string; name: string; code: string } }>(
        `/products/${productId}/station-route`,
        payload,
      );
    },
    updateStationRoute(productId: string, payload: { stationId: string }) {
      return client.patch<{ id: string; productId: string; stationId: string; station?: { id: string; name: string; code: string } }>(
        `/products/${productId}/station-route`,
        payload,
      );
    },
    removeStationRoute(productId: string) {
      return client.delete<ApiDeleteResponse>(`/products/${productId}/station-route`);
    },
  };
}

export const catalogProductsApi = createCatalogProductsApi(adminApiClient);
