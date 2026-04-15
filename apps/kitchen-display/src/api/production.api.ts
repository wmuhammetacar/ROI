import type { ApiClient } from '@roi/api-client';
import { kdsApiClient } from './client';
import type { ProductionTicket, ProductionTicketItemStatus } from './kds-types';

export interface UpdateProductionItemStatusPayload {
  status: ProductionTicketItemStatus;
  note?: string;
}

export function createProductionApi(client: ApiClient) {
  return {
    updateItemStatus(itemId: string, payload: UpdateProductionItemStatusPayload) {
      return client.patch<ProductionTicket>(`/production-ticket-items/${itemId}/status`, payload);
    },
  };
}

export const productionApi = createProductionApi(kdsApiClient);
