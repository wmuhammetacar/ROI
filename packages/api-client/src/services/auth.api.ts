import type { AuthLoginRequest, AuthLoginResponse } from '@roi/shared-types';
import type { ApiClient } from '../http/api-client';

export function createAuthApi(client: ApiClient) {
  return {
    login(payload: AuthLoginRequest) {
      return client.post<AuthLoginResponse>('/auth/login', payload);
    },
  };
}
