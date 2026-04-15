import type { ApiClient } from '@roi/api-client';
import { posApiClient } from './client';
import type { RegisterShift } from './pos-types';

export function createRegisterShiftsApi(client: ApiClient) {
  return {
    getCurrentOpen() {
      return client.get<RegisterShift | null>('/register-shifts/open/current');
    },
  };
}

export const registerShiftsApi = createRegisterShiftsApi(posApiClient);
