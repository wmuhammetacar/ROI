import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@roi/shared-utils';
import { publicCatalogApi, type PosCatalogProduct, type PublicMenuResponse } from '../api';
import { useCartContext } from '../app/cart-context';
import { toErrorMessage } from '../app/error-utils';
import { usePublicContext } from '../app/public-context';
import { DataState, ProductCard, ProductConfiguratorModal, PublicErrorState } from '../components';

export function MenuPage() {
  const { branchId, tableId, appendContext, hasValidBranchContext } = usePublicContext();
  const { itemCount, subtotal, addItem, setContext } = useCartContext();
  const [menuData, setMenuData] = useState<PublicMenuResponse | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<PosCatalogProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContext(`${branchId}:${tableId || ''}`);
  }, [branchId, tableId, setContext]);

  useEffect(() => {
    if (!hasValidBranchContext) {
      setMenuData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const loadMenu = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await publicCatalogApi.getMenu(branchId, tableId || undefined);
        setMenuData(data);
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    };

    void loadMenu();
  }, [branchId, hasValidBranchContext, tableId]);

  const categories = menuData?.menu.categories ?? [];
  const availableProductCount = useMemo(
    () => categories.reduce((acc, category) => acc + category.products.length, 0),
    [categories],
  );

  if (!hasValidBranchContext) {
    return (
      <PublicErrorState
        title="Branch context missing"
        message='Open menu with a valid QR link such as "/menu?branchId=<branchId>" to load products.'
      />
    );
  }

  const addConfiguredItem = (input: {
    variantId?: string | null;
    variantName?: string | null;
    quantity: number;
    notes?: string;
    modifierSelections: Array<{
      modifierGroupId: string;
      modifierGroupName: string;
      optionIds: string[];
      optionNames: string[];
      totalPriceDelta: number;
    }>;
    unitPrice: number;
    lineTotal: number;
  }) => {
    if (!selectedProduct) return;
    addItem({
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      variantId: input.variantId,
      variantName: input.variantName,
      quantity: input.quantity,
      notes: input.notes,
      basePrice: Number(selectedProduct.basePrice),
      unitPrice: input.unitPrice,
      lineTotal: input.lineTotal,
      modifierSelections: input.modifierSelections,
    });
    setSelectedProduct(null);
  };

  return (
    <div className="public-shell">
      <header className="public-header">
        <h1>ROI Menu</h1>
        <p className="muted">
          Branch {branchId}
          {menuData?.context.tableName ? ` | Table ${menuData.context.tableName}` : ''}
        </p>
      </header>

      <DataState
        isLoading={isLoading}
        error={error}
        empty={!isLoading && !error && availableProductCount === 0}
        emptyMessage="Menu is currently empty for this branch."
      />

      {!isLoading && !error && categories.length > 0 ? (
        <>
          <nav className="category-nav">
            {categories.map((category) => (
              <a key={category.id} href={`#cat-${category.id}`} className="category-chip">
                {category.name}
              </a>
            ))}
          </nav>

          <main className="menu-stack">
            {categories.map((category) => (
              <section key={category.id} id={`cat-${category.id}`} className="category-section">
                <header className="category-header">
                  <h2>{category.name}</h2>
                  <span>{category.products.length} item</span>
                </header>
                <div className="product-grid">
                  {category.products.map((product) => (
                    <ProductCard key={product.id} product={product} onSelect={() => setSelectedProduct(product)} />
                  ))}
                </div>
              </section>
            ))}
          </main>
        </>
      ) : null}

      <Link to={appendContext('/cart')} className="cart-fab">
        Cart ({itemCount}) · {formatCurrency(subtotal)}
      </Link>

      {selectedProduct ? (
        <ProductConfiguratorModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAdd={addConfiguredItem}
        />
      ) : null}
    </div>
  );
}
