import type { ApiClient } from '@roi/api-client';
import { qrApiClient } from './client';
import type { PublicCreateOrderPayload, PublicOrderSubmissionResponse } from './types';

export function createPublicOrderingApi(client: ApiClient) {
  return {
    submitOrder(payload: PublicCreateOrderPayload) {
      return client.post<PublicOrderSubmissionResponse>('/public/orders', payload);
    },
  };
}

export const publicOrderingApi = createPublicOrderingApi(qrApiClient);
