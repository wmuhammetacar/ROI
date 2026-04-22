import type { ApiClient } from '@roi/api-client';
import { qrApiClient } from './client';
import type { PublicCreateWaiterCallPayload, PublicWaiterCallResponse } from './types';

export function createPublicWaiterCallsApi(client: ApiClient) {
  return {
    createWaiterCall(payload: PublicCreateWaiterCallPayload) {
      return client.post<PublicWaiterCallResponse>('/public/waiter-calls', payload);
    },
  };
}

export const publicWaiterCallsApi = createPublicWaiterCallsApi(qrApiClient);
