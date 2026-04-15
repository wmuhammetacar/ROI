import { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '@roi/shared-utils';
import { catalogModifiersApi } from '../../api/catalog-modifiers.api';
import type { ModifierGroup, ModifierOption, ModifierSelectionType } from '../../api/catalog-types';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, Modal, PageHeader, SectionCard, StatusBadge } from '../../components';

const emptyGroupForm = {
  name: '',
  description: '',
  selectionType: 'SINGLE' as ModifierSelectionType,
  minSelect: 0,
  maxSelect: 1,
  sortOrder: 0,
  isActive: true,
};

const emptyOptionForm = {
  name: '',
  priceDelta: 0,
  sortOrder: 0,
  isActive: true,
};

export function ModifiersPage() {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupSubmitting, setGroupSubmitting] = useState(false);

  const [optionModalOpen, setOptionModalOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<ModifierOption | null>(null);
  const [optionGroup, setOptionGroup] = useState<ModifierGroup | null>(null);
  const [optionForm, setOptionForm] = useState(emptyOptionForm);
  const [optionError, setOptionError] = useState<string | null>(null);
  const [optionSubmitting, setOptionSubmitting] = useState(false);

  const loadGroups = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await catalogModifiersApi.listGroups();
      setGroups(data);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadGroups();
  }, []);

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.sortOrder - b.sortOrder),
    [groups],
  );

  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupForm({ ...emptyGroupForm });
    setGroupError(null);
    setGroupModalOpen(true);
  };

  const openEditGroup = (group: ModifierGroup) => {
    setEditingGroup(group);
    setGroupForm({
      name: group.name,
      description: group.description ?? '',
      selectionType: group.selectionType,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      sortOrder: group.sortOrder,
      isActive: group.isActive,
    });
    setGroupError(null);
    setGroupModalOpen(true);
  };

  const submitGroup = async () => {
    setGroupSubmitting(true);
    setGroupError(null);

    try {
      const payload = {
        name: groupForm.name.trim(),
        description: groupForm.description.trim() || undefined,
        selectionType: groupForm.selectionType,
        minSelect: Number(groupForm.minSelect),
        maxSelect: Number(groupForm.maxSelect),
        sortOrder: Number(groupForm.sortOrder),
        isActive: groupForm.isActive,
      };

      if (editingGroup) {
        const updated = await catalogModifiersApi.updateGroup(editingGroup.id, payload);
        setGroups((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await catalogModifiersApi.createGroup(payload);
        setGroups((prev) => [...prev, { ...created, options: [] }]);
      }

      setGroupModalOpen(false);
    } catch (err) {
      setGroupError(toErrorMessage(err));
    } finally {
      setGroupSubmitting(false);
    }
  };

  const deleteGroup = async (group: ModifierGroup) => {
    const confirmed = window.confirm(`Delete modifier group "${group.name}"?`);
    if (!confirmed) return;

    try {
      await catalogModifiersApi.removeGroup(group.id);
      setGroups((prev) => prev.filter((item) => item.id !== group.id));
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const openCreateOption = (group: ModifierGroup) => {
    setOptionGroup(group);
    setEditingOption(null);
    setOptionForm({ ...emptyOptionForm });
    setOptionError(null);
    setOptionModalOpen(true);
  };

  const openEditOption = (group: ModifierGroup, option: ModifierOption) => {
    setOptionGroup(group);
    setEditingOption(option);
    setOptionForm({
      name: option.name,
      priceDelta: Number(option.priceDelta),
      sortOrder: option.sortOrder,
      isActive: option.isActive,
    });
    setOptionError(null);
    setOptionModalOpen(true);
  };

  const submitOption = async () => {
    if (!optionGroup) return;
    setOptionSubmitting(true);
    setOptionError(null);

    try {
      const payload = {
        name: optionForm.name.trim(),
        priceDelta: Number(optionForm.priceDelta),
        sortOrder: Number(optionForm.sortOrder),
        isActive: optionForm.isActive,
      };

      if (editingOption) {
        await catalogModifiersApi.updateOption(optionGroup.id, editingOption.id, payload);
      } else {
        await catalogModifiersApi.createOption(optionGroup.id, payload);
      }

      await loadGroups();
      setOptionModalOpen(false);
    } catch (err) {
      setOptionError(toErrorMessage(err));
    } finally {
      setOptionSubmitting(false);
    }
  };

  const deleteOption = async (group: ModifierGroup, option: ModifierOption) => {
    const confirmed = window.confirm(`Delete option "${option.name}"?`);
    if (!confirmed) return;

    try {
      await catalogModifiersApi.removeOption(group.id, option.id);
      await loadGroups();
    } catch (err) {
      setOptionError(toErrorMessage(err));
    }
  };

  return (
    <div className="catalog-content">
      <PageHeader
        title="Modifiers"
        description="Configure modifier groups and their selectable options."
        actions={
          <button type="button" onClick={openCreateGroup}>
            New Modifier Group
          </button>
        }
      />

      <SectionCard>
        <DataState
          isLoading={isLoading}
          error={error}
          empty={!isLoading && groups.length === 0}
          emptyMessage="No modifier groups yet. Create one to attach options."
        />
        {!isLoading && groups.length > 0 ? (
          <div className="modifier-grid">
            {sortedGroups.map((group) => (
              <div key={group.id} className="modifier-card">
                <header className="modifier-card-header">
                  <div>
                    <h3>{group.name}</h3>
                    <p className="muted">
                      {group.selectionType} • min {group.minSelect} / max {group.maxSelect}
                    </p>
                  </div>
                  <div className="badge-row">
                    <StatusBadge active={group.isActive} />
                  </div>
                </header>
                <p className="muted">{group.description ?? 'No description'}</p>
                <div className="modifier-card-actions">
                  <button type="button" className="secondary" onClick={() => openEditGroup(group)}>
                    Edit Group
                  </button>
                  <button type="button" className="secondary" onClick={() => openCreateOption(group)}>
                    Add Option
                  </button>
                  <button type="button" className="danger" onClick={() => deleteGroup(group)}>
                    Delete
                  </button>
                </div>

                {group.options && group.options.length > 0 ? (
                  <div className="table-wrap">
                    <table className="data-table compact">
                      <thead>
                        <tr>
                          <th>Option</th>
                          <th>Price Delta</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.options.map((option) => (
                          <tr key={option.id}>
                            <td>{option.name}</td>
                            <td>{formatCurrency(option.priceDelta)}</td>
                            <td>
                              <StatusBadge active={option.isActive} />
                            </td>
                            <td className="table-actions">
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => openEditOption(group, option)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="danger"
                                onClick={() => deleteOption(group, option)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted">No options yet.</p>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </SectionCard>

      {groupModalOpen ? (
        <Modal title={editingGroup ? 'Edit Modifier Group' : 'New Modifier Group'} onClose={() => setGroupModalOpen(false)}>
          <div className="form-grid">
            <label>
              Name
              <input
                value={groupForm.name}
                onChange={(event) => setGroupForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>
            <label>
              Description
              <textarea
                value={groupForm.description}
                onChange={(event) =>
                  setGroupForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </label>
            <div className="form-row">
              <label>
                Selection Type
                <select
                  value={groupForm.selectionType}
                  onChange={(event) =>
                    setGroupForm((prev) => ({
                      ...prev,
                      selectionType: event.target.value as ModifierSelectionType,
                    }))
                  }
                >
                  <option value="SINGLE">Single</option>
                  <option value="MULTIPLE">Multiple</option>
                </select>
              </label>
              <label>
                Min Select
                <input
                  type="number"
                  value={groupForm.minSelect}
                  onChange={(event) =>
                    setGroupForm((prev) => ({ ...prev, minSelect: Number(event.target.value) }))
                  }
                  min={0}
                />
              </label>
              <label>
                Max Select
                <input
                  type="number"
                  value={groupForm.maxSelect}
                  onChange={(event) =>
                    setGroupForm((prev) => ({ ...prev, maxSelect: Number(event.target.value) }))
                  }
                  min={0}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Sort Order
                <input
                  type="number"
                  value={groupForm.sortOrder}
                  onChange={(event) =>
                    setGroupForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) }))
                  }
                  min={0}
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={groupForm.isActive}
                  onChange={(event) =>
                    setGroupForm((prev) => ({ ...prev, isActive: event.target.checked }))
                  }
                />
                Active
              </label>
            </div>
            {groupError ? <p className="error">{groupError}</p> : null}
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setGroupModalOpen(false)}>
                Cancel
              </button>
              <button type="button" onClick={submitGroup} disabled={groupSubmitting}>
                {groupSubmitting ? 'Saving...' : 'Save Group'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {optionModalOpen ? (
        <Modal
          title={editingOption ? 'Edit Modifier Option' : 'New Modifier Option'}
          onClose={() => setOptionModalOpen(false)}
        >
          <div className="form-grid">
            <label>
              Name
              <input
                value={optionForm.name}
                onChange={(event) => setOptionForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>
            <div className="form-row">
              <label>
                Price Delta
                <input
                  type="number"
                  value={optionForm.priceDelta}
                  onChange={(event) =>
                    setOptionForm((prev) => ({ ...prev, priceDelta: Number(event.target.value) }))
                  }
                />
              </label>
              <label>
                Sort Order
                <input
                  type="number"
                  value={optionForm.sortOrder}
                  onChange={(event) =>
                    setOptionForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) }))
                  }
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={optionForm.isActive}
                  onChange={(event) =>
                    setOptionForm((prev) => ({ ...prev, isActive: event.target.checked }))
                  }
                />
                Active
              </label>
            </div>
            {optionError ? <p className="error">{optionError}</p> : null}
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setOptionModalOpen(false)}>
                Cancel
              </button>
              <button type="button" onClick={submitOption} disabled={optionSubmitting}>
                {optionSubmitting ? 'Saving...' : 'Save Option'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
