import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';
import type {
  InventoryDeleteResponse,
  IngredientDetail,
  Ingredient,
  StockMovement,
  WasteRecord,
} from './inventory-types';

export interface ListIngredientsQuery {
  isActive?: boolean;
  lowStockOnly?: boolean;
  q?: string;
  limit?: number;
}

export interface CreateIngredientPayload {
  name: string;
  sku?: string;
  unitId: string;
  currentStock: number;
  lowStockThreshold?: number;
  isActive?: boolean;
}

export interface UpdateIngredientPayload {
  name?: string;
  sku?: string;
  unitId?: string;
  lowStockThreshold?: number;
}

export interface UpdateIngredientActivePayload {
  isActive: boolean;
}

export interface AdjustStockPayload {
  adjustmentType: 'PLUS' | 'MINUS';
  quantity: number;
  notes?: string;
}

export interface CreateWastePayload {
  quantity: number;
  reason: string;
}

export interface ListWasteQuery {
  limit?: number;
}

export interface ListIngredientMovementsQuery {
  limit?: number;
}

export function createInventoryIngredientsApi(client: ApiClient) {
  return {
    list(query?: ListIngredientsQuery, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      if (query?.isActive !== undefined) params.set('isActive', String(query.isActive));
      if (query?.lowStockOnly !== undefined) params.set('lowStockOnly', String(query.lowStockOnly));
      if (query?.q?.trim()) params.set('q', query.q.trim());
      if (query?.limit) params.set('limit', String(query.limit));
      return client.get<Ingredient[]>(withQuery('/ingredients', params));
    },
    getById(id: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<Ingredient>(withQuery(`/ingredients/${id}`, params));
    },
    getDetail(id: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<IngredientDetail>(withQuery(`/ingredients/${id}/detail`, params));
    },
    create(payload: CreateIngredientPayload) {
      return client.post<Ingredient>('/ingredients', payload);
    },
    update(id: string, payload: UpdateIngredientPayload) {
      return client.patch<Ingredient>(`/ingredients/${id}`, payload);
    },
    remove(id: string) {
      return client.delete<InventoryDeleteResponse>(`/ingredients/${id}`);
    },
    updateActiveState(id: string, payload: UpdateIngredientActivePayload) {
      return client.patch<Ingredient>(`/ingredients/${id}/active-state`, payload);
    },
    adjustStock(id: string, payload: AdjustStockPayload) {
      return client.post<Ingredient>(`/ingredients/${id}/adjust-stock`, payload);
    },
    createWaste(id: string, payload: CreateWastePayload) {
      return client.post<{ wasteRecord: WasteRecord } & { ingredient: Ingredient }>(
        `/ingredients/${id}/waste`,
        payload,
      );
    },
    listWasteRecords(id: string, query?: ListWasteQuery, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      if (query?.limit) params.set('limit', String(query.limit));
      return client.get<WasteRecord[]>(withQuery(`/ingredients/${id}/waste-records`, params));
    },
    listStockMovements(id: string, query?: ListIngredientMovementsQuery, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      if (query?.limit) params.set('limit', String(query.limit));
      return client.get<StockMovement[]>(withQuery(`/ingredients/${id}/stock-movements`, params));
    },
  };
}

export const inventoryIngredientsApi = createInventoryIngredientsApi(adminApiClient);
