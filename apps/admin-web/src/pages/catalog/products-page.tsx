import { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '@roi/shared-utils';
import {
  catalogCategoriesApi,
  catalogModifiersApi,
  catalogProductsApi,
  stationsApi,
} from '../../api';
import type {
  Category,
  ModifierGroup,
  Product,
  ProductModifierGroupLink,
  ProductType,
  ProductVariant,
} from '../../api/catalog-types';
import type { StationSummary } from '../../api/stations.api';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, Modal, PageHeader, SectionCard, StatusBadge } from '../../components';

const emptyProductForm = {
  categoryId: '',
  name: '',
  description: '',
  allergenTags: '',
  sku: '',
  imageUrl: '',
  basePrice: 0,
  sortOrder: 0,
  isActive: true,
  isAvailable: true,
  productType: 'SIMPLE' as ProductType,
};

const emptyVariantForm = {
  name: '',
  sku: '',
  priceDelta: 0,
  sortOrder: 0,
  isActive: true,
};

const emptyLinkForm = {
  modifierGroupId: '',
  isRequired: false,
  sortOrder: 0,
};

type ProductStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'AVAILABLE' | 'UNAVAILABLE';

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [stations, setStations] = useState<StationSummary[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilterId, setCategoryFilterId] = useState<'ALL' | string>('ALL');
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [productError, setProductError] = useState<string | null>(null);
  const [productSubmitting, setProductSubmitting] = useState(false);

  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [variantForm, setVariantForm] = useState(emptyVariantForm);
  const [variantError, setVariantError] = useState<string | null>(null);
  const [variantSubmitting, setVariantSubmitting] = useState(false);

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ProductModifierGroupLink | null>(null);
  const [linkForm, setLinkForm] = useState(emptyLinkForm);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [routeStationId, setRouteStationId] = useState('');
  const [routePending, setRoutePending] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [categoryData, productData, modifierData, stationData] = await Promise.all([
        catalogCategoriesApi.list(),
        catalogProductsApi.list(),
        catalogModifiersApi.listGroups(),
        stationsApi.list(),
      ]);
      setCategories(categoryData);
      setProducts(productData);
      setModifierGroups(modifierData);
      setStations(stationData.filter((station) => station.isActive));
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const loadProductDetail = async (productId: string) => {
    try {
      const detail = await catalogProductsApi.getById(productId);
      setSelectedProduct(detail);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      void loadProductDetail(selectedProductId);
    } else {
      setSelectedProduct(null);
    }
  }, [selectedProductId]);

  useEffect(() => {
    setRouteError(null);
    setRouteStationId(selectedProduct?.stationRoute?.stationId ?? '');
  }, [selectedProduct]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return products
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((product) => {
        if (categoryFilterId !== 'ALL' && product.categoryId !== categoryFilterId) return false;
        if (statusFilter === 'ACTIVE' && !product.isActive) return false;
        if (statusFilter === 'INACTIVE' && product.isActive) return false;
        if (statusFilter === 'AVAILABLE' && !product.isAvailable) return false;
        if (statusFilter === 'UNAVAILABLE' && product.isAvailable) return false;
        if (!term) return true;
        return (
          product.name.toLowerCase().includes(term) ||
          (product.sku ?? '').toLowerCase().includes(term) ||
          (product.category?.name ?? '').toLowerCase().includes(term)
        );
      });
  }, [products, searchTerm, categoryFilterId, statusFilter]);

  const openCreate = () => {
    setEditingProduct(null);
    setProductForm({ ...emptyProductForm, categoryId: categories[0]?.id ?? '' });
    setProductError(null);
    setProductModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      categoryId: product.categoryId,
      name: product.name,
      description: product.description ?? '',
      allergenTags: (product.allergenTags ?? []).join(', '),
      sku: product.sku ?? '',
      imageUrl: product.imageUrl ?? '',
      basePrice: Number(product.basePrice),
      sortOrder: product.sortOrder,
      isActive: product.isActive,
      isAvailable: product.isAvailable,
      productType: product.productType,
    });
    setProductError(null);
    setProductModalOpen(true);
  };

  const submitProduct = async () => {
    setProductSubmitting(true);
    setProductError(null);

    try {
      const allergenTags = productForm.allergenTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const payload = {
        categoryId: productForm.categoryId,
        name: productForm.name.trim(),
        description: productForm.description.trim() || undefined,
        allergenTags,
        sku: productForm.sku.trim() || undefined,
        imageUrl: productForm.imageUrl.trim() || undefined,
        basePrice: Number(productForm.basePrice),
        sortOrder: Number(productForm.sortOrder),
        isActive: productForm.isActive,
        isAvailable: productForm.isAvailable,
        productType: productForm.productType,
      };

      if (editingProduct) {
        const updated = await catalogProductsApi.update(editingProduct.id, payload);
        setProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        if (selectedProductId === updated.id) {
          setSelectedProduct(updated);
        }
      } else {
        const created = await catalogProductsApi.create(payload);
        setProducts((prev) => [...prev, created]);
      }

      setProductModalOpen(false);
    } catch (err) {
      setProductError(toErrorMessage(err));
    } finally {
      setProductSubmitting(false);
    }
  };

  const handleDelete = async (product: Product) => {
    const confirmed = window.confirm(`Delete product "${product.name}"?`);
    if (!confirmed) return;

    try {
      await catalogProductsApi.remove(product.id);
      setProducts((prev) => prev.filter((item) => item.id !== product.id));
      if (selectedProductId === product.id) {
        setSelectedProductId(null);
      }
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const toggleActive = async (product: Product, nextActive: boolean) => {
    try {
      const updated = await catalogProductsApi.updateActiveState(product.id, { isActive: nextActive });
      setProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      if (selectedProductId === updated.id) {
        setSelectedProduct(updated);
      }
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const toggleAvailability = async (product: Product, nextAvailable: boolean) => {
    try {
      const updated = await catalogProductsApi.updateAvailability(product.id, {
        isAvailable: nextAvailable,
      });
      setProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      if (selectedProductId === updated.id) {
        setSelectedProduct(updated);
      }
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const openVariantCreate = () => {
    setEditingVariant(null);
    setVariantForm({ ...emptyVariantForm });
    setVariantError(null);
    setVariantModalOpen(true);
  };

  const openVariantEdit = (variant: ProductVariant) => {
    setEditingVariant(variant);
    setVariantForm({
      name: variant.name,
      sku: variant.sku ?? '',
      priceDelta: Number(variant.priceDelta),
      sortOrder: variant.sortOrder,
      isActive: variant.isActive,
    });
    setVariantError(null);
    setVariantModalOpen(true);
  };

  const submitVariant = async () => {
    if (!selectedProduct) return;
    setVariantSubmitting(true);
    setVariantError(null);

    try {
      const payload = {
        name: variantForm.name.trim(),
        sku: variantForm.sku.trim() || undefined,
        priceDelta: Number(variantForm.priceDelta),
        sortOrder: Number(variantForm.sortOrder),
        isActive: variantForm.isActive,
      };

      if (editingVariant) {
        await catalogProductsApi.updateVariant(selectedProduct.id, editingVariant.id, payload);
      } else {
        await catalogProductsApi.createVariant(selectedProduct.id, payload);
      }

      await loadProductDetail(selectedProduct.id);
      setVariantModalOpen(false);
    } catch (err) {
      setVariantError(toErrorMessage(err));
    } finally {
      setVariantSubmitting(false);
    }
  };

  const deleteVariant = async (variant: ProductVariant) => {
    if (!selectedProduct) return;
    const confirmed = window.confirm(`Delete variant "${variant.name}"?`);
    if (!confirmed) return;

    try {
      await catalogProductsApi.removeVariant(selectedProduct.id, variant.id);
      await loadProductDetail(selectedProduct.id);
    } catch (err) {
      setVariantError(toErrorMessage(err));
    }
  };

  const openLinkCreate = () => {
    setEditingLink(null);
    setLinkForm({ ...emptyLinkForm, modifierGroupId: availableModifierGroups[0]?.id ?? '' });
    setLinkError(null);
    setLinkModalOpen(true);
  };

  const openLinkEdit = (link: ProductModifierGroupLink) => {
    setEditingLink(link);
    setLinkForm({
      modifierGroupId: link.modifierGroupId,
      isRequired: link.isRequired,
      sortOrder: link.sortOrder,
    });
    setLinkError(null);
    setLinkModalOpen(true);
  };

  const submitLink = async () => {
    if (!selectedProduct) return;
    setLinkSubmitting(true);
    setLinkError(null);

    try {
      const payload = {
        modifierGroupId: linkForm.modifierGroupId,
        isRequired: linkForm.isRequired,
        sortOrder: Number(linkForm.sortOrder),
      };

      if (editingLink) {
        await catalogProductsApi.updateModifierLink(selectedProduct.id, editingLink.id, payload);
      } else {
        await catalogProductsApi.createModifierLink(selectedProduct.id, payload);
      }

      await loadProductDetail(selectedProduct.id);
      setLinkModalOpen(false);
    } catch (err) {
      setLinkError(toErrorMessage(err));
    } finally {
      setLinkSubmitting(false);
    }
  };

  const deleteLink = async (link: ProductModifierGroupLink) => {
    if (!selectedProduct) return;
    const confirmed = window.confirm(`Unlink modifier group "${link.modifierGroup?.name ?? ''}"?`);
    if (!confirmed) return;

    try {
      await catalogProductsApi.removeModifierLink(selectedProduct.id, link.id);
      await loadProductDetail(selectedProduct.id);
    } catch (err) {
      setLinkError(toErrorMessage(err));
    }
  };

  const saveRoute = async () => {
    if (!selectedProduct) return;
    setRoutePending(true);
    setRouteError(null);
    try {
      if (!routeStationId) {
        if (selectedProduct.stationRoute) {
          await catalogProductsApi.removeStationRoute(selectedProduct.id);
        }
      } else if (selectedProduct.stationRoute) {
        await catalogProductsApi.updateStationRoute(selectedProduct.id, { stationId: routeStationId });
      } else {
        await catalogProductsApi.createStationRoute(selectedProduct.id, { stationId: routeStationId });
      }
      await loadProductDetail(selectedProduct.id);
      const refreshedProducts = await catalogProductsApi.list();
      setProducts(refreshedProducts);
    } catch (err) {
      setRouteError(toErrorMessage(err));
    } finally {
      setRoutePending(false);
    }
  };

  const availableModifierGroups = useMemo(() => {
    const linkedIds = new Set(selectedProduct?.modifierGroupLinks?.map((link) => link.modifierGroupId));
    return modifierGroups.filter((group) => !linkedIds.has(group.id));
  }, [modifierGroups, selectedProduct]);

  const variableNeedsVariants =
    selectedProduct?.productType === 'VARIABLE' && (selectedProduct.variants?.length ?? 0) === 0;

  return (
    <div className="catalog-content">
      <PageHeader
        title="Products"
        description="Manage sellable items, variants, and modifier relationships."
        actions={
          <button type="button" onClick={openCreate}>
            New Product
          </button>
        }
      />

      <div className="catalog-split">
        <SectionCard title="Product List" subtitle="Search and select a product to manage details.">
          <div className="table-toolbar">
            <input
              placeholder="Search name, SKU, category"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <select value={categoryFilterId} onChange={(event) => setCategoryFilterId(event.target.value)}>
              <option value="ALL">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ProductStatusFilter)}>
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="AVAILABLE">Available</option>
              <option value="UNAVAILABLE">Unavailable</option>
            </select>
          </div>
          <DataState
            isLoading={isLoading}
            error={error}
            empty={!isLoading && products.length === 0}
            emptyMessage="No products found yet. Create the first product to continue."
          />
          {!isLoading && products.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Base Price</th>
                    <th>Variants</th>
                    <th>Modifiers</th>
                    <th>Allergens</th>
                    <th>Routing</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      className={product.id === selectedProductId ? 'active-row' : ''}
                      onClick={() => setSelectedProductId(product.id)}
                    >
                      <td>
                        <div className="title-stack">
                          <strong>{product.name}</strong>
                          <span className="muted">{product.sku ?? 'No SKU'}</span>
                        </div>
                      </td>
                      <td>{product.category?.name ?? '—'}</td>
                      <td>{formatCurrency(product.basePrice)}</td>
                      <td>{product.variants?.length ?? 0}</td>
                      <td>{product.modifierGroupLinks?.length ?? 0}</td>
                      <td>
                        <div className="badge-row">
                          {(product.allergenTags ?? []).slice(0, 2).map((tag) => (
                            <span key={tag} className="chip">
                              {tag}
                            </span>
                          ))}
                          {(product.allergenTags?.length ?? 0) > 2 ? (
                            <span className="chip">+{(product.allergenTags?.length ?? 0) - 2}</span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <StatusBadge
                          active={Boolean(product.stationRoute?.station)}
                          activeLabel={product.stationRoute?.station?.code ?? 'Route Ready'}
                          inactiveLabel="No Route"
                        />
                      </td>
                      <td>
                        <div className="badge-row">
                          <StatusBadge active={product.isActive} />
                          <StatusBadge
                            active={product.isAvailable}
                            activeLabel="Available"
                            inactiveLabel="Unavailable"
                          />
                        </div>
                      </td>
                      <td className="table-actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(product);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleActive(product, !product.isActive);
                          }}
                        >
                          {product.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleAvailability(product, !product.isAvailable);
                          }}
                        >
                          {product.isAvailable ? 'Mark Unavailable' : 'Mark Available'}
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDelete(product);
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </SectionCard>

        <div className="catalog-detail-stack">
          <SectionCard
            title="Product Details"
            subtitle={selectedProduct ? selectedProduct.name : 'Select a product to manage details.'}
          >
            {!selectedProduct ? (
              <p className="muted">Select a product row to manage variants and modifier links.</p>
            ) : (
              <>
                {variableNeedsVariants ? (
                  <p className="error">Variable products require at least one active variant.</p>
                ) : null}
                <div className="detail-grid">
                  <div>
                    <strong>Category</strong>
                    <p className="muted">{selectedProduct.category?.name ?? '—'}</p>
                  </div>
                  <div>
                    <strong>Product Type</strong>
                    <p className="muted">{selectedProduct.productType}</p>
                  </div>
                  <div>
                    <strong>Base Price</strong>
                    <p className="muted">{formatCurrency(selectedProduct.basePrice)}</p>
                  </div>
                  <div>
                    <strong>Status</strong>
                    <div className="badge-row">
                      <StatusBadge active={selectedProduct.isActive} />
                      <StatusBadge
                        active={selectedProduct.isAvailable}
                        activeLabel="Available"
                        inactiveLabel="Unavailable"
                      />
                    </div>
                  </div>
                  <div>
                    <strong>Allergens</strong>
                    <div className="badge-row">
                      {(selectedProduct.allergenTags ?? []).length === 0 ? (
                        <span className="muted">No allergens</span>
                      ) : (
                        (selectedProduct.allergenTags ?? []).map((tag) => (
                          <span key={tag} className="chip">
                            {tag}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <strong>Station Route</strong>
                    <p className="muted">
                      {selectedProduct.stationRoute?.station
                        ? `${selectedProduct.stationRoute.station.name} (${selectedProduct.stationRoute.station.code})`
                        : 'Route missing'}
                    </p>
                  </div>
                  <div>
                    <strong>Route Readiness</strong>
                    <StatusBadge
                      active={Boolean(selectedProduct.stationRoute?.station)}
                      activeLabel="Ready"
                      inactiveLabel="Needs Route"
                    />
                  </div>
                </div>
              </>
            )}
          </SectionCard>

          <SectionCard title="Station Routing" subtitle="Product -> Station mapping for kitchen/bar routing.">
            {!selectedProduct ? (
              <p className="muted">Select a product to manage routing.</p>
            ) : (
              <div className="form-grid">
                <label>
                  Station
                  <select value={routeStationId} onChange={(event) => setRouteStationId(event.target.value)}>
                    <option value="">No station route</option>
                    {stations.map((station) => (
                      <option key={station.id} value={station.id}>
                        {station.name} ({station.code})
                      </option>
                    ))}
                  </select>
                </label>
                {routeError ? <p className="error">{routeError}</p> : null}
                <div className="form-actions">
                  <button type="button" onClick={saveRoute} disabled={routePending}>
                    {routePending ? 'Saving Route...' : 'Save Route'}
                  </button>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Variants"
            subtitle="Variant choices like size or portion."
            actions={
              <button type="button" onClick={openVariantCreate} disabled={!selectedProduct}>
                Add Variant
              </button>
            }
          >
            {variantError ? <p className="error">{variantError}</p> : null}
            {!selectedProduct ? (
              <p className="muted">Select a product to manage variants.</p>
            ) : selectedProduct.variants && selectedProduct.variants.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Price Delta</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProduct.variants.map((variant) => (
                      <tr key={variant.id}>
                        <td>
                          <div className="title-stack">
                            <strong>{variant.name}</strong>
                            <span className="muted">{variant.sku ?? 'No SKU'}</span>
                          </div>
                        </td>
                        <td>{formatCurrency(variant.priceDelta)}</td>
                        <td>
                          <StatusBadge active={variant.isActive} />
                        </td>
                        <td className="table-actions">
                          <button type="button" className="secondary" onClick={() => openVariantEdit(variant)}>
                            Edit
                          </button>
                          <button type="button" className="danger" onClick={() => deleteVariant(variant)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No variants yet.</p>
            )}
          </SectionCard>

          <SectionCard
            title="Modifier Groups"
            subtitle="Link modifier groups to require or offer option selections."
            actions={
              <button type="button" onClick={openLinkCreate} disabled={!selectedProduct}>
                Link Modifier Group
              </button>
            }
          >
            {linkError ? <p className="error">{linkError}</p> : null}
            {!selectedProduct ? (
              <p className="muted">Select a product to manage modifier links.</p>
            ) : selectedProduct.modifierGroupLinks && selectedProduct.modifierGroupLinks.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Group</th>
                      <th>Required</th>
                      <th>Rule</th>
                      <th>Sort</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProduct.modifierGroupLinks.map((link) => (
                      <tr key={link.id}>
                        <td>{link.modifierGroup?.name ?? '—'}</td>
                        <td>{link.isRequired ? 'Yes' : 'No'}</td>
                        <td>
                          {link.modifierGroup ? (
                            <span className="muted">
                              {link.modifierGroup.selectionType} • min {link.modifierGroup.minSelect} / max {link.modifierGroup.maxSelect}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{link.sortOrder}</td>
                        <td className="table-actions">
                          <button type="button" className="secondary" onClick={() => openLinkEdit(link)}>
                            Edit
                          </button>
                          <button type="button" className="danger" onClick={() => deleteLink(link)}>
                            Unlink
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No modifier groups linked yet.</p>
            )}
          </SectionCard>
        </div>
      </div>

      {productModalOpen ? (
        <Modal title={editingProduct ? 'Edit Product' : 'New Product'} onClose={() => setProductModalOpen(false)}>
          <div className="form-grid">
            <label>
              Category
              <select
                value={productForm.categoryId}
                onChange={(event) =>
                  setProductForm((prev) => ({ ...prev, categoryId: event.target.value }))
                }
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Name
              <input
                value={productForm.name}
                onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Latte"
              />
            </label>
            <label>
              Description
              <textarea
                value={productForm.description}
                onChange={(event) =>
                  setProductForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Optional notes"
              />
            </label>
            <label>
              Allergens (comma separated)
              <input
                value={productForm.allergenTags}
                onChange={(event) =>
                  setProductForm((prev) => ({ ...prev, allergenTags: event.target.value }))
                }
                placeholder="Gluten, Milk, Egg"
              />
            </label>
            <div className="form-row">
              <label>
                SKU
                <input
                  value={productForm.sku}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, sku: event.target.value }))}
                  placeholder="LATTE-001"
                />
              </label>
              <label>
                Image URL
                <input
                  value={productForm.imageUrl}
                  onChange={(event) =>
                    setProductForm((prev) => ({ ...prev, imageUrl: event.target.value }))
                  }
                  placeholder="https://"
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Base Price
                <input
                  type="number"
                  value={productForm.basePrice}
                  onChange={(event) =>
                    setProductForm((prev) => ({ ...prev, basePrice: Number(event.target.value) }))
                  }
                  min={0}
                />
              </label>
              <label>
                Sort Order
                <input
                  type="number"
                  value={productForm.sortOrder}
                  onChange={(event) =>
                    setProductForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) }))
                  }
                  min={0}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Product Type
                <select
                  value={productForm.productType}
                  onChange={(event) =>
                    setProductForm((prev) => ({
                      ...prev,
                      productType: event.target.value as ProductType,
                    }))
                  }
                >
                  <option value="SIMPLE">Simple</option>
                  <option value="VARIABLE">Variable</option>
                </select>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={productForm.isActive}
                  onChange={(event) =>
                    setProductForm((prev) => ({ ...prev, isActive: event.target.checked }))
                  }
                />
                Active
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={productForm.isAvailable}
                  onChange={(event) =>
                    setProductForm((prev) => ({ ...prev, isAvailable: event.target.checked }))
                  }
                />
                Available
              </label>
            </div>
            {productError ? <p className="error">{productError}</p> : null}
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setProductModalOpen(false)}>
                Cancel
              </button>
              <button type="button" onClick={submitProduct} disabled={productSubmitting}>
                {productSubmitting ? 'Saving...' : 'Save Product'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {variantModalOpen ? (
        <Modal title={editingVariant ? 'Edit Variant' : 'New Variant'} onClose={() => setVariantModalOpen(false)}>
          <div className="form-grid">
            <label>
              Name
              <input
                value={variantForm.name}
                onChange={(event) => setVariantForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Small"
              />
            </label>
            <div className="form-row">
              <label>
                SKU
                <input
                  value={variantForm.sku}
                  onChange={(event) => setVariantForm((prev) => ({ ...prev, sku: event.target.value }))}
                  placeholder="LATTE-S"
                />
              </label>
              <label>
                Price Delta
                <input
                  type="number"
                  value={variantForm.priceDelta}
                  onChange={(event) =>
                    setVariantForm((prev) => ({ ...prev, priceDelta: Number(event.target.value) }))
                  }
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Sort Order
                <input
                  type="number"
                  value={variantForm.sortOrder}
                  onChange={(event) =>
                    setVariantForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) }))
                  }
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={variantForm.isActive}
                  onChange={(event) =>
                    setVariantForm((prev) => ({ ...prev, isActive: event.target.checked }))
                  }
                />
                Active
              </label>
            </div>
            {variantError ? <p className="error">{variantError}</p> : null}
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setVariantModalOpen(false)}>
                Cancel
              </button>
              <button type="button" onClick={submitVariant} disabled={variantSubmitting}>
                {variantSubmitting ? 'Saving...' : 'Save Variant'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {linkModalOpen ? (
        <Modal
          title={editingLink ? 'Edit Modifier Link' : 'Link Modifier Group'}
          onClose={() => setLinkModalOpen(false)}
        >
          <div className="form-grid">
            <label>
              Modifier Group
              <select
                value={linkForm.modifierGroupId}
                onChange={(event) =>
                  setLinkForm((prev) => ({ ...prev, modifierGroupId: event.target.value }))
                }
                disabled={Boolean(editingLink)}
              >
                <option value="">Select group</option>
                {(editingLink ? modifierGroups : availableModifierGroups).map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Sort Order
                <input
                  type="number"
                  value={linkForm.sortOrder}
                  onChange={(event) =>
                    setLinkForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) }))
                  }
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={linkForm.isRequired}
                  onChange={(event) =>
                    setLinkForm((prev) => ({ ...prev, isRequired: event.target.checked }))
                  }
                />
                Required
              </label>
            </div>
            {linkError ? <p className="error">{linkError}</p> : null}
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setLinkModalOpen(false)}>
                Cancel
              </button>
              <button type="button" onClick={submitLink} disabled={linkSubmitting}>
                {linkSubmitting ? 'Saving...' : 'Save Link'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
