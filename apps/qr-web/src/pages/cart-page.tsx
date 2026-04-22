import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatCurrency } from '@roi/shared-utils';
import { publicOrderingApi } from '../api';
import { useCartContext } from '../app/cart-context';
import { toErrorMessage } from '../app/error-utils';
import { usePublicContext } from '../app/public-context';
import { CartItemRow, PublicErrorState } from '../components';

export function CartPage() {
  const navigate = useNavigate();
  const { branchId, tableId, appendContext, hasValidBranchContext } = usePublicContext();
  const { contextKey, items, subtotal, removeItem, clear } = useCartContext();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pendingRetryRef = useRef<{ fingerprint: string; key: string } | null>(null);

  if (!hasValidBranchContext) {
    return (
      <PublicErrorState
        title="Invalid order context"
        message="Missing branch context. Return to menu using a valid QR link."
      />
    );
  }

  const normalizedPayload = useMemo(
    () => ({
      branchId,
      tableId: tableId || undefined,
      clientSessionId: contextKey || undefined,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      notes: notes.trim() || undefined,
      items: items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? undefined,
        quantity: item.quantity,
        notes: item.notes,
        modifierSelections: item.modifierSelections.map((selection) => ({
          modifierGroupId: selection.modifierGroupId,
          optionIds: [...selection.optionIds].sort(),
        })),
      })),
    }),
    [branchId, contextKey, customerName, customerPhone, items, notes, tableId],
  );

  const submitOrder = async () => {
    if (items.length === 0) {
      setSubmitError('Cart is empty.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const fingerprint = JSON.stringify(normalizedPayload);
      const existingAttempt = pendingRetryRef.current;
      const idempotencyKey =
        existingAttempt && existingAttempt.fingerprint === fingerprint
          ? existingAttempt.key
          : createSubmitAttemptId();

      pendingRetryRef.current = { fingerprint, key: idempotencyKey };

      const response = await publicOrderingApi.submitOrder({
        ...normalizedPayload,
        idempotencyKey,
      });

      pendingRetryRef.current = null;
      clear();
      navigate(appendContext('/order-submitted'), { state: response });
    } catch (err) {
      setSubmitError(toErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="public-shell">
      <header className="public-header">
        <h1>Your Cart</h1>
        <p className="muted">Review items and submit your self-order.</p>
      </header>

      <div className="menu-stack">
        <section className="card">
          {items.length === 0 ? <p className="muted">Cart is empty.</p> : null}
          {items.map((item) => (
            <CartItemRow key={item.id} item={item} onRemove={() => removeItem(item.id)} />
          ))}
          <div className="row-between total-row">
            <strong>Total</strong>
            <strong>{formatCurrency(subtotal)}</strong>
          </div>
        </section>

        <section className="card form-grid">
          <h2>Customer Details (Optional)</h2>
          <label>
            Name
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Customer name"
            />
          </label>
          <label>
            Phone
            <input
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              placeholder="+90..."
            />
          </label>
          <label>
            Order Note
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional note" />
          </label>
          {submitError ? <p className="error">{submitError}</p> : null}
          <div className="row-between">
            <Link to={appendContext('/menu')} className="ghost link-button">
              Back to Menu
            </Link>
            <button type="button" disabled={items.length === 0 || isSubmitting} onClick={submitOrder}>
              {isSubmitting ? 'Submitting...' : 'Submit Order'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function createSubmitAttemptId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
