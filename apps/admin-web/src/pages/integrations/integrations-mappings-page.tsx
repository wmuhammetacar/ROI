import { useEffect, useMemo, useState } from 'react';
import {
  catalogProductsApi,
  integrationsMappingsApi,
  integrationsProvidersApi,
  type IntegrationProvider,
  type MenuMapping,
  type Product,
  type ProductVariant,
} from '../../api';
import { useBranchContext } from '../../app/branch-context';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, Modal, PageHeader, SectionCard, StatusBadge } from '../../components';

const emptyFormState = {
  branchId: '',
  providerId: '',
  externalItemId: '',
  externalItemName: '',
  productId: '',
  variantId: '',
  isActive: true,
};

export function IntegrationsMappingsPage() {
  const { branches, effectiveBranchId } = useBranchContext();
  const [mappings, setMappings] = useState<MenuMapping[]>([]);
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<MenuMapping | null>(null);
  const [formState, setFormState] = useState(emptyFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const providerMap = useMemo(() => new Map(providers.map((provider) => [provider.id, provider])), [providers]);
  const branchMap = useMemo(() => new Map(branches.map((branch) => [branch.id, branch])), [branches]);

  const loadVariants = async (productId: string, branchId?: string) => {
    if (!productId) {
      setVariants([]);
      return;
    }

    try {
      const data = await catalogProductsApi.listVariants(productId, branchId);
      setVariants(data);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [providerData, productData, mappingData] = await Promise.all([
        integrationsProvidersApi.list(),
        catalogProductsApi.list(effectiveBranchId ?? undefined),
        integrationsMappingsApi.list(
          {
            providerId: selectedProviderId === 'all' ? undefined : selectedProviderId,
            isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
            limit: 200,
          },
          effectiveBranchId ?? undefined,
        ),
      ]);

      setProviders(providerData);
      setProducts(productData);
      setMappings(mappingData);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [effectiveBranchId, selectedProviderId, activeFilter]);

  const openCreate = () => {
    setEditingMapping(null);
    setFormError(null);
    const defaultBranchId = effectiveBranchId ?? branches[0]?.id ?? '';
    const defaultProductId = products[0]?.id ?? '';
    setFormState({
      ...emptyFormState,
      branchId: defaultBranchId,
      providerId: providers[0]?.id ?? '',
      productId: defaultProductId,
    });
    void loadVariants(defaultProductId, defaultBranchId || undefined);
    setIsModalOpen(true);
  };

  const openEdit = (mapping: MenuMapping) => {
    setEditingMapping(mapping);
    setFormError(null);
    setFormState({
      branchId: mapping.branchId,
      providerId: mapping.providerId,
      externalItemId: mapping.externalItemId,
      externalItemName: mapping.externalItemName,
      productId: mapping.productId,
      variantId: mapping.variantId ?? '',
      isActive: mapping.isActive,
    });
    void loadVariants(mapping.productId, mapping.branchId);
    setIsModalOpen(true);
  };

  const submitMapping = async () => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingMapping) {
        await integrationsMappingsApi.update(editingMapping.id, {
          externalItemName: formState.externalItemName.trim(),
          productId: formState.productId,
          variantId: formState.variantId || null,
          isActive: formState.isActive,
        });
      } else {
        await integrationsMappingsApi.create({
          branchId: formState.branchId,
          providerId: formState.providerId,
          externalItemId: formState.externalItemId.trim(),
          externalItemName: formState.externalItemName.trim(),
          productId: formState.productId,
          variantId: formState.variantId || undefined,
          isActive: formState.isActive,
        });
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      setFormError(toErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteMapping = async (mapping: MenuMapping) => {
    const confirmed = window.confirm(`Delete mapping for external item "${mapping.externalItemId}"?`);
    if (!confirmed) return;

    try {
      await integrationsMappingsApi.remove(mapping.id);
      await loadData();
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  return (
    <div className="catalog-content">
      <PageHeader
        title="Menu Mappings"
        description="Map external marketplace item IDs to internal catalog products and variants."
        actions={
          <>
            <button type="button" className="secondary" onClick={loadData}>
              Refresh
            </button>
            <button type="button" onClick={openCreate}>
              New Mapping
            </button>
          </>
        }
      />

      <SectionCard>
        <div className="table-toolbar">
          <label className="inline-field">
            Provider
            <select value={selectedProviderId} onChange={(event) => setSelectedProviderId(event.target.value)}>
              <option value="all">All</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            Status
            <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        <DataState
          isLoading={isLoading}
          error={error}
          empty={!isLoading && mappings.length === 0}
          emptyMessage="No menu mappings found for the selected scope."
        />

        {!isLoading && mappings.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Branch</th>
                  <th>External Item</th>
                  <th>Mapped Product</th>
                  <th>Variant</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping) => (
                  <tr key={mapping.id}>
                    <td>{mapping.provider?.name ?? providerMap.get(mapping.providerId)?.name ?? mapping.providerId}</td>
                    <td>{branchMap.get(mapping.branchId)?.name ?? mapping.branchId}</td>
                    <td>
                      <div className="title-stack">
                        <strong>{mapping.externalItemName}</strong>
                        <span className="muted">{mapping.externalItemId}</span>
                      </div>
                    </td>
                    <td>{mapping.product?.name ?? mapping.productId}</td>
                    <td>{mapping.variant?.name ?? mapping.variantId ?? '—'}</td>
                    <td>
                      <StatusBadge active={mapping.isActive} />
                    </td>
                    <td className="table-actions">
                      <button type="button" className="secondary" onClick={() => openEdit(mapping)}>
                        Edit
                      </button>
                      <button type="button" className="danger" onClick={() => void deleteMapping(mapping)}>
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

      {isModalOpen ? (
        <Modal
          title={editingMapping ? 'Edit Menu Mapping' : 'New Menu Mapping'}
          onClose={() => (!isSubmitting ? setIsModalOpen(false) : null)}
        >
          <div className="form-grid">
            <label>
              Branch
              <select
                value={formState.branchId}
                disabled={Boolean(editingMapping)}
                onChange={(event) => setFormState((prev) => ({ ...prev, branchId: event.target.value }))}
              >
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Provider
              <select
                value={formState.providerId}
                disabled={Boolean(editingMapping)}
                onChange={(event) => setFormState((prev) => ({ ...prev, providerId: event.target.value }))}
              >
                <option value="">Select provider</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              External Item ID
              <input
                value={formState.externalItemId}
                disabled={Boolean(editingMapping)}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, externalItemId: event.target.value }))
                }
                placeholder="ext-12345"
              />
            </label>
            <label>
              External Item Name
              <input
                value={formState.externalItemName}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, externalItemName: event.target.value }))
                }
                placeholder="External menu label"
              />
            </label>
            <label>
              Product
              <select
                value={formState.productId}
                onChange={(event) => {
                  const productId = event.target.value;
                  setFormState((prev) => ({ ...prev, productId, variantId: '' }));
                  void loadVariants(productId, formState.branchId || undefined);
                }}
              >
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Variant (optional)
              <select
                value={formState.variantId}
                onChange={(event) => setFormState((prev) => ({ ...prev, variantId: event.target.value }))}
              >
                <option value="">No variant</option>
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={formState.isActive}
                onChange={(event) => setFormState((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
              Active Mapping
            </label>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button type="button" onClick={submitMapping} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Mapping'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
