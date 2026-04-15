import { formatCurrency } from '@roi/shared-utils';
import type { CartItem } from '../app/cart-context';

interface CartItemRowProps {
  item: CartItem;
  onRemove: () => void;
}

export function CartItemRow({ item, onRemove }: CartItemRowProps) {
  return (
    <div className="cart-item">
      <div className="row-between">
        <strong>{item.productName}</strong>
        <strong>{formatCurrency(item.lineTotal)}</strong>
      </div>
      <p className="muted">
        Qty {item.quantity}
        {item.variantName ? ` | ${item.variantName}` : ''}
      </p>
      {item.modifierSelections.length > 0 ? (
        <p className="muted">
          {item.modifierSelections
            .map((selection) => `${selection.modifierGroupName}: ${selection.optionNames.join(', ')}`)
            .join(' | ')}
        </p>
      ) : null}
      {item.notes ? <p className="muted">Note: {item.notes}</p> : null}
      <div className="row-end">
        <button type="button" className="ghost" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}
