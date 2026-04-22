import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';

export interface StationSummary {
  id: string;
  name: string;
  code: string;
  stationType: string;
  isActive: boolean;
}

export function createStationsApi(client: ApiClient) {
  return {
    list() {
      return client.get<StationSummary[]>('/stations');
    },
  };
}

export const stationsApi = createStationsApi(adminApiClient);
