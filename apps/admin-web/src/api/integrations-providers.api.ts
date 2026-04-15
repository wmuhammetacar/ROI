import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { withQuery } from './branch-scope';
import type { IntegrationProvider, IntegrationProviderType } from './integrations-types';

export interface ListIntegrationProvidersQuery {
  providerType?: IntegrationProviderType;
  isActive?: boolean;
}

export function createIntegrationsProvidersApi(client: ApiClient) {
  return {
    list(query: ListIntegrationProvidersQuery = {}) {
      const params = new URLSearchParams();
      if (query.providerType) params.set('providerType', query.providerType);
      if (query.isActive !== undefined) params.set('isActive', String(query.isActive));
      return client.get<IntegrationProvider[]>(withQuery('/integrations/providers', params));
    },
    getById(id: string) {
      return client.get<IntegrationProvider>(`/integrations/providers/${id}`);
    },
  };
}

export const integrationsProvidersApi = createIntegrationsProvidersApi(adminApiClient);
