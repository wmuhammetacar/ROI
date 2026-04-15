import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, createAuthApi } from '@roi/api-client';
import type { AuthLoginRequest, ConnectionState, SessionUser } from '@roi/shared-types';
import { reportClientError } from '@roi/shared-utils';
import { kdsApiClient, kdsSystemApi, kdsTokenStorage, kdsUsersApi } from '../api/client';
import { KDS_SESSION_EXPIRED_EVENT } from '../config/runtime';

interface SessionContextValue {
  user: SessionUser | null;
  isLoadingSession: boolean;
  connectionState: ConnectionState;
  login: (payload: AuthLoginRequest) => Promise<void>;
  logout: () => void;
}

const authApi = createAuthApi(kdsApiClient);

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [connectionState, setConnectionState] = useState<ConnectionState>('checking');

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        await kdsSystemApi.health();
        if (active) {
          setConnectionState('online');
        }
      } catch {
        if (active) {
          setConnectionState('offline');
        }
      }

      const token = kdsTokenStorage.getToken();
      if (!token) {
        if (active) {
          setIsLoadingSession(false);
        }
        return;
      }

      try {
        const currentUser = await kdsUsersApi.me();
        if (active) {
          setUser(currentUser);
        }
      } catch {
        kdsTokenStorage.clearToken();
        reportClientError(new Error('KDS session bootstrap failed'), {
          app: 'kitchen-display',
          area: 'session.bootstrap',
        });
      } finally {
        if (active) {
          setIsLoadingSession(false);
        }
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (payload: AuthLoginRequest) => {
    const response = await authApi.login(payload);
    kdsTokenStorage.setToken(response.accessToken);
    setUser(response.user);
    setConnectionState('online');
  }, []);

  const logout = useCallback(() => {
    kdsTokenStorage.clearToken();
    setUser(null);
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      kdsTokenStorage.clearToken();
      setUser(null);
      setConnectionState('offline');
    };

    window.addEventListener(KDS_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(KDS_SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      isLoadingSession,
      connectionState,
      login,
      logout,
    }),
    [connectionState, isLoadingSession, login, logout, user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);

  if (!context) {
    throw new ApiError({ status: 500, message: 'Session context is unavailable' });
  }

  return context;
}
