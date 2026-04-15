import type { SessionUser } from '@roi/shared-types';
import type { ApiClient } from '../http/api-client';

export function createUsersApi(client: ApiClient) {
  return {
    me() {
      return client.get<SessionUser>('/users/me');
    },
  };
}
