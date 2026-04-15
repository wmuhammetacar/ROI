import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../app/auth-context';
import { BranchScopeBanner } from '../../components';
import { ReportsSalesPage } from './reports-sales-page';
import { ReportsOrdersPage } from './reports-orders-page';
import { ReportsInventoryPage } from './reports-inventory-page';
import { ReportsOperationsPage } from './reports-operations-page';

const reportRoutes = [
  { path: '/reports/sales', label: 'Sales' },
  { path: '/reports/orders', label: 'Orders' },
  { path: '/reports/inventory', label: 'Inventory' },
  { path: '/reports/operations', label: 'Operations' },
];

function ReportsAccessGuard() {
  const { user } = useAuth();

  if (!user?.roles.includes('admin')) {
    return (
      <section className="page-card">
        <h1>Reports Access Restricted</h1>
        <p className="muted">Only admin users can access reporting dashboards.</p>
      </section>
    );
  }

  return <Outlet />;
}

function ReportsTabs() {
  return (
    <div className="reports-tabs" role="tablist" aria-label="Reports sections">
      {reportRoutes.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) => `reports-tab ${isActive ? 'active' : ''}`}
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}

export function ReportsRoutes() {
  return (
    <Routes>
      <Route element={<ReportsAccessGuard />}>
        <Route
          path="/"
          element={
            <div className="inventory-page-grid">
              <BranchScopeBanner sectionLabel="Reports" />
              <ReportsTabs />
              <Outlet />
            </div>
          }
        >
          <Route index element={<Navigate to="/reports/sales" replace />} />
          <Route path="sales" element={<ReportsSalesPage />} />
          <Route path="orders" element={<ReportsOrdersPage />} />
          <Route path="inventory" element={<ReportsInventoryPage />} />
          <Route path="operations" element={<ReportsOperationsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
