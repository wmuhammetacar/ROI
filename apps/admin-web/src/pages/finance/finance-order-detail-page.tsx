import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { financeOrdersApi, financePaymentsApi } from '../../api';
import type { OrderPaymentsResponse, OrderSummary, PaymentTransaction, Refund } from '../../api/finance-types';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, Modal, PageHeader, SectionCard } from '../../components';
import { formatCurrency } from '@roi/shared-utils';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatAmount(value?: string | number | null) {
  if (value === null || value === undefined) return '—';
  return formatCurrency(Number(value));
}

function getPaymentRefundedTotal(payment: PaymentTransaction) {
  const refunds = payment.refunds ?? [];
  return refunds.reduce((acc, refund) => acc + Number(refund.amount), 0);
}

function canVoidPayment(payment: PaymentTransaction) {
  return payment.status === 'COMPLETED' && (payment.refunds?.length ?? 0) === 0;
}

function canRefundPayment(payment: PaymentTransaction) {
  return payment.status === 'COMPLETED' || payment.status === 'REFUNDED_PARTIAL';
}

export function FinanceOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [paymentsResponse, setPaymentsResponse] = useState<OrderPaymentsResponse | null>(null);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentTransaction | null>(null);
  const [isVoidOpen, setIsVoidOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadOrder = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    try {
      const [orderData, paymentsData, refundsData] = await Promise.all([
        financeOrdersApi.getById(id),
        financeOrdersApi.getPayments(id),
        financeOrdersApi.getRefunds(id),
      ]);
      setOrder(orderData);
      setPaymentsResponse(paymentsData);
      setRefunds(refundsData);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadOrder();
  }, [id]);

  const financial = paymentsResponse?.financial;
  const payments = paymentsResponse?.payments ?? [];

  const openVoidModal = (payment: PaymentTransaction) => {
    setSelectedPayment(payment);
    setVoidReason('');
    setActionError(null);
    setIsVoidOpen(true);
  };

  const openRefundModal = (payment: PaymentTransaction) => {
    setSelectedPayment(payment);
    const available = Math.max(0, Number(payment.amount) - getPaymentRefundedTotal(payment));
    setRefundAmount(available);
    setRefundReason('');
    setActionError(null);
    setIsRefundOpen(true);
  };

  const closeActionModal = () => {
    if (!isSubmitting) {
      setIsVoidOpen(false);
      setIsRefundOpen(false);
    }
  };

  const submitVoid = async () => {
    if (!selectedPayment) return;
    setIsSubmitting(true);
    setActionError(null);

    try {
      await financePaymentsApi.voidPayment(selectedPayment.id, {
        reason: voidReason.trim() || undefined,
      });
      setIsVoidOpen(false);
      await loadOrder();
    } catch (err) {
      setActionError(toErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitRefund = async () => {
    if (!selectedPayment) return;
    setIsSubmitting(true);
    setActionError(null);

    try {
      await financePaymentsApi.createRefund(selectedPayment.id, {
        amount: Number(refundAmount),
        reason: refundReason.trim(),
      });
      setIsRefundOpen(false);
      await loadOrder();
    } catch (err) {
      setActionError(toErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const outstandingBalance = useMemo(() => financial?.outstandingBalance ?? '0', [financial]);
  const refundReasonValid = refundReason.trim().length >= 2;
  const refundAmountValid = refundAmount > 0;

  return (
    <div className="catalog-content">
      <PageHeader
        title="Order Finance Detail"
        description="Review payment history, refunds, and settlement status for a single order."
        actions={
          <>
            <button type="button" className="secondary" onClick={() => navigate('/finance/orders')}>
              Back to Orders
            </button>
            <button type="button" className="secondary" onClick={loadOrder}>
              Refresh
            </button>
          </>
        }
      />

      <DataState
        isLoading={isLoading}
        error={error}
        empty={!isLoading && !order}
        emptyMessage="Order not found."
      />

      {!isLoading && order ? (
        <>
          <SectionCard title="Order Overview" subtitle={`Order ID: ${order.id}`}>
            <div className="detail-grid">
              <div>
                <p className="muted">Order Number</p>
                <strong>{order.orderNumber ?? order.id.slice(0, 8)}</strong>
              </div>
              <div>
                <p className="muted">Status</p>
                <strong>{order.status}</strong>
              </div>
              <div>
                <p className="muted">Service Type</p>
                <strong>{order.serviceType ?? '—'}</strong>
              </div>
              <div>
                <p className="muted">Grand Total</p>
                <strong>{formatAmount(order.grandTotal)}</strong>
              </div>
              <div>
                <p className="muted">Billed At</p>
                <strong>{formatDate(order.billedAt)}</strong>
              </div>
              <div>
                <p className="muted">Paid At</p>
                <strong>{formatDate(order.paidAt)}</strong>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Financial Snapshot" subtitle="Computed from completed payments and refunds.">
            {financial ? (
              <div className="detail-grid">
                <div>
                  <p className="muted">Grand Total</p>
                  <strong>{formatAmount(financial.grandTotal)}</strong>
                </div>
                <div>
                  <p className="muted">Paid Gross</p>
                  <strong>{formatAmount(financial.paidGrossTotal)}</strong>
                </div>
                <div>
                  <p className="muted">Refunded</p>
                  <strong>{formatAmount(financial.refundedTotal)}</strong>
                </div>
                <div>
                  <p className="muted">Net Paid</p>
                  <strong>{formatAmount(financial.netPaidTotal)}</strong>
                </div>
                <div>
                  <p className="muted">Outstanding</p>
                  <strong>{formatAmount(outstandingBalance)}</strong>
                </div>
              </div>
            ) : (
              <p className="muted">Financial data is not available yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Payments" subtitle="Recorded payment transactions and status.">
            <DataState
              isLoading={false}
              error={null}
              empty={payments.length === 0}
              emptyMessage="No payments recorded for this order."
            />
            {payments.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Payment</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Refunded</th>
                      <th>Shift</th>
                      <th>Created</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.id.slice(0, 8)}</td>
                        <td>{payment.paymentMethod}</td>
                        <td>{payment.status}</td>
                        <td>{formatAmount(payment.amount)}</td>
                        <td>{formatAmount(getPaymentRefundedTotal(payment))}</td>
                        <td>{payment.registerShift?.id ? payment.registerShift.id.slice(0, 6) : payment.registerShiftId}</td>
                        <td>{formatDate(payment.createdAt)}</td>
                        <td className="table-actions">
                          {canVoidPayment(payment) ? (
                            <button type="button" className="secondary" onClick={() => openVoidModal(payment)}>
                              Void
                            </button>
                          ) : null}
                          {canRefundPayment(payment) ? (
                            <button type="button" className="secondary" onClick={() => openRefundModal(payment)}>
                              Refund
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Refunds" subtitle="All refunds logged for this order.">
            <DataState
              isLoading={false}
              error={null}
              empty={refunds.length === 0}
              emptyMessage="No refunds recorded for this order."
            />
            {refunds.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Refund</th>
                      <th>Payment</th>
                      <th>Method</th>
                      <th>Amount</th>
                      <th>Reason</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refunds.map((refund) => (
                      <tr key={refund.id}>
                        <td>{refund.id.slice(0, 8)}</td>
                        <td>{refund.paymentTransactionId?.slice(0, 8)}</td>
                        <td>{refund.paymentTransaction?.paymentMethod ?? '—'}</td>
                        <td>{formatAmount(refund.amount)}</td>
                        <td>{refund.reason}</td>
                        <td>{formatDate(refund.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </SectionCard>
        </>
      ) : null}

      {isVoidOpen && selectedPayment ? (
        <Modal title={`Void Payment ${selectedPayment.id.slice(0, 8)}`} onClose={closeActionModal}>
          <div className="form-grid">
            <p className="muted">This will void the payment transaction and recompute order totals.</p>
            <label>
              Reason (optional)
              <textarea value={voidReason} onChange={(event) => setVoidReason(event.target.value)} />
            </label>
            {actionError ? <p className="error">{actionError}</p> : null}
            <div className="form-actions">
              <button type="button" className="secondary" onClick={closeActionModal} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="button" className="danger" onClick={submitVoid} disabled={isSubmitting}>
                {isSubmitting ? 'Voiding...' : 'Void Payment'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {isRefundOpen && selectedPayment ? (
        <Modal title={`Refund Payment ${selectedPayment.id.slice(0, 8)}`} onClose={closeActionModal}>
          <div className="form-grid">
            <label>
              Amount
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={refundAmount}
                onChange={(event) => setRefundAmount(Number(event.target.value))}
              />
            </label>
            <p className="muted">
              Refundable amount: {formatAmount(Math.max(0, Number(selectedPayment.amount) - getPaymentRefundedTotal(selectedPayment)))}.
            </p>
            <label>
              Reason
              <textarea value={refundReason} onChange={(event) => setRefundReason(event.target.value)} />
            </label>
            {actionError ? <p className="error">{actionError}</p> : null}
            <div className="form-actions">
              <button type="button" className="secondary" onClick={closeActionModal} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="button" onClick={submitRefund} disabled={isSubmitting || !refundAmountValid || !refundReasonValid}>
                {isSubmitting ? 'Refunding...' : 'Create Refund'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
