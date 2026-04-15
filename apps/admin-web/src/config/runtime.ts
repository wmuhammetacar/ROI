const FALLBACK_LOCAL_API_BASE_URL = 'http://localhost:3002/api/v1';

function deriveRealtimeBaseUrl(apiBaseUrl: string) {
  return apiBaseUrl.replace(/\/api\/v\d+\/?$/, '').replace(/\/+$/, '');
}

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  if (import.meta.env.PROD && typeof window !== 'undefined') {
    return `${window.location.origin}/api/v1`;
  }

  return FALLBACK_LOCAL_API_BASE_URL;
}

export const ADMIN_API_BASE_URL = resolveApiBaseUrl();
export const ADMIN_REALTIME_BASE_URL =
  import.meta.env.VITE_REALTIME_BASE_URL?.trim().replace(/\/+$/, '') ??
  deriveRealtimeBaseUrl(ADMIN_API_BASE_URL);
export const ADMIN_SESSION_EXPIRED_EVENT = 'roi:admin-session-expired';

