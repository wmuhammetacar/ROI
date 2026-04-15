import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../app/auth-context';
import { BranchScopeBanner } from '../../components';
import { IntegrationsConfigsPage } from './integrations-configs-page';
import { IntegrationsExternalOrdersPage } from './integrations-external-orders-page';
import { IntegrationsMappingsPage } from './integrations-mappings-page';
import { IntegrationsProvidersPage } from './integrations-providers-page';
import { IntegrationsSyncAttemptsPage } from './integrations-sync-attempts-page';

const integrationRoutes = [
  { path: '/integrations/providers', label: 'Providers' },
  { path: '/integrations/configs', label: 'Configs' },
  { path: '/integrations/mappings', label: 'Mappings' },
  { path: '/integrations/external-orders', label: 'External Orders' },
  { path: '/integrations/sync-attempts', label: 'Sync Attempts' },
];

function IntegrationsAccessGuard() {
  const { user } = useAuth();

  if (!user?.roles.includes('admin')) {
    return (
      <section className="page-card">
        <h1>Integrations Access Restricted</h1>
        <p className="muted">Only admin users can manage external integrations.</p>
      </section>
    );
  }

  return <Outlet />;
}

function IntegrationsTabs() {
  return (
    <div className="inventory-tabs" role="tablist" aria-label="Integration sections">
      {integrationRoutes.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) => `inventory-tab ${isActive ? 'active' : ''}`}
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}

export function IntegrationsRoutes() {
  return (
    <Routes>
      <Route element={<IntegrationsAccessGuard />}>
        <Route
          path="/"
          element={
            <div className="inventory-page-grid">
              <BranchScopeBanner sectionLabel="Integrations" />
              <IntegrationsTabs />
              <Outlet />
            </div>
          }
        >
          <Route index element={<Navigate to="/integrations/providers" replace />} />
          <Route path="providers" element={<IntegrationsProvidersPage />} />
          <Route path="configs" element={<IntegrationsConfigsPage />} />
          <Route path="mappings" element={<IntegrationsMappingsPage />} />
          <Route path="external-orders" element={<IntegrationsExternalOrdersPage />} />
          <Route path="sync-attempts" element={<IntegrationsSyncAttemptsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
