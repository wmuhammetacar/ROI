import { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '@roi/shared-utils';
import { catalogPricingApi, catalogProductsApi } from '../../api';
import type { BranchPriceOverride, Product, ProductVariant } from '../../api/catalog-types';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, Modal, PageHeader, SectionCard } from '../../components';

const emptyOverrideForm = {
  variantId: '',
  price: 0,
};

export function PricingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [overrides, setOverrides] = useState<BranchPriceOverride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOverride, setEditingOverride] = useState<BranchPriceOverride | null>(null);
  const [formState, setFormState] = useState(emptyOverrideForm);

  const loadProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await catalogProductsApi.list();
      setProducts(data);
      if (!selectedProductId && data.length > 0) {
        setSelectedProductId(data[0].id);
      }
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const loadOverrides = async (productId: string) => {
    setError(null);
    try {
      const [detail, pricing] = await Promise.all([
        catalogProductsApi.getById(productId),
        catalogPricingApi.listByProduct(productId),
      ]);
      setSelectedProduct(detail);
      setOverrides(pricing);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  useEffect(() => {
    void loadProducts();
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      void loadOverrides(selectedProductId);
    }
  }, [selectedProductId]);

  const variants = useMemo<ProductVariant[]>(() => selectedProduct?.variants ?? [], [selectedProduct]);

  const openCreate = () => {
    setEditingOverride(null);
    setFormState({ ...emptyOverrideForm });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (override: BranchPriceOverride) => {
    setEditingOverride(override);
    setFormState({
      variantId: override.variantId ?? '',
      price: Number(override.price),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const submitOverride = async () => {
    if (!selectedProductId) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        variantId: formState.variantId || undefined,
        price: Number(formState.price),
      };

      if (editingOverride) {
        await catalogPricingApi.update(selectedProductId, editingOverride.id, payload);
      } else {
        await catalogPricingApi.create(selectedProductId, payload);
      }

      await loadOverrides(selectedProductId);
      setModalOpen(false);
    } catch (err) {
      setFormError(toErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteOverride = async (override: BranchPriceOverride) => {
    if (!selectedProductId) return;
    const confirmed = window.confirm('Delete this price override?');
    if (!confirmed) return;

    try {
      await catalogPricingApi.remove(selectedProductId, override.id);
      await loadOverrides(selectedProductId);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  return (
    <div className="catalog-content">
      <PageHeader
        title="Pricing Overrides"
        description="Override base or variant pricing for specific branches."
        actions={
          <button type="button" onClick={openCreate} disabled={!selectedProductId}>
            New Override
          </button>
        }
      />

      <SectionCard>
        <div className="table-toolbar">
          <label className="inline-field">
            Product
            <select
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
            >
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <DataState
          isLoading={isLoading}
          error={error}
          empty={!isLoading && overrides.length === 0 && Boolean(selectedProductId)}
          emptyMessage="No pricing overrides for this product yet."
        />
        {!isLoading && overrides.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Price</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {overrides.map((override) => (
                  <tr key={override.id}>
                    <td>
                      {override.variantId
                        ? `Variant: ${override.variant?.name ?? override.variantId}`
                        : 'Product Base'}
                    </td>
                    <td>{formatCurrency(override.price)}</td>
                    <td className="table-actions">
                      <button type="button" className="secondary" onClick={() => openEdit(override)}>
                        Edit
                      </button>
                      <button type="button" className="danger" onClick={() => deleteOverride(override)}>
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

      {modalOpen ? (
        <Modal title={editingOverride ? 'Edit Override' : 'New Override'} onClose={() => setModalOpen(false)}>
          <div className="form-grid">
            <label>
              Variant (optional)
              <select
                value={formState.variantId}
                onChange={(event) => setFormState((prev) => ({ ...prev, variantId: event.target.value }))}
              >
                <option value="">Product Base Price</option>
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Price
              <input
                type="number"
                value={formState.price}
                onChange={(event) => setFormState((prev) => ({ ...prev, price: Number(event.target.value) }))}
                min={0}
              />
            </label>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button type="button" onClick={submitOverride} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Override'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
