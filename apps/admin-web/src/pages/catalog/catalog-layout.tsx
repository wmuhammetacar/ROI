import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../app/auth-context';
import { BranchScopeBanner } from '../../components';
import { CategoriesPage } from './categories-page';
import { ModifiersPage } from './modifiers-page';
import { PosPreviewPage } from './pos-preview-page';
import { PricingPage } from './pricing-page';
import { ProductsPage } from './products-page';

const catalogRoutes = [
  { path: '/catalog/categories', label: 'Categories' },
  { path: '/catalog/products', label: 'Products' },
  { path: '/catalog/modifiers', label: 'Modifiers' },
  { path: '/catalog/pricing', label: 'Pricing' },
  { path: '/catalog/pos-preview', label: 'POS Preview' },
];

function CatalogAccessGuard() {
  const { user } = useAuth();

  if (!user?.roles.includes('admin')) {
    return (
      <section className="page-card">
        <h1>Catalog Access Restricted</h1>
        <p className="muted">Only admin users can manage catalog configuration pages.</p>
      </section>
    );
  }

  return <Outlet />;
}

function CatalogTabs() {
  return (
    <div className="catalog-tabs" role="tablist" aria-label="Catalog sections">
      {catalogRoutes.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) => `catalog-tab ${isActive ? 'active' : ''}`}
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}

export function CatalogRoutes() {
  return (
    <Routes>
      <Route element={<CatalogAccessGuard />}>
        <Route
          path="/"
          element={
            <div className="catalog-page-grid">
              <BranchScopeBanner sectionLabel="Catalog" />
              <CatalogTabs />
              <Outlet />
            </div>
          }
        >
          <Route index element={<Navigate to="/catalog/categories" replace />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="modifiers" element={<ModifiersPage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="pos-preview" element={<PosPreviewPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
