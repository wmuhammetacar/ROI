import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../app/auth-context';
import { BranchScopeBanner } from '../../components';
import { FinanceDayEndPage } from './finance-day-end-page';
import { FinanceOrdersPage } from './finance-orders-page';
import { FinanceOrderDetailPage } from './finance-order-detail-page';
import { FinanceShiftsPage } from './finance-shifts-page';
import { FinanceShiftDetailPage } from './finance-shift-detail-page';

const financeRoutes = [
  { path: '/finance/shifts', label: 'Shifts' },
  { path: '/finance/orders', label: 'Orders' },
  { path: '/finance/day-end', label: 'Day End' },
];

function FinanceAccessGuard() {
  const { user } = useAuth();

  if (!user?.roles.includes('admin')) {
    return (
      <section className="page-card">
        <h1>Finance Access Restricted</h1>
        <p className="muted">Only admin users can manage shifts and financial audit flows.</p>
      </section>
    );
  }

  return <Outlet />;
}

function FinanceTabs() {
  return (
    <div className="inventory-tabs" role="tablist" aria-label="Finance sections">
      {financeRoutes.map((item) => (
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

export function FinanceRoutes() {
  return (
    <Routes>
      <Route element={<FinanceAccessGuard />}>
        <Route
          path="/"
          element={
            <div className="inventory-page-grid">
              <BranchScopeBanner sectionLabel="Finance" />
              <FinanceTabs />
              <Outlet />
            </div>
          }
        >
          <Route index element={<Navigate to="/finance/shifts" replace />} />
          <Route path="shifts" element={<FinanceShiftsPage />} />
          <Route path="shifts/:id" element={<FinanceShiftDetailPage />} />
          <Route path="orders" element={<FinanceOrdersPage />} />
          <Route path="orders/:id" element={<FinanceOrderDetailPage />} />
          <Route path="day-end" element={<FinanceDayEndPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
