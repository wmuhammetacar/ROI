import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../app/auth-context';
import { BranchScopeBanner } from '../../components';
import { InventoryIngredientsPage } from './ingredients-page';
import { InventoryMovementsPage } from './movements-page';
import { InventoryRecipesPage } from './recipes-page';
import { InventorySummaryPage } from './summary-page';
import { InventoryUnitsPage } from './units-page';

const inventoryRoutes = [
  { path: '/inventory/summary', label: 'Summary' },
  { path: '/inventory/units', label: 'Units' },
  { path: '/inventory/ingredients', label: 'Ingredients' },
  { path: '/inventory/recipes', label: 'Recipes' },
  { path: '/inventory/movements', label: 'Movements' },
];

function InventoryAccessGuard() {
  const { user } = useAuth();

  if (!user?.roles.includes('admin')) {
    return (
      <section className="page-card">
        <h1>Inventory Access Restricted</h1>
        <p className="muted">Only admin users can manage inventory and recipe configuration.</p>
      </section>
    );
  }

  return <Outlet />;
}

function InventoryTabs() {
  return (
    <div className="inventory-tabs" role="tablist" aria-label="Inventory sections">
      {inventoryRoutes.map((item) => (
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

export function InventoryRoutes() {
  return (
    <Routes>
      <Route element={<InventoryAccessGuard />}>
        <Route
          path="/"
          element={
            <div className="inventory-page-grid">
              <BranchScopeBanner sectionLabel="Inventory" />
              <InventoryTabs />
              <Outlet />
            </div>
          }
        >
          <Route index element={<Navigate to="/inventory/summary" replace />} />
          <Route path="summary" element={<InventorySummaryPage />} />
          <Route path="units" element={<InventoryUnitsPage />} />
          <Route path="ingredients" element={<InventoryIngredientsPage />} />
          <Route path="recipes" element={<InventoryRecipesPage />} />
          <Route path="movements" element={<InventoryMovementsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
