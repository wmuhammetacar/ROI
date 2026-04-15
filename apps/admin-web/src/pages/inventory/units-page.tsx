import { useEffect, useMemo, useState } from 'react';
import { inventoryUnitsApi } from '../../api';
import type { UnitKind, UnitOfMeasure } from '../../api/inventory-types';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, Modal, PageHeader, SectionCard } from '../../components';

const emptyUnitForm = {
  name: '',
  code: '',
  kind: 'WEIGHT' as UnitKind,
};

export function InventoryUnitsPage() {
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitOfMeasure | null>(null);
  const [formState, setFormState] = useState(emptyUnitForm);

  const sortedUnits = useMemo(() => [...units].sort((a, b) => a.name.localeCompare(b.name)), [units]);

  const loadUnits = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await inventoryUnitsApi.list();
      setUnits(data);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUnits();
  }, []);

  const openCreate = () => {
    setEditingUnit(null);
    setFormState({ ...emptyUnitForm });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEdit = (unit: UnitOfMeasure) => {
    setEditingUnit(unit);
    setFormState({
      name: unit.name,
      code: unit.code,
      kind: unit.kind,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (!isSubmitting) {
      setIsModalOpen(false);
    }
  };

  const submitUnit = async () => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        name: formState.name.trim(),
        code: formState.code.trim(),
        kind: formState.kind,
      };

      if (editingUnit) {
        const updated = await inventoryUnitsApi.update(editingUnit.id, payload);
        setUnits((prev) => prev.map((unit) => (unit.id === updated.id ? updated : unit)));
      } else {
        const created = await inventoryUnitsApi.create(payload);
        setUnits((prev) => [...prev, created]);
      }

      setIsModalOpen(false);
    } catch (err) {
      setFormError(toErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (unit: UnitOfMeasure) => {
    const confirmed = window.confirm(`Delete unit "${unit.name}"?`);
    if (!confirmed) return;

    try {
      await inventoryUnitsApi.remove(unit.id);
      setUnits((prev) => prev.filter((item) => item.id !== unit.id));
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  return (
    <div className="catalog-content">
      <PageHeader
        title="Units of Measure"
        description="Manage measurement units used for ingredients and recipes."
        actions={
          <button type="button" onClick={openCreate}>
            New Unit
          </button>
        }
      />

      <SectionCard>
        <DataState
          isLoading={isLoading}
          error={error}
          empty={!isLoading && units.length === 0}
          emptyMessage="No units yet. Create the first measurement unit."
        />
        {!isLoading && units.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Kind</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedUnits.map((unit) => (
                  <tr key={unit.id}>
                    <td>{unit.name}</td>
                    <td className="muted">{unit.code}</td>
                    <td>{unit.kind}</td>
                    <td className="table-actions">
                      <button type="button" className="secondary" onClick={() => openEdit(unit)}>
                        Edit
                      </button>
                      <button type="button" className="danger" onClick={() => handleDelete(unit)}>
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
        <Modal title={editingUnit ? 'Edit Unit' : 'New Unit'} onClose={closeModal}>
          <div className="form-grid">
            <label>
              Name
              <input
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Gram"
              />
            </label>
            <label>
              Code
              <input
                value={formState.code}
                onChange={(event) => setFormState((prev) => ({ ...prev, code: event.target.value }))}
                placeholder="g"
              />
            </label>
            <label>
              Kind
              <select
                value={formState.kind}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, kind: event.target.value as UnitKind }))
                }
              >
                <option value="WEIGHT">Weight</option>
                <option value="VOLUME">Volume</option>
                <option value="COUNT">Count</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button type="button" className="secondary" onClick={closeModal} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="button" onClick={submitUnit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Unit'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
