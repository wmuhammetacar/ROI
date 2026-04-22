import { useEffect, useMemo, useState } from 'react';
import { catalogCategoriesApi } from '../../api/catalog-categories.api';
import { catalogProductsApi } from '../../api/catalog-products.api';
import type { Category } from '../../api/catalog-types';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, Modal, PageHeader, SectionCard, StatusBadge } from '../../components';

const emptyCategoryForm = {
  name: '',
  description: '',
  sortOrder: 0,
  isActive: true,
};

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formState, setFormState] = useState(emptyCategoryForm);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  const loadCategories = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [categoryData, productData] = await Promise.all([
        catalogCategoriesApi.list(),
        catalogProductsApi.list(),
      ]);
      setCategories(categoryData);
      const counts = productData.reduce<Record<string, number>>((acc, product) => {
        acc[product.categoryId] = (acc[product.categoryId] ?? 0) + 1;
        return acc;
      }, {});
      setProductCounts(counts);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  const openCreate = () => {
    setEditingCategory(null);
    setFormState({ ...emptyCategoryForm });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditingCategory(category);
    setFormState({
      name: category.name,
      description: category.description ?? '',
      sortOrder: category.sortOrder,
      isActive: category.isActive,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (!isSubmitting) {
      setIsModalOpen(false);
    }
  };

  const submitCategory = async () => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim() || undefined,
        sortOrder: Number(formState.sortOrder),
        isActive: formState.isActive,
      };

      if (editingCategory) {
        const updated = await catalogCategoriesApi.update(editingCategory.id, payload);
        setCategories((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await catalogCategoriesApi.create(payload);
        setCategories((prev) => [...prev, created]);
      }

      setIsModalOpen(false);
    } catch (err) {
      setFormError(toErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (category: Category) => {
    const confirmed = window.confirm(`Delete category "${category.name}"?`);
    if (!confirmed) return;

    try {
      await catalogCategoriesApi.remove(category.id);
      setCategories((prev) => prev.filter((item) => item.id !== category.id));
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  return (
    <div className="catalog-content">
      <PageHeader
        title="Categories"
        description="Organize products into structured menu groups."
        actions={
          <button type="button" onClick={openCreate}>
            New Category
          </button>
        }
      />

      <SectionCard>
        <DataState
          isLoading={isLoading}
          error={error}
          empty={!isLoading && categories.length === 0}
          emptyMessage="No categories yet. Create the first one to start building your menu."
        />
        {!isLoading && categories.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Product Count</th>
                  <th>Sort</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedCategories.map((category) => (
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td className="muted">{category.description ?? '—'}</td>
                    <td>{productCounts[category.id] ?? 0}</td>
                    <td>{category.sortOrder}</td>
                    <td>
                      <StatusBadge active={category.isActive} />
                    </td>
                    <td className="table-actions">
                      <button type="button" className="secondary" onClick={() => openEdit(category)}>
                        Edit
                      </button>
                      <button type="button" className="danger" onClick={() => handleDelete(category)}>
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
        <Modal title={editingCategory ? 'Edit Category' : 'New Category'} onClose={closeModal}>
          <div className="form-grid">
            <label>
              Name
              <input
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Breakfast"
              />
            </label>
            <label>
              Description
              <textarea
                value={formState.description}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Optional notes"
              />
            </label>
            <div className="form-row">
              <label>
                Sort Order
                <input
                  type="number"
                  value={formState.sortOrder}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, sortOrder: Number(event.target.value) }))
                  }
                  min={0}
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={formState.isActive}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, isActive: event.target.checked }))
                  }
                />
                Active
              </label>
            </div>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button type="button" className="secondary" onClick={closeModal} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="button" onClick={submitCategory} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Category'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
