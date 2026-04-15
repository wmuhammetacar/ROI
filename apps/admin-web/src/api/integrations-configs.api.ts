import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';
import type { BranchIntegrationConfig, BranchIntegrationConfigStatus } from './integrations-types';

export interface ListIntegrationConfigsQuery {
  providerId?: string;
  status?: BranchIntegrationConfigStatus;
  limit?: number;
}

export interface CreateIntegrationConfigPayload {
  branchId: string;
  providerId: string;
  status?: BranchIntegrationConfigStatus;
  credentialsJson?: Record<string, unknown>;
  settingsJson?: Record<string, unknown>;
}

export interface UpdateIntegrationConfigPayload {
  status?: BranchIntegrationConfigStatus;
  credentialsJson?: Record<string, unknown>;
  settingsJson?: Record<string, unknown>;
}

export function createIntegrationsConfigsApi(client: ApiClient) {
  return {
    list(query: ListIntegrationConfigsQuery = {}, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      if (query.providerId) params.set('providerId', query.providerId);
      if (query.status) params.set('status', query.status);
      if (query.limit) params.set('limit', String(query.limit));
      return client.get<BranchIntegrationConfig[]>(withQuery('/integrations/configs', params));
    },
    getById(id: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<BranchIntegrationConfig>(withQuery(`/integrations/configs/${id}`, params));
    },
    create(payload: CreateIntegrationConfigPayload) {
      return client.post<BranchIntegrationConfig>('/integrations/configs', payload);
    },
    update(id: string, payload: UpdateIntegrationConfigPayload) {
      return client.patch<BranchIntegrationConfig>(`/integrations/configs/${id}`, payload);
    },
    updateStatus(id: string, status: BranchIntegrationConfigStatus) {
      return client.patch<BranchIntegrationConfig>(`/integrations/configs/${id}/status`, { status });
    },
  };
}

export const integrationsConfigsApi = createIntegrationsConfigsApi(adminApiClient);
