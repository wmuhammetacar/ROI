import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import type { TestIngestOrderResponse } from './integrations-types';

export interface TestIngestOrderPayload {
  branchId?: string;
  payload: Record<string, unknown>;
}

export function createIntegrationsTestIngestApi(client: ApiClient) {
  return {
    ingestOrder(providerId: string, payload: TestIngestOrderPayload) {
      return client.post<TestIngestOrderResponse>(
        `/integrations/providers/${providerId}/test-ingest-order`,
        payload,
      );
    },
  };
}

export const integrationsTestIngestApi = createIntegrationsTestIngestApi(adminApiClient);
