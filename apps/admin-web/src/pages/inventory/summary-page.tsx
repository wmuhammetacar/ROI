import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { inventoryIngredientsApi, inventorySummaryApi } from '../../api';
import type { InventorySummary, InventorySummaryItem } from '../../api/inventory-types';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, MetricCard, Modal, PageHeader, SectionCard, StatusBadge } from '../../components';

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

function isLowStock(item: InventorySummaryItem) {
  return Number(item.lowStockThreshold) > 0 && Number(item.currentStock) <= Number(item.lowStockThreshold);
}

export function InventorySummaryPage() {
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isWasteOpen, setIsWasteOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<InventorySummaryItem | null>(null);
  const [adjustForm, setAdjustForm] = useState(emptyAdjustForm);
  const [wasteForm, setWasteForm] = useState(emptyWasteForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadSummary = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await inventorySummaryApi.getSummary({ activeOnly: false });
      setSummary(data);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  const items = useMemo(() => summary?.items ?? [], [summary]);

  const openAdjust = (ingredient: InventorySummaryItem) => {
    setSelectedIngredient(ingredient);
    setAdjustForm({ ...emptyAdjustForm });
    setFormError(null);
    setIsAdjustOpen(true);
  };

  const openWaste = (ingredient: InventorySummaryItem) => {
    setSelectedIngredient(ingredient);
    setWasteForm({ ...emptyWasteForm });
    setFormError(null);
    setIsWasteOpen(true);
  };

  const closeModals = () => {
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
      await loadSummary();
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
      await loadSummary();
    } catch (err) {
      setFormError(toErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="catalog-content">
      <PageHeader
        title="Inventory Summary"
        description="Operational overview of current ingredient stock and recent movements."
        actions={
          <button type="button" onClick={loadSummary}>
            Refresh
          </button>
        }
      />

      <SectionCard>
        {summary ? (
          <div className="metric-grid">
            <MetricCard label="Ingredients" value={`${summary.totalIngredients}`} />
            <MetricCard label="Low Stock" value={`${summary.lowStockCount}`} helper={summary.lowStockCount > 0 ? 'Action required' : 'Healthy'} />
            <MetricCard label="Recent Moves (24h)" value={`${summary.recentMovementCount24h}`} />
            <MetricCard label="Recipe Coverage" value={`${summary.recipeCoverageCount}`} />
          </div>
        ) : null}
        <DataState
          isLoading={isLoading}
          error={error}
          empty={!isLoading && items.length === 0}
          emptyMessage="No ingredients found for this branch."
        />
        {!isLoading && items.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Unit</th>
                  <th>Current Stock</th>
                  <th>Low Stock Threshold</th>
                  <th>Risk</th>
                  <th>Status</th>
                  <th>Latest Movement</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((ingredient) => (
                  <tr key={ingredient.id}>
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
                      {Number(ingredient.lowStockThreshold) > 0
                        ? `${formatStock(ingredient.lowStockThreshold)} ${ingredient.unit?.code ?? ''}`
                        : '—'}
                    </td>
                    <td>
                      {isLowStock(ingredient) ? <span className="status-chip warn">Low</span> : <span className="status-chip ok">Healthy</span>}
                    </td>
                    <td>
                      <StatusBadge active={ingredient.isActive} />
                    </td>
                    <td className="muted">
                      {ingredient.latestMovementAt
                        ? new Date(ingredient.latestMovementAt).toLocaleString()
                        : '—'}
                    </td>
                    <td className="table-actions">
                      <button type="button" className="secondary" onClick={() => openAdjust(ingredient)}>
                        Adjust
                      </button>
                      <button type="button" className="secondary" onClick={() => openWaste(ingredient)}>
                        Waste
                      </button>
                      <Link className="secondary" to={`/inventory/ingredients?ingredientId=${ingredient.id}`}>
                        Detail
                      </Link>
                      <Link className="secondary" to={`/inventory/movements?ingredientId=${ingredient.id}`}>
                        Movements
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </SectionCard>

      {isAdjustOpen && selectedIngredient ? (
        <Modal title={`Adjust Stock - ${selectedIngredient.name}`} onClose={closeModals}>
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
              <button type="button" className="secondary" onClick={closeModals} disabled={isSubmitting}>
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
        <Modal title={`Record Waste - ${selectedIngredient.name}`} onClose={closeModals}>
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
              Reason (Waste / Fire)
              <textarea
                value={wasteForm.reason}
                onChange={(event) => setWasteForm((prev) => ({ ...prev, reason: event.target.value }))}
              />
            </label>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button type="button" className="secondary" onClick={closeModals} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="button" onClick={submitWaste} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Record Waste'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
