import type { ApiClient } from '@roi/api-client';
import { kdsApiClient } from './client';
import type { Station } from './kds-types';

export function createStationsApi(client: ApiClient) {
  return {
    list() {
      return client.get<Station[]>('/stations');
    },
    getById(id: string) {
      return client.get<Station>(`/stations/${id}`);
    },
  };
}

export const stationsApi = createStationsApi(kdsApiClient);
