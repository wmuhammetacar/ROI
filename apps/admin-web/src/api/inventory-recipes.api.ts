import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';
import type { InventoryDeleteResponse, Recipe, RecipeItem } from './inventory-types';

export interface ListRecipesQuery {
  isActive?: boolean;
  productId?: string;
  productVariantId?: string;
  limit?: number;
}

export interface CreateRecipePayload {
  name: string;
  productId?: string;
  productVariantId?: string;
  isActive?: boolean;
}

export interface UpdateRecipePayload {
  name?: string;
  productId?: string;
  productVariantId?: string;
  isActive?: boolean;
}

export interface CreateRecipeItemPayload {
  ingredientId: string;
  quantity: number;
}

export interface UpdateRecipeItemPayload {
  ingredientId?: string;
  quantity?: number;
}

export function createInventoryRecipesApi(client: ApiClient) {
  return {
    list(query?: ListRecipesQuery, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      if (query?.isActive !== undefined) params.set('isActive', String(query.isActive));
      if (query?.productId) params.set('productId', query.productId);
      if (query?.productVariantId) params.set('productVariantId', query.productVariantId);
      if (query?.limit) params.set('limit', String(query.limit));
      return client.get<Recipe[]>(withQuery('/recipes', params));
    },
    getById(id: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<Recipe>(withQuery(`/recipes/${id}`, params));
    },
    create(payload: CreateRecipePayload) {
      return client.post<Recipe>('/recipes', payload);
    },
    update(id: string, payload: UpdateRecipePayload) {
      return client.patch<Recipe>(`/recipes/${id}`, payload);
    },
    remove(id: string) {
      return client.delete<InventoryDeleteResponse>(`/recipes/${id}`);
    },
    listItems(recipeId: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<RecipeItem[]>(withQuery(`/recipes/${recipeId}/items`, params));
    },
    addItem(recipeId: string, payload: CreateRecipeItemPayload) {
      return client.post<RecipeItem>(`/recipes/${recipeId}/items`, payload);
    },
    updateItem(recipeId: string, itemId: string, payload: UpdateRecipeItemPayload) {
      return client.patch<RecipeItem>(`/recipes/${recipeId}/items/${itemId}`, payload);
    },
    removeItem(recipeId: string, itemId: string) {
      return client.delete<InventoryDeleteResponse>(`/recipes/${recipeId}/items/${itemId}`);
    },
  };
}

export const inventoryRecipesApi = createInventoryRecipesApi(adminApiClient);
