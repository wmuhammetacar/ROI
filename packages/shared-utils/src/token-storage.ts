export interface TokenStorage {
  getToken(): string | null;
  setToken(token: string): void;
  clearToken(): void;
}

export function createTokenStorage(key: string): TokenStorage {
  const getStorage = (): Storage | null => {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.localStorage;
  };

  return {
    getToken() {
      return getStorage()?.getItem(key) ?? null;
    },
    setToken(token: string) {
      getStorage()?.setItem(key, token);
    },
    clearToken() {
      getStorage()?.removeItem(key);
    },
  };
}
