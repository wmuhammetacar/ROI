import { createApiClient, createSystemApi, createUsersApi } from '@roi/api-client';
import { createTokenStorage, reportClientError } from '@roi/shared-utils';
import { KDS_API_BASE_URL, KDS_SESSION_EXPIRED_EVENT } from '../config/runtime';

export const kdsTokenStorage = createTokenStorage('roi_kds_access_token');

export const kdsApiClient = createApiClient({
  baseUrl: KDS_API_BASE_URL,
  getAccessToken: () => kdsTokenStorage.getToken(),
  onUnauthorized: () => {
    kdsTokenStorage.clearToken();
    window.dispatchEvent(new Event(KDS_SESSION_EXPIRED_EVENT));
    reportClientError(new Error('Session expired'), {
      app: 'kitchen-display',
      area: 'api-client.onUnauthorized',
    });
  },
});

export const kdsSystemApi = createSystemApi(kdsApiClient);
export const kdsUsersApi = createUsersApi(kdsApiClient);
