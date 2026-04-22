import { useMemo, useState } from 'react';
import { formatCurrency } from '@roi/shared-utils';
import type { CartModifierSnapshot } from '../app/cart-context';
import type { PosCatalogModifierGroup, PosCatalogProduct } from '../api';
import { Modal } from './modal';
import { QuantityControl } from './quantity-control';

interface ProductConfiguratorModalProps {
  product: PosCatalogProduct;
  onClose: () => void;
  onAdd: (input: {
    variantId?: string | null;
    variantName?: string | null;
    quantity: number;
    notes?: string;
    modifierSelections: CartModifierSnapshot[];
    unitPrice: number;
    lineTotal: number;
  }) => void;
}

function sortModifierGroups(product: PosCatalogProduct) {
  return [...product.modifierGroupLinks]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((link) => ({ ...link.modifierGroup, isRequired: link.isRequired })) as Array<
    PosCatalogModifierGroup & { isRequired: boolean }
  >;
}

export function ProductConfiguratorModal({ product, onClose, onAdd }: ProductConfiguratorModalProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const groups = useMemo(() => sortModifierGroups(product), [product]);
  const selectedVariant = product.variants.find((variant) => variant.id === selectedVariantId) ?? null;

  const modifierSelections = useMemo<CartModifierSnapshot[]>(() => {
    return groups
      .map((group) => {
        const selectedOptionIds = selectedByGroup[group.id] ?? [];
        const selectedOptions = group.options.filter((option) => selectedOptionIds.includes(option.id));
        return {
          modifierGroupId: group.id,
          modifierGroupName: group.name,
          optionIds: selectedOptions.map((option) => option.id),
          optionNames: selectedOptions.map((option) => option.name),
          totalPriceDelta: selectedOptions.reduce((acc, option) => acc + Number(option.priceDelta), 0),
        };
      })
      .filter((selection) => selection.optionIds.length > 0);
  }, [groups, selectedByGroup]);

  const modifierDelta = modifierSelections.reduce((acc, selection) => acc + selection.totalPriceDelta, 0);
  const variantDelta = selectedVariant ? Number(selectedVariant.priceDelta) : 0;
  const unitPrice = Number(product.basePrice) + variantDelta + modifierDelta;
  const lineTotal = unitPrice * quantity;

  const selectModifierOption = (groupId: string, optionId: string, selectionType: 'SINGLE' | 'MULTIPLE') => {
    setSelectedByGroup((prev) => {
      const current = prev[groupId] ?? [];
      if (selectionType === 'SINGLE') {
        return { ...prev, [groupId]: [optionId] };
      }

      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((item) => item !== optionId) };
      }
      return { ...prev, [groupId]: [...current, optionId] };
    });
  };

  const submit = () => {
    for (const group of groups) {
      const selectedCount = (selectedByGroup[group.id] ?? []).length;
      const minSelect = group.isRequired ? Math.max(1, group.minSelect) : group.minSelect;
      if (selectedCount < minSelect) {
        setFormError(`Select at least ${minSelect} option(s) for "${group.name}".`);
        return;
      }
      if (selectedCount > group.maxSelect) {
        setFormError(`Select at most ${group.maxSelect} option(s) for "${group.name}".`);
        return;
      }
    }

    onAdd({
      variantId: selectedVariant?.id ?? null,
      variantName: selectedVariant?.name ?? null,
      quantity,
      notes: notes.trim() || undefined,
      modifierSelections,
      unitPrice,
      lineTotal,
    });
  };

  return (
    <Modal title={product.name} onClose={onClose}>
      <div className="form-grid product-config-content">
        <p className="muted">{product.description ?? 'No additional description.'}</p>
        {product.allergenTags.length > 0 ? (
          <div className="selector-block allergen-block">
            <strong>Allergens</strong>
            <div className="allergen-row">
              {product.allergenTags.map((tag) => (
                <span key={tag} className="allergen-chip">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {product.variants.length > 0 ? (
          <div className="selector-block">
            <strong>Variant</strong>
            <div className="option-list">
              <button
                type="button"
                className={`option-row ${selectedVariantId === '' ? 'active' : ''}`}
                onClick={() => setSelectedVariantId('')}
              >
                <span>Default</span>
                <span>{formatCurrency(Number(product.basePrice))}</span>
              </button>
              {product.variants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  className={`option-row ${selectedVariantId === variant.id ? 'active' : ''}`}
                  onClick={() => setSelectedVariantId(variant.id)}
                >
                  <span>{variant.name}</span>
                  <span>{formatCurrency(Number(product.basePrice) + Number(variant.priceDelta))}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {groups.map((group) => {
          const selectedIds = selectedByGroup[group.id] ?? [];
          return (
            <div key={group.id} className="selector-block">
              <strong>
                {group.name} {group.isRequired ? '(Required)' : '(Optional)'}
              </strong>
              <span className="muted">
                Select {group.minSelect}-{group.maxSelect}
              </span>
              <div className="option-list">
                {group.options.map((option) => {
                  const active = selectedIds.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`option-row ${active ? 'active' : ''}`}
                      onClick={() => selectModifierOption(group.id, option.id, group.selectionType)}
                    >
                      <span>{option.name}</span>
                      <span>{Number(option.priceDelta) > 0 ? `+${formatCurrency(Number(option.priceDelta))}` : 'Included'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <label>
          Notes
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional item note" />
        </label>
        <div className="row-between">
          <QuantityControl value={quantity} onChange={setQuantity} />
          <strong>{formatCurrency(lineTotal)}</strong>
        </div>
        {formError ? <p className="error">{formError}</p> : null}
        <div className="row-end">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={submit}>
            Add to Cart
          </button>
        </div>
      </div>
    </Modal>
  );
}
