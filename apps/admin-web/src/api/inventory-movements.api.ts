import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';
import type { StockMovement, StockMovementType, StockReferenceType } from './inventory-types';

export interface ListStockMovementsQuery {
  ingredientId?: string;
  movementType?: StockMovementType;
  referenceType?: StockReferenceType;
  limit?: number;
}

export function createInventoryMovementsApi(client: ApiClient) {
  return {
    list(query?: ListStockMovementsQuery, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      if (query?.ingredientId) params.set('ingredientId', query.ingredientId);
      if (query?.movementType) params.set('movementType', query.movementType);
      if (query?.referenceType) params.set('referenceType', query.referenceType);
      if (query?.limit) params.set('limit', String(query.limit));
      return client.get<StockMovement[]>(withQuery('/stock-movements', params));
    },
  };
}

export const inventoryMovementsApi = createInventoryMovementsApi(adminApiClient);
