import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';
import type {
  ApiDeleteResponse,
  ModifierGroup,
  ModifierOption,
  ModifierSelectionType,
} from './catalog-types';

export interface CreateModifierGroupPayload {
  name: string;
  description?: string;
  selectionType: ModifierSelectionType;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  isActive?: boolean;
}

export interface UpdateModifierGroupPayload {
  name?: string;
  description?: string;
  selectionType?: ModifierSelectionType;
  minSelect?: number;
  maxSelect?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateModifierOptionPayload {
  name: string;
  priceDelta: number;
  sortOrder: number;
  isActive?: boolean;
}

export interface UpdateModifierOptionPayload {
  name?: string;
  priceDelta?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export function createCatalogModifiersApi(client: ApiClient) {
  return {
    listGroups(branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<ModifierGroup[]>(withQuery('/modifier-groups', params));
    },
    getGroupById(id: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<ModifierGroup>(withQuery(`/modifier-groups/${id}`, params));
    },
    createGroup(payload: CreateModifierGroupPayload) {
      return client.post<ModifierGroup>('/modifier-groups', payload);
    },
    updateGroup(id: string, payload: UpdateModifierGroupPayload) {
      return client.patch<ModifierGroup>(`/modifier-groups/${id}`, payload);
    },
    removeGroup(id: string) {
      return client.delete<ApiDeleteResponse>(`/modifier-groups/${id}`);
    },
    listOptions(groupId: string, branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<ModifierOption[]>(withQuery(`/modifier-groups/${groupId}/options`, params));
    },
    createOption(groupId: string, payload: CreateModifierOptionPayload) {
      return client.post<ModifierOption>(`/modifier-groups/${groupId}/options`, payload);
    },
    updateOption(groupId: string, optionId: string, payload: UpdateModifierOptionPayload) {
      return client.patch<ModifierOption>(`/modifier-groups/${groupId}/options/${optionId}`, payload);
    },
    removeOption(groupId: string, optionId: string) {
      return client.delete<ApiDeleteResponse>(`/modifier-groups/${groupId}/options/${optionId}`);
    },
  };
}

export const catalogModifiersApi = createCatalogModifiersApi(adminApiClient);
