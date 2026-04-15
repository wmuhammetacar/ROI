import type { ApiRootInfo, HealthResponse } from '@roi/shared-types';
import type { ApiClient } from '../http/api-client';

export function createSystemApi(client: ApiClient) {
  return {
    root() {
      return client.get<ApiRootInfo>('/');
    },
    health() {
      return client.get<HealthResponse>('/health');
    },
  };
}
