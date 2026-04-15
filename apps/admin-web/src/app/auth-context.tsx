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
import type { AuthLoginRequest, ConnectionState, SessionUser } from '@roi/shared-types';
import { reportClientError } from '@roi/shared-utils';
import { adminAuthApi, adminSystemApi, adminTokenStorage, adminUsersApi } from '../api/client';
import { ADMIN_SESSION_EXPIRED_EVENT } from '../config/runtime';

interface AuthContextValue {
  user: SessionUser | null;
  isBootstrapping: boolean;
  connectionState: ConnectionState;
  login: (payload: AuthLoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [connectionState, setConnectionState] = useState<ConnectionState>('checking');

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        await adminSystemApi.health();
        if (active) {
          setConnectionState('online');
        }
      } catch {
        if (active) {
          setConnectionState('offline');
        }
      }

      const token = adminTokenStorage.getToken();
      if (!token) {
        if (active) {
          setIsBootstrapping(false);
        }
        return;
      }

      try {
        const currentUser = await adminUsersApi.me();
        if (active) {
          setUser(currentUser);
        }
      } catch {
        adminTokenStorage.clearToken();
        if (active) {
          setUser(null);
        }
        reportClientError(new Error('Admin session bootstrap failed'), {
          app: 'admin-web',
          area: 'auth.bootstrap',
        });
      } finally {
        if (active) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (payload: AuthLoginRequest) => {
    const response = await adminAuthApi.login(payload);
    adminTokenStorage.setToken(response.accessToken);
    setUser(response.user);
    setConnectionState('online');
  }, []);

  const logout = useCallback(() => {
    adminTokenStorage.clearToken();
    setUser(null);
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      adminTokenStorage.clearToken();
      setUser(null);
      setConnectionState('offline');
    };

    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isBootstrapping,
      connectionState,
      login,
      logout,
    }),
    [connectionState, isBootstrapping, login, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new ApiError({ status: 500, message: 'Auth context is unavailable' });
  }

  return context;
}
