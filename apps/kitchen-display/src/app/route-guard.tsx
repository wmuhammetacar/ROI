import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from './session-context';

export function RouteGuard({ children }: { children: ReactNode }) {
  const { user, isLoadingSession } = useSession();
  const location = useLocation();

  if (isLoadingSession) {
    return <div className="screen-center">KDS session is loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
