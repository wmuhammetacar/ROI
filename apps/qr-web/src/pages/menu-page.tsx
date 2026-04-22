import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@roi/shared-utils';
import { publicCatalogApi, type PosCatalogProduct, type PublicMenuResponse } from '../api';
import { useCartContext } from '../app/cart-context';
import { toErrorMessage } from '../app/error-utils';
import { usePublicContext } from '../app/public-context';
import {
  DataState,
  ProductCard,
  ProductConfiguratorModal,
  PublicErrorState,
  WaiterCallModal,
} from '../components';

export function MenuPage() {
  const { branchId, tableId, appendContext, hasValidBranchContext } = usePublicContext();
  const { itemCount, subtotal, addItem, setContext } = useCartContext();
  const [menuData, setMenuData] = useState<PublicMenuResponse | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<PosCatalogProduct | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isWaiterCallOpen, setIsWaiterCallOpen] = useState(false);
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
        const firstCategoryId = data.menu.categories[0]?.id ?? null;
        setSelectedCategoryId((current) => current ?? firstCategoryId);
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

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? categories[0] ?? null,
    [categories, selectedCategoryId],
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
    <div className="public-shell premium-shell">
      <header className="premium-hero">
        <div>
          <p className="hero-kicker">ROI · CROISSANT · DESSERT · COFFEE</p>
          <h1>{menuData?.context.branchName ?? `Branch ${branchId}`}</h1>
          <p className="muted">
            {menuData?.context.tableName ? `Table ${menuData.context.tableName}` : 'Takeaway Menu'}
            {menuData?.context.suggestedServiceType ? ` · ${menuData.context.suggestedServiceType.replace('_', ' ')}` : ''}
          </p>
        </div>
        <div className="hero-stats">
          <span>{categories.length} categories</span>
          <span>{availableProductCount} products</span>
        </div>
      </header>

      <DataState
        isLoading={isLoading}
        error={error}
        empty={!isLoading && !error && availableProductCount === 0}
        emptyMessage="Menu is currently empty for this branch."
      />

      {!isLoading && !error && categories.length > 0 ? (
        <>
          <nav className="category-nav premium-category-nav">
            {categories.map((category) => {
              const active = category.id === selectedCategory?.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`category-chip ${active ? 'active' : ''}`}
                  onClick={() => setSelectedCategoryId(category.id)}
                >
                  {category.name}
                </button>
              );
            })}
          </nav>

          <main className="menu-stack">
            {selectedCategory ? (
              <section className="category-section premium-category-section">
                <header className="category-header">
                  <h2>{selectedCategory.name}</h2>
                  <span>{selectedCategory.products.length} items</span>
                </header>
                <div className="product-grid">
                  {selectedCategory.products.map((product) => (
                    <ProductCard key={product.id} product={product} onSelect={() => setSelectedProduct(product)} />
                  ))}
                </div>
              </section>
            ) : null}
          </main>
        </>
      ) : null}

      <div className="public-action-bar">
        {tableId ? (
          <button type="button" className="ghost" onClick={() => setIsWaiterCallOpen(true)}>
            Call Waiter
          </button>
        ) : null}
        <Link to={appendContext('/cart')} className="cart-fab">
          Cart ({itemCount}) · {formatCurrency(subtotal)}
        </Link>
      </div>

      {selectedProduct ? (
        <ProductConfiguratorModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAdd={addConfiguredItem}
        />
      ) : null}

      {isWaiterCallOpen && tableId ? (
        <WaiterCallModal
          branchId={branchId}
          tableId={tableId}
          tableName={menuData?.context.tableName}
          onClose={() => setIsWaiterCallOpen(false)}
        />
      ) : null}
    </div>
  );
}
