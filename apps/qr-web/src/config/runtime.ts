const FALLBACK_LOCAL_API_BASE_URL = 'http://localhost:3002/api/v1';

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

export const QR_API_BASE_URL = resolveApiBaseUrl();

