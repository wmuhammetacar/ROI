import { createApiClient, createAuthApi, createSystemApi, createUsersApi } from '@roi/api-client';
import { createTokenStorage, reportClientError } from '@roi/shared-utils';
import type { AuthLoginResponse } from '@roi/shared-types';
import { POS_API_BASE_URL, POS_SESSION_EXPIRED_EVENT } from '../config/runtime';

export const posTokenStorage = createTokenStorage('roi_pos_access_token');

export const posApiClient = createApiClient({
  baseUrl: POS_API_BASE_URL,
  getAccessToken: () => posTokenStorage.getToken(),
  onUnauthorized: () => {
    posTokenStorage.clearToken();
    window.dispatchEvent(new Event(POS_SESSION_EXPIRED_EVENT));
    reportClientError(new Error('Session expired'), {
      app: 'pos-web',
      area: 'api-client.onUnauthorized',
    });
  },
});

export const posAuthApi = createAuthApi(posApiClient);
export const posStaffAuthApi = {
  staffLogin(payload: { username: string; pin?: string; password?: string }) {
    return posApiClient.post<AuthLoginResponse>('/auth/staff-login', payload);
  },
};
export const posUsersApi = createUsersApi(posApiClient);
export const posSystemApi = createSystemApi(posApiClient);
