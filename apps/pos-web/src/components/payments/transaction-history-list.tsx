import type { PaymentTransaction, Refund } from '../../api';
import { StatusBadge } from '../status-badge';
import { formatDateTime, formatMoney } from './format';

interface PaymentHistoryListProps {
  payments: PaymentTransaction[];
}

export function PaymentHistoryList({ payments }: PaymentHistoryListProps) {
  if (payments.length === 0) {
    return <p className="muted">No payments recorded yet.</p>;
  }

  return (
    <div className="table-list">
      {payments.map((payment) => (
        <div key={payment.id} className="table-row">
          <div>
            <strong>{payment.paymentMethod}</strong>
            <div className="muted">{payment.id.slice(0, 8)} · {formatDateTime(payment.createdAt)}</div>
            {payment.referenceNo ? <div className="muted">Ref: {payment.referenceNo}</div> : null}
            {payment.notes ? <div className="muted">{payment.notes}</div> : null}
          </div>
          <div className="table-row-meta">
            <StatusBadge value={payment.status} />
            <strong>{formatMoney(payment.amount)}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

interface RefundHistoryListProps {
  refunds: Refund[];
}

export function RefundHistoryList({ refunds }: RefundHistoryListProps) {
  if (refunds.length === 0) {
    return <p className="muted">No refunds recorded.</p>;
  }

  return (
    <div className="table-list">
      {refunds.map((refund) => (
        <div key={refund.id} className="table-row">
          <div>
            <strong>Refund</strong>
            <div className="muted">{refund.id.slice(0, 8)} · {formatDateTime(refund.createdAt)}</div>
            <div className="muted">Reason: {refund.reason}</div>
          </div>
          <div className="table-row-meta">
            {refund.paymentTransaction ? <StatusBadge value={refund.paymentTransaction.status} /> : null}
            <strong>{formatMoney(refund.amount)}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}
