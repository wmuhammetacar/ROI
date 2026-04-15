import { useEffect, useMemo, useState } from 'react';
import { catalogProductsApi } from '../../api/catalog-products.api';
import { inventoryIngredientsApi, inventoryRecipesApi } from '../../api';
import type { Product, ProductVariant } from '../../api/catalog-types';
import type { Ingredient, Recipe, RecipeItem } from '../../api/inventory-types';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, Modal, PageHeader, SectionCard, StatusBadge } from '../../components';

const emptyRecipeForm = {
  name: '',
  targetType: 'product' as 'product' | 'variant',
  productId: '',
  productVariantId: '',
  isActive: true,
};

const emptyItemForm = {
  ingredientId: '',
  quantity: 1,
};

function getRecipeTargetLabel(recipe: Recipe) {
  if (recipe.productVariantId) {
    const variantName = recipe.productVariant?.name ?? recipe.productVariantId;
    const productName = recipe.productVariant?.product?.name ?? recipe.product?.name ?? '';
    return productName ? `${productName} / ${variantName}` : variantName;
  }
  return recipe.product?.name ?? recipe.productId ?? '—';
}

export function InventoryRecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [formState, setFormState] = useState(emptyRecipeForm);

  const [isItemsOpen, setIsItemsOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [editingItem, setEditingItem] = useState<RecipeItem | null>(null);

  const sortedRecipes = useMemo(() => [...recipes].sort((a, b) => a.name.localeCompare(b.name)), [recipes]);

  const loadBaseData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [recipeData, productData, ingredientData] = await Promise.all([
        inventoryRecipesApi.list(),
        catalogProductsApi.list(),
        inventoryIngredientsApi.list({ isActive: true }),
      ]);
      setRecipes(recipeData);
      setProducts(productData);
      setIngredients(ingredientData);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadBaseData();
  }, []);

  const loadVariants = async (productId: string) => {
    if (!productId) {
      setVariants([]);
      return;
    }

    try {
      const data = await catalogProductsApi.listVariants(productId);
      setVariants(data);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const openCreate = () => {
    setEditingRecipe(null);
    setFormState({ ...emptyRecipeForm, productId: products[0]?.id ?? '' });
    setVariants([]);
    if (products[0]?.id) {
      void loadVariants(products[0].id);
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEdit = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setFormState({
      name: recipe.name,
      targetType: recipe.productVariantId ? 'variant' : 'product',
      productId: recipe.productId ?? recipe.productVariant?.product?.id ?? '',
      productVariantId: recipe.productVariantId ?? '',
      isActive: recipe.isActive,
    });
    if (recipe.productId ?? recipe.productVariant?.product?.id) {
      void loadVariants(recipe.productId ?? recipe.productVariant?.product?.id ?? '');
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (!isSubmitting) {
      setIsModalOpen(false);
    }
  };

  const submitRecipe = async () => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        name: formState.name.trim(),
        productId: formState.targetType === 'product' ? formState.productId || undefined : undefined,
        productVariantId:
          formState.targetType === 'variant' ? formState.productVariantId || undefined : undefined,
        isActive: formState.isActive,
      };

      if (editingRecipe) {
        const updated = await inventoryRecipesApi.update(editingRecipe.id, payload);
        setRecipes((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await inventoryRecipesApi.create(payload);
        setRecipes((prev) => [...prev, created]);
      }

      setIsModalOpen(false);
    } catch (err) {
      setFormError(toErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (recipe: Recipe) => {
    const confirmed = window.confirm(`Delete recipe "${recipe.name}"?`);
    if (!confirmed) return;

    try {
      await inventoryRecipesApi.remove(recipe.id);
      setRecipes((prev) => prev.filter((item) => item.id !== recipe.id));
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const openItems = async (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setIsItemsOpen(true);
    setFormError(null);
    setEditingItem(null);
    setItemForm({ ...emptyItemForm, ingredientId: ingredients[0]?.id ?? '' });

    try {
      const data = await inventoryRecipesApi.listItems(recipe.id);
      setRecipeItems(data);
    } catch (err) {
      setFormError(toErrorMessage(err));
    }
  };

  const submitItem = async () => {
    if (!selectedRecipe) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingItem) {
        const updated = await inventoryRecipesApi.updateItem(selectedRecipe.id, editingItem.id, {
          ingredientId: itemForm.ingredientId,
          quantity: Number(itemForm.quantity),
        });
        setRecipeItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await inventoryRecipesApi.addItem(selectedRecipe.id, {
          ingredientId: itemForm.ingredientId,
          quantity: Number(itemForm.quantity),
        });
        setRecipeItems((prev) => [...prev, created]);
      }

      setEditingItem(null);
      setItemForm({ ...emptyItemForm, ingredientId: ingredients[0]?.id ?? '' });
    } catch (err) {
      setFormError(toErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const editItem = (item: RecipeItem) => {
    setEditingItem(item);
    setItemForm({
      ingredientId: item.ingredientId,
      quantity: Number(item.quantity),
    });
  };

  const removeItem = async (item: RecipeItem) => {
    if (!selectedRecipe) return;
    const confirmed = window.confirm('Delete recipe item?');
    if (!confirmed) return;

    try {
      await inventoryRecipesApi.removeItem(selectedRecipe.id, item.id);
      setRecipeItems((prev) => prev.filter((existing) => existing.id !== item.id));
    } catch (err) {
      setFormError(toErrorMessage(err));
    }
  };

  return (
    <div className="catalog-content">
      <PageHeader
        title="Recipes"
        description="Connect ingredients to products and variants for stock consumption."
        actions={
          <button type="button" onClick={openCreate}>
            New Recipe
          </button>
        }
      />

      <SectionCard>
        <DataState
          isLoading={isLoading}
          error={error}
          empty={!isLoading && recipes.length === 0}
          emptyMessage="No recipes yet. Create one to enable stock deduction."
        />
        {!isLoading && recipes.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Target</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedRecipes.map((recipe) => (
                  <tr key={recipe.id}>
                    <td>{recipe.name}</td>
                    <td className="muted">{getRecipeTargetLabel(recipe)}</td>
                    <td>{recipe._count?.items ?? '—'}</td>
                    <td>
                      <StatusBadge active={recipe.isActive} />
                    </td>
                    <td className="table-actions">
                      <button type="button" className="secondary" onClick={() => openItems(recipe)}>
                        Items
                      </button>
                      <button type="button" className="secondary" onClick={() => openEdit(recipe)}>
                        Edit
                      </button>
                      <button type="button" className="danger" onClick={() => handleDelete(recipe)}>
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
        <Modal title={editingRecipe ? 'Edit Recipe' : 'New Recipe'} onClose={closeModal}>
          <div className="form-grid">
            <label>
              Name
              <input
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Espresso Recipe"
              />
            </label>
            <label>
              Target Type
              <select
                value={formState.targetType}
                onChange={(event) => {
                  const targetType = event.target.value as 'product' | 'variant';
                  setFormState((prev) => ({
                    ...prev,
                    targetType,
                    productVariantId: targetType === 'product' ? '' : prev.productVariantId,
                  }));
                }}
              >
                <option value="product">Product</option>
                <option value="variant">Variant</option>
              </select>
            </label>
            <label>
              Product
              <select
                value={formState.productId}
                onChange={(event) => {
                  const value = event.target.value;
                  setFormState((prev) => ({ ...prev, productId: value, productVariantId: '' }));
                  void loadVariants(value);
                }}
              >
                <option value="" disabled>
                  Select product
                </option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            {formState.targetType === 'variant' ? (
              <label>
                Variant
                <select
                  value={formState.productVariantId}
                  onChange={(event) => setFormState((prev) => ({ ...prev, productVariantId: event.target.value }))}
                >
                  <option value="" disabled>
                    Select variant
                  </option>
                  {variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="checkbox">
              <input
                type="checkbox"
                checked={formState.isActive}
                onChange={(event) => setFormState((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
              Active
            </label>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button type="button" className="secondary" onClick={closeModal} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="button" onClick={submitRecipe} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Recipe'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {isItemsOpen && selectedRecipe ? (
        <Modal title={`Recipe Items - ${selectedRecipe.name}`} onClose={() => setIsItemsOpen(false)}>
          <div className="form-grid">
            <div className="table-wrap">
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th>Qty</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recipeItems.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="muted">
                        No recipe items yet.
                      </td>
                    </tr>
                  ) : (
                    recipeItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.ingredient?.name ?? item.ingredientId}
                          <span className="muted"> ({item.ingredient?.unit?.code ?? 'unit'})</span>
                        </td>
                        <td>{Number(item.quantity).toLocaleString('tr-TR', { maximumFractionDigits: 3 })}</td>
                        <td className="table-actions">
                          <button type="button" className="secondary" onClick={() => editItem(item)}>
                            Edit
                          </button>
                          <button type="button" className="danger" onClick={() => removeItem(item)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="form-row">
              <label className="inline-field">
                Ingredient
                <select
                  value={itemForm.ingredientId}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, ingredientId: event.target.value }))}
                >
                  <option value="" disabled>
                    Select ingredient
                  </option>
                  {ingredients.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>
                      {ingredient.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline-field">
                Quantity
                <input
                  type="number"
                  min={0.001}
                  step={0.001}
                  value={itemForm.quantity}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))}
                />
              </label>
              <button type="button" className="secondary" onClick={submitItem} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
              </button>
            </div>
            {formError ? <p className="error">{formError}</p> : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
