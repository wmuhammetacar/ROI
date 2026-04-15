import { NavLink, Outlet } from 'react-router-dom';
import type { AppNavItem } from '@roi/shared-types';
import { useAuth } from './auth-context';
import { useBranchContext } from './branch-context';
import { BranchIndicator, BranchSwitcher } from '../components';

const navItems: AppNavItem[] = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/branches', label: 'Branches' },
  { path: '/catalog/categories', label: 'Catalog' },
  { path: '/orders', label: 'Orders' },
  { path: '/stations', label: 'Stations' },
  { path: '/finance/shifts', label: 'Finance' },
  { path: '/inventory/summary', label: 'Inventory' },
  { path: '/reports/sales', label: 'Reports' },
  { path: '/integrations/providers', label: 'Integrations' },
  { path: '/settings', label: 'Settings' },
];

export function AdminShell() {
  const { user, connectionState, logout } = useAuth();
  const { activeBranchId } = useBranchContext();

  return (
    <div className="shell">
      <aside className="sidebar">
        <h2>ROI Admin</h2>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <div className="topbar-main">
            <strong>{user?.name}</strong>
            <span className="muted"> {user?.email}</span>
            <BranchIndicator />
          </div>
          <div className="topbar-branch">
            <BranchSwitcher />
          </div>
          <div className="topbar-actions">
            <span className={`pill ${connectionState}`}>{connectionState}</span>
            <button onClick={logout} type="button">
              Logout
            </button>
          </div>
        </header>

        <main className="page-wrap" key={activeBranchId ?? 'no-branch'}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
