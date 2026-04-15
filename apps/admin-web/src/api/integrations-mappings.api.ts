import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';
import type { MenuMapping } from './integrations-types';

export interface ListIntegrationMappingsQuery {
  providerId?: string;
  isActive?: boolean;
  limit?: number;
}

export interface CreateIntegrationMappingPayload {
  branchId: string;
  providerId: string;
  externalItemId: string;
  externalItemName: string;
  productId: string;
  variantId?: string;
  isActive?: boolean;
}

export interface UpdateIntegrationMappingPayload {
  externalItemName?: string;
  productId?: string;
  variantId?: string | null;
  isActive?: boolean;
}

export function createIntegrationsMappingsApi(client: ApiClient) {
  return {
    list(query: ListIntegrationMappingsQuery = {}, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      if (query.providerId) params.set('providerId', query.providerId);
      if (query.isActive !== undefined) params.set('isActive', String(query.isActive));
      if (query.limit) params.set('limit', String(query.limit));
      return client.get<MenuMapping[]>(withQuery('/integrations/menu-mappings', params));
    },
    create(payload: CreateIntegrationMappingPayload) {
      return client.post<MenuMapping>('/integrations/menu-mappings', payload);
    },
    update(id: string, payload: UpdateIntegrationMappingPayload) {
      return client.patch<MenuMapping>(`/integrations/menu-mappings/${id}`, payload);
    },
    remove(id: string) {
      return client.delete<{ message: string }>(`/integrations/menu-mappings/${id}`);
    },
  };
}

export const integrationsMappingsApi = createIntegrationsMappingsApi(adminApiClient);
