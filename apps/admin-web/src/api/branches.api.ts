import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';

export interface BranchSummary {
  id: string;
  name: string;
  code?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export function createBranchesApi(client: ApiClient) {
  return {
    list() {
      return client.get<BranchSummary[]>('/branches');
    },
  };
}

export const branchesApi = createBranchesApi(adminApiClient);
