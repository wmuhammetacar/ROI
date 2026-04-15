import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from './session-context';

export function KdsShell() {
  const { user, connectionState, logout } = useSession();

  return (
    <div className="kds-shell">
      <header className="kds-header">
        <div>
          <strong>ROI Kitchen Display</strong>
          <span className="muted"> Operator: {user?.name}</span>
        </div>

        <div className="actions">
          <span className={`badge ${connectionState}`}>{connectionState}</span>
          <button type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <nav className="kds-nav">
        <NavLink to="/stations" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
          Stations
        </NavLink>
        <NavLink to="/board" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
          KDS Board
        </NavLink>
      </nav>

      <main className="kds-main">
        <Outlet />
      </main>
    </div>
  );
}
