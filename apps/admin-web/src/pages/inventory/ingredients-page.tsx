import { useEffect, useMemo, useState } from 'react';
import { inventoryIngredientsApi, inventoryUnitsApi } from '../../api';
import type { Ingredient, StockMovement, UnitOfMeasure, WasteRecord } from '../../api/inventory-types';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, Modal, PageHeader, SectionCard, StatusBadge } from '../../components';

const emptyIngredientForm = {
  name: '',
  sku: '',
  unitId: '',
  currentStock: 0,
  isActive: true,
};

const emptyAdjustForm = {
  adjustmentType: 'PLUS' as 'PLUS' | 'MINUS',
  quantity: 1,
  notes: '',
};

const emptyWasteForm = {
  quantity: 1,
  reason: '',
};

function formatStock(value: string | number) {
  const amount = Number(value ?? 0);
  if (Number.isNaN(amount)) return '0';
  return amount.toLocaleString('tr-TR', { maximumFractionDigits: 3 });
}

export function InventoryIngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [filterState, setFilterState] = useState<'all' | 'active' | 'inactive'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [formState, setFormState] = useState(emptyIngredientForm);

  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState(emptyAdjustForm);
  const [isWasteOpen, setIsWasteOpen] = useState(false);
  const [wasteForm, setWasteForm] = useState(emptyWasteForm);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [isMovementsOpen, setIsMovementsOpen] = useState(false);
  const [isWasteRecordsOpen, setIsWasteRecordsOpen] = useState(false);

  const sortedIngredients = useMemo(
    () => [...ingredients].sort((a, b) => a.name.localeCompare(b.name)),
    [ingredients],
  );

  const loadUnits = async () => {
    try {
      const data = await inventoryUnitsApi.list();
      setUnits(data);
      if (!formState.unitId && data.length > 0) {
        setFormState((prev) => ({ ...prev, unitId: data[0].id }));
      }
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const loadIngredients = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const isActive = filterState === 'all' ? undefined : filterState === 'active';
      const data = await inventoryIngredientsApi.list({ isActive });
      setIngredients(data);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUnits();
  }, []);

  useEffect(() => {
    void loadIngredients();
  }, [filterState]);

  const openCreate = () => {
    setEditingIngredient(null);
    setFormState({ ...emptyIngredientForm, unitId: units[0]?.id ?? '' });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEdit = (ingredient: Ingredient) => {
    setEditingIngredient(ingredient);
    setFormState({
      name: ingredient.name,
      sku: ingredient.sku ?? '',
      unitId: ingredient.unitId,
      currentStock: Number(ingredient.currentStock),
      isActive: ingredient.isActive,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (!isSubmitting) {
      setIsModalOpen(false);
    }
  };

  const submitIngredient = async () => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        name: formState.name.trim(),
        sku: formState.sku.trim() || undefined,
        unitId: formState.unitId,
        currentStock: Number(formState.currentStock),
        isActive: formState.isActive,
      };

      if (editingIngredient) {
        const updated = await inventoryIngredientsApi.update(editingIngredient.id, payload);
        setIngredients((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await inventoryIngredientsApi.create(payload);
        setIngredients((prev) => [...prev, created]);
      }

      setIsModalOpen(false);
    } catch (err) {
      setFormError(toErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (ingredient: Ingredient) => {
    const confirmed = window.confirm(`Delete ingredient "${ingredient.name}"?`);
    if (!confirmed) return;

    try {
      await inventoryIngredientsApi.remove(ingredient.id);
      setIngredients((prev) => prev.filter((item) => item.id !== ingredient.id));
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const toggleActive = async (ingredient: Ingredient) => {
    setError(null);

    try {
      const updated = await inventoryIngredientsApi.updateActiveState(ingredient.id, {
        isActive: !ingredient.isActive,
      });
      setIngredients((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const openAdjust = (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setAdjustForm({ ...emptyAdjustForm });
    setFormError(null);
    setIsAdjustOpen(true);
  };

  const openWaste = (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setWasteForm({ ...emptyWasteForm });
    setFormError(null);
    setIsWasteOpen(true);
  };

  const closeOperationalModal = () => {
    if (!isSubmitting) {
      setIsAdjustOpen(false);
      setIsWasteOpen(false);
    }
  };

  const submitAdjust = async () => {
    if (!selectedIngredient) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      await inventoryIngredientsApi.adjustStock(selectedIngredient.id, {
        adjustmentType: adjustForm.adjustmentType,
        quantity: Number(adjustForm.quantity),
        notes: adjustForm.notes.trim() || undefined,
      });
      setIsAdjustOpen(false);
      await loadIngredients();
    } catch (err) {
      setFormError(toErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitWaste = async () => {
    if (!selectedIngredient) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      await inventoryIngredientsApi.createWaste(selectedIngredient.id, {
        quantity: Number(wasteForm.quantity),
        reason: wasteForm.reason.trim(),
      });
      setIsWasteOpen(false);
      await loadIngredients();
    } catch (err) {
      setFormError(toErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openMovements = async (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setFormError(null);
    try {
      const data = await inventoryIngredientsApi.listStockMovements(ingredient.id, { limit: 200 });
      setStockMovements(data);
      setIsMovementsOpen(true);
    } catch (err) {
      setFormError(toErrorMessage(err));
    }
  };

  const openWasteRecords = async (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setFormError(null);
    try {
      const data = await inventoryIngredientsApi.listWasteRecords(ingredient.id, { limit: 200 });
      setWasteRecords(data);
      setIsWasteRecordsOpen(true);
    } catch (err) {
      setFormError(toErrorMessage(err));
    }
  };

  return (
    <div className="catalog-content">
      <PageHeader
        title="Ingredients"
        description="Manage stock-tracked ingredients and operational adjustments."
        actions={
          <button type="button" onClick={openCreate}>
            New Ingredient
          </button>
        }
      />

      <SectionCard>
        <div className="table-toolbar">
          <label className="inline-field">
            Status Filter
            <select value={filterState} onChange={(event) => setFilterState(event.target.value as typeof filterState)}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <button type="button" className="secondary" onClick={loadIngredients}>
            Refresh
          </button>
        </div>
        <DataState
          isLoading={isLoading}
          error={error}
          empty={!isLoading && ingredients.length === 0}
          emptyMessage="No ingredients yet. Create your first stock item."
        />
        {!isLoading && ingredients.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Unit</th>
                  <th>Current Stock</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedIngredients.map((ingredient) => (
                  <tr key={ingredient.id} className={ingredient.isActive ? 'active-row' : undefined}>
                    <td>
                      <div className="title-stack">
                        <strong>{ingredient.name}</strong>
                        <span className="muted">SKU: {ingredient.sku ?? '—'}</span>
                      </div>
                    </td>
                    <td>{ingredient.unit?.code ?? '—'}</td>
                    <td className="stock-value">
                      {formatStock(ingredient.currentStock)} {ingredient.unit?.code ?? ''}
                    </td>
                    <td>
                      <StatusBadge active={ingredient.isActive} />
                    </td>
                    <td className="table-actions">
                      <button type="button" className="secondary" onClick={() => openEdit(ingredient)}>
                        Edit
                      </button>
                      <button type="button" className="secondary" onClick={() => toggleActive(ingredient)}>
                        {ingredient.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button type="button" className="secondary" onClick={() => openAdjust(ingredient)}>
                        Adjust
                      </button>
                      <button type="button" className="secondary" onClick={() => openWaste(ingredient)}>
                        Waste
                      </button>
                      <button type="button" className="secondary" onClick={() => openMovements(ingredient)}>
                        Movements
                      </button>
                      <button type="button" className="secondary" onClick={() => openWasteRecords(ingredient)}>
                        Waste Records
                      </button>
                      <button type="button" className="danger" onClick={() => handleDelete(ingredient)}>
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
        <Modal title={editingIngredient ? 'Edit Ingredient' : 'New Ingredient'} onClose={closeModal}>
          <div className="form-grid">
            <label>
              Name
              <input
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Espresso Beans"
              />
            </label>
            <label>
              SKU
              <input
                value={formState.sku}
                onChange={(event) => setFormState((prev) => ({ ...prev, sku: event.target.value }))}
                placeholder="BEANS-001"
              />
            </label>
            <label>
              Unit
              <select
                value={formState.unitId}
                onChange={(event) => setFormState((prev) => ({ ...prev, unitId: event.target.value }))}
              >
                <option value="" disabled>
                  Select unit
                </option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.code})
                  </option>
                ))}
              </select>
            </label>
            {!editingIngredient ? (
              <label>
                Starting Stock
                <input
                  type="number"
                  min={0}
                  step={0.001}
                  value={formState.currentStock}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, currentStock: Number(event.target.value) }))
                  }
                />
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
              <button type="button" onClick={submitIngredient} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Ingredient'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {isAdjustOpen && selectedIngredient ? (
        <Modal title={`Adjust Stock - ${selectedIngredient.name}`} onClose={closeOperationalModal}>
          <div className="form-grid">
            <label>
              Adjustment Type
              <select
                value={adjustForm.adjustmentType}
                onChange={(event) =>
                  setAdjustForm((prev) => ({ ...prev, adjustmentType: event.target.value as 'PLUS' | 'MINUS' }))
                }
              >
                <option value="PLUS">Plus</option>
                <option value="MINUS">Minus</option>
              </select>
            </label>
            <label>
              Quantity ({selectedIngredient.unit?.code ?? 'unit'})
              <input
                type="number"
                min={0.001}
                step={0.001}
                value={adjustForm.quantity}
                onChange={(event) =>
                  setAdjustForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))
                }
              />
            </label>
            <label>
              Notes (optional)
              <textarea
                value={adjustForm.notes}
                onChange={(event) => setAdjustForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </label>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button type="button" className="secondary" onClick={closeOperationalModal} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="button" onClick={submitAdjust} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Adjustment'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {isWasteOpen && selectedIngredient ? (
        <Modal title={`Record Waste - ${selectedIngredient.name}`} onClose={closeOperationalModal}>
          <div className="form-grid">
            <label>
              Quantity ({selectedIngredient.unit?.code ?? 'unit'})
              <input
                type="number"
                min={0.001}
                step={0.001}
                value={wasteForm.quantity}
                onChange={(event) =>
                  setWasteForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))
                }
              />
            </label>
            <label>
              Reason
              <textarea
                value={wasteForm.reason}
                onChange={(event) => setWasteForm((prev) => ({ ...prev, reason: event.target.value }))}
              />
            </label>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button type="button" className="secondary" onClick={closeOperationalModal} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="button" onClick={submitWaste} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Record Waste'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {isMovementsOpen && selectedIngredient ? (
        <Modal title={`Stock Movements - ${selectedIngredient.name}`} onClose={() => setIsMovementsOpen(false)}>
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Ref</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {stockMovements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      No movements found.
                    </td>
                  </tr>
                ) : (
                  stockMovements.map((movement) => (
                    <tr key={movement.id}>
                      <td>{movement.movementType}</td>
                      <td>{formatStock(movement.quantity)}</td>
                      <td>{formatStock(movement.balanceBefore)}</td>
                      <td>{formatStock(movement.balanceAfter)}</td>
                      <td>{movement.referenceType}</td>
                      <td>{new Date(movement.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      ) : null}

      {isWasteRecordsOpen && selectedIngredient ? (
        <Modal title={`Waste Records - ${selectedIngredient.name}`} onClose={() => setIsWasteRecordsOpen(false)}>
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Qty</th>
                  <th>Reason</th>
                  <th>By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {wasteRecords.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      No waste records found.
                    </td>
                  </tr>
                ) : (
                  wasteRecords.map((record) => (
                    <tr key={record.id}>
                      <td>{formatStock(record.quantity)}</td>
                      <td>{record.reason}</td>
                      <td>{record.createdByUser?.name ?? '—'}</td>
                      <td>{new Date(record.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
