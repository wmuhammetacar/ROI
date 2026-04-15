import type { ApiClient } from '@roi/api-client';
import { posApiClient } from './client';
import type { Floor } from './pos-types';

export function createFloorsApi(client: ApiClient) {
  return {
    list() {
      return client.get<Floor[]>('/floors');
    },
  };
}

export const floorsApi = createFloorsApi(posApiClient);
