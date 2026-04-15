import { ApiError } from './api-error';

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null;
  onUnauthorized?: () => void;
  fetchFn?: typeof fetch;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly getAccessToken?: () => string | null;
  private readonly onUnauthorized?: () => void;
  private readonly fetchFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.getAccessToken = options.getAccessToken;
    this.onUnauthorized = options.onUnauthorized;
    const baseFetch = options.fetchFn ?? globalThis.fetch;
    // Firefox requires window-bound fetch; unbound calls can throw illegal invocation.
    this.fetchFn = baseFetch.bind(globalThis);
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body: this.toJson(body) });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body: this.toJson(body) });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const token = this.getAccessToken?.();
    const headers = new Headers(init.headers ?? undefined);

    if (!headers.has('Content-Type') && init.body) {
      headers.set('Content-Type', 'application/json');
    }

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    const contentType = response.headers.get('content-type') ?? '';
    const body = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);

    if (!response.ok) {
      if (response.status === 401) {
        this.onUnauthorized?.();
      }

      const fallbackMessage = `Request failed with status ${response.status}`;
      const message =
        (typeof body === 'object' && body && 'message' in body && typeof body.message === 'string'
          ? body.message
          : typeof body === 'object' &&
              body &&
              'error' in body &&
              typeof body.error === 'object' &&
              body.error &&
              'message' in body.error &&
              typeof body.error.message === 'string'
            ? body.error.message
          : undefined) ?? fallbackMessage;

      throw new ApiError({
        status: response.status,
        message,
        details: body,
      });
    }

    return body as T;
  }

  private toJson(body: unknown): BodyInit | undefined {
    if (body === undefined) {
      return undefined;
    }

    return JSON.stringify(body);
  }
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  return new ApiClient(options);
}
