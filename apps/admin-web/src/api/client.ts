import { createApiClient, createAuthApi, createSystemApi, createUsersApi } from '@roi/api-client';
import { createTokenStorage, reportClientError } from '@roi/shared-utils';
import { ADMIN_API_BASE_URL, ADMIN_SESSION_EXPIRED_EVENT } from '../config/runtime';

export const adminTokenStorage = createTokenStorage('roi_admin_access_token');

export const adminApiClient = createApiClient({
  baseUrl: ADMIN_API_BASE_URL,
  getAccessToken: () => adminTokenStorage.getToken(),
  onUnauthorized: () => {
    adminTokenStorage.clearToken();
    window.dispatchEvent(new Event(ADMIN_SESSION_EXPIRED_EVENT));
    reportClientError(new Error('Session expired'), {
      app: 'admin-web',
      area: 'api-client.onUnauthorized',
    });
  },
});

export const adminAuthApi = createAuthApi(adminApiClient);
export const adminUsersApi = createUsersApi(adminApiClient);
export const adminSystemApi = createSystemApi(adminApiClient);
