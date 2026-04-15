import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';
import type {
  IntegrationSyncAttempt,
  IntegrationSyncDirection,
  IntegrationSyncStatus,
} from './integrations-types';

export interface ListSyncAttemptsQuery {
  providerId?: string;
  direction?: IntegrationSyncDirection;
  status?: IntegrationSyncStatus;
  limit?: number;
}

export function createIntegrationsSyncAttemptsApi(client: ApiClient) {
  return {
    list(query: ListSyncAttemptsQuery = {}, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      if (query.providerId) params.set('providerId', query.providerId);
      if (query.direction) params.set('direction', query.direction);
      if (query.status) params.set('status', query.status);
      if (query.limit) params.set('limit', String(query.limit));
      return client.get<IntegrationSyncAttempt[]>(withQuery('/integrations/sync-attempts', params));
    },
  };
}

export const integrationsSyncAttemptsApi = createIntegrationsSyncAttemptsApi(adminApiClient);
