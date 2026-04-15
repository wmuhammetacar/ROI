import type { ApiClient } from '@roi/api-client';
import { kdsApiClient } from './client';
import type { KdsQueueResponse, KdsSummaryResponse } from './kds-types';

export function createKdsApi(client: ApiClient) {
  return {
    getQueue(stationId: string) {
      return client.get<KdsQueueResponse>(`/stations/${stationId}/kds/queue`);
    },
    getSummary(stationId: string) {
      return client.get<KdsSummaryResponse>(`/stations/${stationId}/kds/summary`);
    },
  };
}

export const kdsApi = createKdsApi(kdsApiClient);
