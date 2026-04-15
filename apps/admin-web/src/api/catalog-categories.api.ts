import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';
import type { ApiDeleteResponse, Category } from './catalog-types';

export interface CreateCategoryPayload {
  name: string;
  description?: string;
  sortOrder: number;
  isActive?: boolean;
}

export interface UpdateCategoryPayload {
  name?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export function createCatalogCategoriesApi(client: ApiClient) {
  return {
    list(branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<Category[]>(withQuery('/categories', params));
    },
    getById(id: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<Category>(withQuery(`/categories/${id}`, params));
    },
    create(payload: CreateCategoryPayload) {
      return client.post<Category>('/categories', payload);
    },
    update(id: string, payload: UpdateCategoryPayload) {
      return client.patch<Category>(`/categories/${id}`, payload);
    },
    remove(id: string) {
      return client.delete<ApiDeleteResponse>(`/categories/${id}`);
    },
  };
}

export const catalogCategoriesApi = createCatalogCategoriesApi(adminApiClient);
