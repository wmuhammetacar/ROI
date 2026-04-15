import { useEffect, useMemo, useState } from 'react';
import { inventoryIngredientsApi, inventoryMovementsApi } from '../../api';
import type { Ingredient, StockMovement, StockMovementType, StockReferenceType } from '../../api/inventory-types';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, PageHeader, SectionCard } from '../../components';

const movementTypes: StockMovementType[] = [
  'IN',
  'OUT',
  'ADJUSTMENT_PLUS',
  'ADJUSTMENT_MINUS',
  'WASTE',
];

const referenceTypes: StockReferenceType[] = [
  'ORDER',
  'PAYMENT',
  'RECIPE_CONSUMPTION',
  'MANUAL_ADJUSTMENT',
  'WASTE_RECORD',
  'OTHER',
];

function formatStock(value: string | number) {
  const amount = Number(value ?? 0);
  if (Number.isNaN(amount)) return '0';
  return amount.toLocaleString('tr-TR', { maximumFractionDigits: 3 });
}

export function InventoryMovementsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingredientId, setIngredientId] = useState('');
  const [movementType, setMovementType] = useState<StockMovementType | ''>('');
  const [referenceType, setReferenceType] = useState<StockReferenceType | ''>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadIngredients = async () => {
    try {
      const data = await inventoryIngredientsApi.list();
      setIngredients(data);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const loadMovements = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await inventoryMovementsApi.list({
        ingredientId: ingredientId || undefined,
        movementType: movementType || undefined,
        referenceType: referenceType || undefined,
      });
      setMovements(data);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadIngredients();
  }, []);

  useEffect(() => {
    void loadMovements();
  }, [ingredientId, movementType, referenceType]);

  const sortedMovements = useMemo(
    () => [...movements].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [movements],
  );

  return (
    <div className="catalog-content">
      <PageHeader
        title="Stock Movements"
        description="Audit trail of stock adjustments and consumption."
        actions={
          <button type="button" onClick={loadMovements}>
            Refresh
          </button>
        }
      />

      <SectionCard>
        <div className="table-toolbar">
          <label className="inline-field">
            Ingredient
            <select value={ingredientId} onChange={(event) => setIngredientId(event.target.value)}>
              <option value="">All ingredients</option>
              {ingredients.map((ingredient) => (
                <option key={ingredient.id} value={ingredient.id}>
                  {ingredient.name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            Movement Type
            <select value={movementType} onChange={(event) => setMovementType(event.target.value as StockMovementType | '')}>
              <option value="">All types</option>
              {movementTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            Reference
            <select value={referenceType} onChange={(event) => setReferenceType(event.target.value as StockReferenceType | '')}>
              <option value="">All references</option>
              {referenceTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
        </div>

        <DataState
          isLoading={isLoading}
          error={error}
          empty={!isLoading && movements.length === 0}
          emptyMessage="No stock movements found."
        />

        {!isLoading && movements.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Reference</th>
                  <th>Notes</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {sortedMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{movement.ingredient?.name ?? movement.ingredientId}</td>
                    <td>
                      <span
                        className={`movement-badge movement-${movement.movementType
                          .toLowerCase()
                          .replace(/_/g, '-')}`}
                      >
                        {movement.movementType}
                      </span>
                    </td>
                    <td>{formatStock(movement.quantity)}</td>
                    <td>{formatStock(movement.balanceBefore)}</td>
                    <td>{formatStock(movement.balanceAfter)}</td>
                    <td>{movement.referenceType}</td>
                    <td className="muted">{movement.notes ?? '—'}</td>
                    <td>{new Date(movement.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
