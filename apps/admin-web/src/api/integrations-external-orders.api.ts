import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';
import type { ExternalOrder, ExternalOrderIngestionStatus } from './integrations-types';

export interface ListExternalOrdersQuery {
  providerId?: string;
  externalOrderId?: string;
  ingestionStatus?: ExternalOrderIngestionStatus;
  serviceType?: string;
  limit?: number;
}

export function createIntegrationsExternalOrdersApi(client: ApiClient) {
  return {
    list(query: ListExternalOrdersQuery = {}, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      if (query.providerId) params.set('providerId', query.providerId);
      if (query.externalOrderId) params.set('externalOrderId', query.externalOrderId);
      if (query.ingestionStatus) params.set('ingestionStatus', query.ingestionStatus);
      if (query.serviceType) params.set('serviceType', query.serviceType);
      if (query.limit) params.set('limit', String(query.limit));
      return client.get<ExternalOrder[]>(withQuery('/integrations/external-orders', params));
    },
    getById(id: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<ExternalOrder>(withQuery(`/integrations/external-orders/${id}`, params));
    },
  };
}

export const integrationsExternalOrdersApi = createIntegrationsExternalOrdersApi(adminApiClient);
