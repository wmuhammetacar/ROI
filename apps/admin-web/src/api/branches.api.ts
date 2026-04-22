import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';

export interface BranchSummary {
  id: string;
  name: string;
  code?: string | null;
  allowedNetworkCidrs?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export function createBranchesApi(client: ApiClient) {
  return {
    list() {
      return client.get<BranchSummary[]>('/branches');
    },
    updateNetworkSettings(id: string, allowedNetworkCidrs: string[]) {
      return client.patch<BranchSummary>(`/branches/${id}/network-settings`, { allowedNetworkCidrs });
    },
  };
}

export const branchesApi = createBranchesApi(adminApiClient);
