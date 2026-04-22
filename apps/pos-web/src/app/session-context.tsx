import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError } from '@roi/api-client';
import type { ConnectionState, SessionUser } from '@roi/shared-types';
import { reportClientError } from '@roi/shared-utils';
import { posAuthApi, posStaffAuthApi, posSystemApi, posTokenStorage, posUsersApi } from '../api/client';
import { POS_SESSION_EXPIRED_EVENT } from '../config/runtime';

interface SessionContextValue {
  user: SessionUser | null;
  isLoadingSession: boolean;
  connectionState: ConnectionState;
  login: (payload: { username: string; pin?: string; password?: string } | { email: string; password: string }) => Promise<void>;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [connectionState, setConnectionState] = useState<ConnectionState>('checking');

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        await posSystemApi.health();
        if (active) {
          setConnectionState('online');
        }
      } catch {
        if (active) {
          setConnectionState('offline');
        }
      }

      const token = posTokenStorage.getToken();
      if (!token) {
        if (active) {
          setIsLoadingSession(false);
        }
        return;
      }

      try {
        const currentUser = await posUsersApi.me();
        if (active) {
          setUser(currentUser);
        }
      } catch {
        posTokenStorage.clearToken();
        reportClientError(new Error('POS session bootstrap failed'), {
          app: 'pos-web',
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

  const login = useCallback(async (payload: { username: string; pin?: string; password?: string } | { email: string; password: string }) => {
    const response =
      'username' in payload
        ? await posStaffAuthApi.staffLogin(payload)
        : await posAuthApi.login(payload);
    posTokenStorage.setToken(response.accessToken);
    setUser(response.user);
    setConnectionState('online');
  }, []);

  const logout = useCallback(() => {
    posTokenStorage.clearToken();
    setUser(null);
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      posTokenStorage.clearToken();
      setUser(null);
      setConnectionState('offline');
    };

    window.addEventListener(POS_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(POS_SESSION_EXPIRED_EVENT, handleSessionExpired);
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
