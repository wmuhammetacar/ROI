import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { financeShiftsApi } from '../../api';
import type {
  RegisterShift,
  RegisterShiftOrdersResponse,
  RegisterShiftSummaryResponse,
  RegisterShiftPaymentsListItem,
} from '../../api/finance-types';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, PageHeader, SectionCard, StatusBadge } from '../../components';
import { formatCurrency } from '@roi/shared-utils';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatAmount(value?: string | null) {
  if (!value) return '—';
  return formatCurrency(Number(value));
}

function formatOrderId(order?: { id: string; orderNumber?: string }) {
  if (!order) return '—';
  return order.orderNumber ? `${order.orderNumber} (${order.id.slice(0, 6)})` : order.id.slice(0, 8);
}

export function FinanceShiftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [shift, setShift] = useState<RegisterShift | null>(null);
  const [summary, setSummary] = useState<RegisterShiftSummaryResponse | null>(null);
  const [payments, setPayments] = useState<RegisterShiftPaymentsListItem[]>([]);
  const [orders, setOrders] = useState<RegisterShiftOrdersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadShift = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    try {
      const [shiftData, summaryData, paymentsData, ordersData] = await Promise.all([
        financeShiftsApi.getById(id),
        financeShiftsApi.getSummary(id),
        financeShiftsApi.getPayments(id),
        financeShiftsApi.getOrders(id),
      ]);
      setShift(shiftData);
      setSummary(summaryData);
      setPayments(paymentsData);
      setOrders(ordersData);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadShift();
  }, [id]);

  const totalsByMethod = useMemo(() => summary?.summary.totalsByPaymentMethod ?? [], [summary]);

  return (
    <div className="catalog-content">
      <PageHeader
        title="Shift Detail"
        description="Audit the shift timeline, payment totals, and order settlement."
        actions={
          <>
            <button type="button" className="secondary" onClick={() => navigate('/finance/shifts')}>
              Back to Shifts
            </button>
            <button type="button" className="secondary" onClick={loadShift}>
              Refresh
            </button>
          </>
        }
      />

      <DataState
        isLoading={isLoading}
        error={error}
        empty={!isLoading && !shift}
        emptyMessage="Shift not found."
      />

      {!isLoading && shift ? (
        <>
          <SectionCard title="Shift Overview" subtitle={`Shift ID: ${shift.id}`}>
            <div className="detail-grid">
              <div>
                <p className="muted">Status</p>
                <StatusBadge active={shift.status === 'OPEN'} activeLabel="Open" inactiveLabel="Closed" />
              </div>
              <div>
                <p className="muted">Opened At</p>
                <strong>{formatDate(shift.openedAt)}</strong>
              </div>
              <div>
                <p className="muted">Closed At</p>
                <strong>{formatDate(shift.closedAt)}</strong>
              </div>
              <div>
                <p className="muted">Opened By</p>
                <strong>{shift.openedByUser?.name ?? shift.openedByUserId}</strong>
                <p className="muted">{shift.openedByUser?.email}</p>
              </div>
              <div>
                <p className="muted">Closed By</p>
                <strong>{shift.closedByUser?.name ?? shift.closedByUserId ?? '—'}</strong>
                <p className="muted">{shift.closedByUser?.email ?? ''}</p>
              </div>
              <div>
                <p className="muted">Opening Cash</p>
                <strong>{formatAmount(shift.openingCashAmount)}</strong>
              </div>
              <div>
                <p className="muted">Expected Closing Cash</p>
                <strong>{formatAmount(shift.closingCashAmountExpected)}</strong>
              </div>
              <div>
                <p className="muted">Actual Closing Cash</p>
                <strong>{formatAmount(shift.closingCashAmountActual)}</strong>
              </div>
              <div>
                <p className="muted">Variance</p>
                <strong>{formatAmount(shift.varianceAmount)}</strong>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Shift Summary" subtitle="Totals derived from recorded payments and refunds.">
            {summary ? (
              <div className="detail-grid">
                <div>
                  <p className="muted">Settled Orders</p>
                  <strong>{summary.summary.settledOrderCount}</strong>
                </div>
                <div>
                  <p className="muted">Paid Orders</p>
                  <strong>{summary.summary.paidOrderCount}</strong>
                </div>
                <div>
                  <p className="muted">Paid Order Total</p>
                  <strong>{formatAmount(summary.summary.paidOrderTotal)}</strong>
                </div>
                <div>
                  <p className="muted">Gross Paid</p>
                  <strong>{formatAmount(summary.summary.grossPaidTotal)}</strong>
                </div>
                <div>
                  <p className="muted">Refunded</p>
                  <strong>{formatAmount(summary.summary.refundedTotal)}</strong>
                </div>
                <div>
                  <p className="muted">Net Paid</p>
                  <strong>{formatAmount(summary.summary.netPaidTotal)}</strong>
                </div>
                <div>
                  <p className="muted">Expected Cash</p>
                  <strong>{formatAmount(summary.summary.expectedCashAmount)}</strong>
                </div>
              </div>
            ) : (
              <p className="muted">Summary not available.</p>
            )}

            {totalsByMethod.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>Gross</th>
                      <th>Refunded</th>
                      <th>Net</th>
                      <th>Transactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totalsByMethod.map((row) => (
                      <tr key={row.paymentMethod}>
                        <td>{row.paymentMethod}</td>
                        <td>{formatAmount(row.gross)}</td>
                        <td>{formatAmount(row.refunded)}</td>
                        <td>{formatAmount(row.net)}</td>
                        <td>{row.transactionCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Payments" subtitle="All payments registered under this shift.">
            <DataState
              isLoading={false}
              error={null}
              empty={payments.length === 0}
              emptyMessage="No payments recorded for this shift."
            />
            {payments.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Payment</th>
                      <th>Order</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Reference</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.id.slice(0, 8)}</td>
                        <td>{formatOrderId(payment.order)}</td>
                        <td>{payment.paymentMethod}</td>
                        <td>{payment.status}</td>
                        <td>{formatAmount(payment.amount)}</td>
                        <td>{payment.referenceNo ?? '—'}</td>
                        <td>{formatDate(payment.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Orders" subtitle="Orders settled during this shift.">
            <DataState
              isLoading={false}
              error={null}
              empty={!orders || orders.orderCount === 0}
              emptyMessage="No orders settled in this shift."
            />
            {orders && orders.orderCount > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Status</th>
                      <th>Service</th>
                      <th>Grand Total</th>
                      <th>Paid Gross</th>
                      <th>Refunded</th>
                      <th>Net Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.orders.map((order) => (
                      <tr key={order.orderId}>
                        <td>{order.orderNumber}</td>
                        <td>{order.orderStatus}</td>
                        <td>{order.serviceType}</td>
                        <td>{formatAmount(order.grandTotal)}</td>
                        <td>{formatAmount(order.paidGrossInShift)}</td>
                        <td>{formatAmount(order.refundedInShift)}</td>
                        <td>{formatAmount(order.netPaidInShift)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
