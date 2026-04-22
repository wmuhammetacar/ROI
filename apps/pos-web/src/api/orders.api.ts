import type { ApiClient } from '@roi/api-client';
import { posApiClient } from './client';
import type { ApiMessage, Order } from './pos-types';

export interface CreateOrderPayload {
  serviceType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'QUICK_SALE';
  tableSessionId?: string;
  notes?: string;
}

export interface ListOrdersQuery {
  tableSessionId?: string;
  serviceType?: string;
  status?: string;
  limit?: number;
}

export interface CatalogModifierSelectionInput {
  modifierGroupId: string;
  optionIds?: string[];
}

export interface AddCatalogItemPayload {
  productId: string;
  variantId?: string | null;
  quantity: number;
  notes?: string;
  modifierSelections?: CatalogModifierSelectionInput[];
}

export interface AddManualItemPayload {
  productNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  stationCode?: string;
  notes?: string;
}

export interface UpdateCatalogItemPayload {
  productId?: string;
  variantId?: string | null;
  quantity?: number;
  notes?: string;
  modifierSelections?: CatalogModifierSelectionInput[];
}

export interface UpdateManualItemPayload {
  productNameSnapshot?: string;
  quantity?: number;
  unitPrice?: number;
  notes?: string;
}

export function createOrdersApi(client: ApiClient) {
  return {
    list(query: ListOrdersQuery) {
      const params = new URLSearchParams();
      if (query.tableSessionId) params.set('tableSessionId', query.tableSessionId);
      if (query.serviceType) params.set('serviceType', query.serviceType);
      if (query.status) params.set('status', query.status);
      if (query.limit) params.set('limit', String(query.limit));
      const suffix = params.toString();
      return client.get<Order[]>(`/orders${suffix ? `?${suffix}` : ''}`);
    },
    getById(id: string) {
      return client.get<Order>(`/orders/${id}`);
    },
    create(payload: CreateOrderPayload) {
      return client.post<Order>('/orders', payload);
    },
    addCatalogItem(orderId: string, payload: AddCatalogItemPayload) {
      return client.post<Order>(`/orders/${orderId}/items/catalog`, payload);
    },
    addItem(orderId: string, payload: AddManualItemPayload) {
      return client.post<Order>(`/orders/${orderId}/items`, payload);
    },
    updateCatalogItem(orderId: string, itemId: string, payload: UpdateCatalogItemPayload) {
      return client.patch<Order>(`/orders/${orderId}/items/${itemId}/catalog`, payload);
    },
    updateItem(orderId: string, itemId: string, payload: UpdateManualItemPayload) {
      return client.patch<Order>(`/orders/${orderId}/items/${itemId}`, payload);
    },
    removeItem(orderId: string, itemId: string) {
      return client.delete<Order>(`/orders/${orderId}/items/${itemId}`);
    },
    sendToStation(orderId: string) {
      return client.post<ApiMessage>(`/orders/${orderId}/send`);
    },
  };
}

export const ordersApi = createOrdersApi(posApiClient);
