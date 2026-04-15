import type { PaymentMethod } from '../../api';

interface PaymentFormState {
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNo: string;
  notes: string;
}

interface PaymentFormCardProps {
  form: PaymentFormState;
  outstanding: number;
  isDisabled: boolean;
  isSubmitting: boolean;
  submitLabel?: string;
  onChange: (next: PaymentFormState) => void;
  onSubmit: () => void;
}

export function PaymentFormCard({
  form,
  outstanding,
  isDisabled,
  isSubmitting,
  submitLabel = 'Record Payment',
  onChange,
  onSubmit,
}: PaymentFormCardProps) {
  return (
    <div className="panel">
      <h2>Record payment</h2>
      <p className="muted">Remaining balance: {outstanding.toFixed(2)}</p>
      <div className="form-grid">
        <label className="field">
          <span>Amount</span>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={form.amount}
            onChange={(event) => onChange({ ...form, amount: Number(event.target.value) })}
          />
        </label>

        <label className="field">
          <span>Payment method</span>
          <select
            value={form.paymentMethod}
            onChange={(event) => onChange({ ...form, paymentMethod: event.target.value as PaymentMethod })}
          >
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="OTHER">Other</option>
          </select>
        </label>

        <label className="field">
          <span>Reference no (optional)</span>
          <input
            value={form.referenceNo}
            onChange={(event) => onChange({ ...form, referenceNo: event.target.value })}
            placeholder="Receipt number, card slip, EFT ref"
          />
        </label>

        <label className="field">
          <span>Notes (optional)</span>
          <textarea
            value={form.notes}
            onChange={(event) => onChange({ ...form, notes: event.target.value })}
            placeholder="Cashier note"
          />
        </label>
      </div>

      <button type="button" className="primary touch-button" onClick={onSubmit} disabled={isDisabled}>
        {isSubmitting ? 'Saving...' : submitLabel}
      </button>
    </div>
  );
}
