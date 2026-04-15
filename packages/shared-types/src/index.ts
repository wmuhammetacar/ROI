export type UserRole = 'admin' | 'cashier' | 'waiter';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  branchId: string;
  roles: UserRole[];
}

export interface AuthLoginRequest {
  email: string;
  password: string;
}

export interface AuthLoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
  user: SessionUser;
}

export interface ApiRootInfo {
  name: string;
  subtitle: string;
  version: string;
  status: 'ok' | 'degraded' | 'down' | string;
  timestamp: string;
}

export interface HealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
}

export type ConnectionState = 'checking' | 'online' | 'offline';

export interface AppNavItem {
  path: string;
  label: string;
}
