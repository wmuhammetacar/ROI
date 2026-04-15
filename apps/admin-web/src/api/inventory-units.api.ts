import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import type { InventoryDeleteResponse, UnitKind, UnitOfMeasure } from './inventory-types';

export interface CreateUnitPayload {
  name: string;
  code: string;
  kind: UnitKind;
}

export interface UpdateUnitPayload {
  name?: string;
  code?: string;
  kind?: UnitKind;
}

export function createInventoryUnitsApi(client: ApiClient) {
  return {
    list() {
      return client.get<UnitOfMeasure[]>('/units');
    },
    getById(id: string) {
      return client.get<UnitOfMeasure>(`/units/${id}`);
    },
    create(payload: CreateUnitPayload) {
      return client.post<UnitOfMeasure>('/units', payload);
    },
    update(id: string, payload: UpdateUnitPayload) {
      return client.patch<UnitOfMeasure>(`/units/${id}`, payload);
    },
    remove(id: string) {
      return client.delete<InventoryDeleteResponse>(`/units/${id}`);
    },
  };
}

export const inventoryUnitsApi = createInventoryUnitsApi(adminApiClient);
