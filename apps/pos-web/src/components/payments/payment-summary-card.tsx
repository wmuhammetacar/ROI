import type { Order, OrderPaymentsResponse } from '../../api';
import { StatusBadge } from '../status-badge';
import { AmountBadge } from './amount-badge';
import { formatDateTime } from './format';

interface PaymentSummaryCardProps {
  order: Order;
  payments: OrderPaymentsResponse | null;
}

export function PaymentSummaryCard({ order, payments }: PaymentSummaryCardProps) {
  const total = Number(payments?.financial.grandTotal ?? order.grandTotal ?? 0);
  const paid = Number(payments?.financial.netPaidTotal ?? 0);
  const outstanding = Number(payments?.financial.outstandingBalance ?? total);

  return (
    <div className="payment-summary">
      <div className="summary-row">
        <div>
          <strong>Order {order.orderNumber ?? order.id.slice(0, 8)}</strong>
          <div className="muted">Order ID: {order.id}</div>
        </div>
        <StatusBadge value={order.status} />
      </div>

      <div className="summary-grid">
        <AmountBadge label="Grand total" amount={total} />
        <AmountBadge label="Paid" amount={paid} tone="good" />
        <AmountBadge label="Outstanding" amount={outstanding} tone={outstanding > 0 ? 'warning' : 'good'} />
        <div className="amount-badge">
          <span className="muted">Billed at</span>
          <strong>{formatDateTime(payments?.billedAt ?? order.billedAt)}</strong>
        </div>
        <div className="amount-badge">
          <span className="muted">Paid at</span>
          <strong>{formatDateTime(payments?.paidAt ?? order.paidAt)}</strong>
        </div>
      </div>
    </div>
  );
}
