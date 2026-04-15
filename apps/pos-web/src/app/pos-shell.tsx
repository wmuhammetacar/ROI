import { NavLink, Outlet } from 'react-router-dom';
import type { AppNavItem } from '@roi/shared-types';
import { useSession } from './session-context';

const tabs: AppNavItem[] = [
  { path: '/tables', label: 'Tables' },
  { path: '/quick-sale', label: 'Quick Sale' },
  { path: '/order-entry', label: 'Order Entry' },
  { path: '/payments', label: 'Payments' },
];

export function PosShell() {
  const { user, connectionState, logout } = useSession();

  return (
    <div className="pos-shell">
      <header className="pos-header">
        <div>
          <strong>{user?.name}</strong>
          <span className="muted"> Branch: {user?.branchId ?? '-'}</span>
        </div>

        <div className="status-row">
          <span className={`status ${connectionState}`}>Connection: {connectionState}</span>
          <button type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <nav className="tabs">
        {tabs.map((tab) => (
          <NavLink key={tab.path} to={tab.path} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <main className="pos-content">
        <Outlet />
      </main>
    </div>
  );
}
