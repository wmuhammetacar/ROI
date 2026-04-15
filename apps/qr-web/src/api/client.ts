import { createApiClient } from '@roi/api-client';
import { QR_API_BASE_URL } from '../config/runtime';

export const qrApiClient = createApiClient({
  baseUrl: QR_API_BASE_URL,
});
