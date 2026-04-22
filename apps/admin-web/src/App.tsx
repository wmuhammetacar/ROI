import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminShell } from './app/admin-shell';
import { PagePlaceholder } from './app/page-placeholder';
import { RouteGuard } from './app/route-guard';
import { LoginPage } from './pages/login-page';
import { CatalogRoutes } from './pages/catalog/catalog-layout';
import { InventoryRoutes } from './pages/inventory/inventory-layout';
import { FinanceRoutes } from './pages/finance/finance-layout';
import { ReportsRoutes } from './pages/reports/reports-layout';
import { DashboardPage } from './pages/dashboard-page';
import { BranchesPage } from './pages/branches/branches-page';
import { BranchDetailPage } from './pages/branches/branch-detail-page';
import { IntegrationsRoutes } from './pages/integrations/integrations-layout';
import { OperationsCenterPage } from './pages/operations-center-page';
import { StaffManagementPage } from './pages/operations/staff-management-page';
import { PrinterManagementPage } from './pages/operations/printer-management-page';
import { NetworkAccessSettingsPage } from './pages/operations/network-access-settings-page';
import { CustomerPackageDeskPage } from './pages/operations/customer-package-desk-page';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RouteGuard>
            <AdminShell />
          </RouteGuard>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/operations" element={<OperationsCenterPage />} />
        <Route path="/operations/staff" element={<StaffManagementPage />} />
        <Route path="/operations/printers" element={<PrinterManagementPage />} />
        <Route path="/operations/network" element={<NetworkAccessSettingsPage />} />
        <Route path="/operations/customers" element={<CustomerPackageDeskPage />} />
        <Route path="/branches" element={<BranchesPage />} />
        <Route path="/branches/:id" element={<BranchDetailPage />} />
        <Route path="/catalog/*" element={<CatalogRoutes />} />
        <Route
          path="/orders"
          element={<PagePlaceholder title="Orders" description="Order search, detail, and operational controls." />}
        />
        <Route
          path="/stations"
          element={<PagePlaceholder title="Stations" description="Station routing and production settings." />}
        />
        <Route path="/finance/*" element={<FinanceRoutes />} />
        <Route path="/inventory/*" element={<InventoryRoutes />} />
        <Route path="/reports/*" element={<ReportsRoutes />} />
        <Route path="/integrations/*" element={<IntegrationsRoutes />} />
        <Route
          path="/settings"
          element={<PagePlaceholder title="Settings" description="Business and branch-level configuration." />}
        />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
