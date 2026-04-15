import { Navigate, Route, Routes } from 'react-router-dom';
import { PosShell } from './app/pos-shell';
import { RouteGuard } from './app/route-guard';
import { LoginPage } from './pages/login-page';
import { OrderEntryPage } from './pages/order-entry-page';
import { PaymentsPage } from './pages/payments-page';
import { TablesPage } from './pages/tables-page';
import { PagePlaceholder } from './app/page-placeholder';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RouteGuard>
            <PosShell />
          </RouteGuard>
        }
      >
        <Route path="/" element={<Navigate to="/tables" replace />} />
        <Route path="/tables" element={<TablesPage />} />
        <Route
          path="/quick-sale"
          element={<PagePlaceholder title="Quick Sale" description="Fast cashier flow for takeaway sales." />}
        />
        <Route path="/order-entry" element={<OrderEntryPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/tables" replace />} />
    </Routes>
  );
}
