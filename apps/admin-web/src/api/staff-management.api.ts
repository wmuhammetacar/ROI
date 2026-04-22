import type { ApiClient } from '@roi/api-client';
import { adminApiClient } from './client';
import { appendBranchScope, withQuery } from './branch-scope';

export type StaffRole = 'waiter' | 'cashier' | 'manager' | 'production';

export interface StaffUser {
  id: string;
  name: string;
  username: string;
  email: string;
  branchId: string;
  branchName: string;
  isActive: boolean;
  roles: string[];
  createdAt: string;
}

export interface CreateStaffPayload {
  name: string;
  username: string;
  email: string;
  branchId: string;
  roleNames: string[];
  password?: string;
  pin?: string;
  isActive?: boolean;
}

export function createStaffManagementApi(client: ApiClient) {
  return {
    list(branchId?: string) {
      const params = appendBranchScope(undefined, branchId);
      return client.get<StaffUser[]>(withQuery('/users/staff', params));
    },
    create(payload: CreateStaffPayload) {
      return client.post<StaffUser>('/users/staff', payload);
    },
    setActive(userId: string, isActive: boolean) {
      return client.patch<StaffUser>(`/users/staff/${userId}/active`, { isActive });
    },
  };
}

export const staffManagementApi = createStaffManagementApi(adminApiClient);
