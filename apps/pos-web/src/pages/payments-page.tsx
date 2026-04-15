import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Order, OrderPaymentsResponse, PaymentMethod, Refund, RegisterShift } from '../api';
import { orderFinanceApi, orderPaymentsApi, registerShiftsApi } from '../api';
import { useSession } from '../app/session-context';
import {
  DataState,
  PaymentFormCard,
  PaymentHistoryList,
  PaymentSummaryCard,
  RefundHistoryList,
  ShiftStatusBanner,
  formatMoney,
} from '../components';
import { POS_REALTIME_EVENTS, usePosBranchRealtime } from '../realtime';

const PAYABLE_STATUSES = new Set(['READY', 'SERVED', 'BILLED', 'PAID']);
const BILLABLE_STATUSES = new Set(['READY', 'SERVED']);

interface PaymentFormValues {
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNo: string;
  notes: string;
}

const DEFAULT_FORM_VALUES: PaymentFormValues = {
  amount: 0,
  paymentMethod: 'CASH',
  referenceNo: '',
  notes: '',
};

export function PaymentsPage() {
  const { user } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryOrderId = searchParams.get('orderId')?.trim() ?? '';

  const [orderIdInput, setOrderIdInput] = useState(queryOrderId);

  const [order, setOrder] = useState<Order | null>(null);
  const [payments, setPayments] = useState<OrderPaymentsResponse | null>(null);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [shift, setShift] = useState<RegisterShift | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBilling, setIsBilling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<PaymentFormValues>(DEFAULT_FORM_VALUES);

  useEffect(() => {
    setOrderIdInput(queryOrderId);
  }, [queryOrderId]);

  const loadShift = useCallback(async () => {
    try {
      const shiftData = await registerShiftsApi.getCurrentOpen();
      setShift(shiftData);
    } catch {
      setShift(null);
    }
  }, []);

  const loadOrderContext = useCallback(async (orderId: string) => {
    if (!orderId) return;
    setIsLoading(true);
    setError(null);

    try {
      const context = await orderFinanceApi.getOrderFinanceContext(orderId);
      setOrder(context.order);
      setPayments(context.payments);
      setRefunds(context.refunds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order finance context.');
      setOrder(null);
      setPayments(null);
      setRefunds([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    if (!queryOrderId) return;
    await Promise.all([loadShift(), loadOrderContext(queryOrderId)]);
  }, [loadOrderContext, loadShift, queryOrderId]);

  useEffect(() => {
    void loadShift();
  }, [loadShift]);

  useEffect(() => {
    if (!queryOrderId) {
      setOrder(null);
      setPayments(null);
      setRefunds([]);
      return;
    }

    void loadOrderContext(queryOrderId);
  }, [loadOrderContext, queryOrderId]);

  const outstanding = Number(payments?.financial.outstandingBalance ?? 0);
  const isPayable = order ? PAYABLE_STATUSES.has(order.status) : false;
  const isBillable = order ? BILLABLE_STATUSES.has(order.status) : false;
  const isFullyPaid = order?.status === 'PAID' || (payments && Number(payments.financial.outstandingBalance) === 0);

  useEffect(() => {
    if (!payments) return;
    const numeric = Number(payments.financial.outstandingBalance);
    if (!Number.isNaN(numeric)) {
      setForm((prev) => ({ ...prev, amount: numeric }));
    }
  }, [payments]);

  const paymentBlockedReason = useMemo(() => {
    if (!order) return 'Load an order first.';
    if (!isPayable) return 'Order is not payable in its current status.';
    if (!shift) return 'Open register shift is required.';
    if (isSubmitting) return 'Payment is being submitted.';
    if (outstanding <= 0) return 'Order is already fully paid.';
    if (Number.isNaN(form.amount) || form.amount <= 0) return 'Amount must be greater than zero.';
    if (form.amount > outstanding) return 'Amount cannot exceed outstanding balance.';
    return null;
  }, [form.amount, isPayable, isSubmitting, order, outstanding, shift]);

  const canSubmitPayment = paymentBlockedReason === null;

  const realtimeHandlers = useMemo(
    () => ({
      [POS_REALTIME_EVENTS.PAYMENT_RECORDED]: (event: { payload: Record<string, unknown> }) => {
        const payloadOrderId =
          typeof event.payload.orderId === 'string' ? event.payload.orderId : null;
        if (queryOrderId && payloadOrderId === queryOrderId) {
          void refreshAll();
        }
      },
      [POS_REALTIME_EVENTS.ORDER_STATUS_CHANGED]: (event: { payload: Record<string, unknown> }) => {
        const payloadOrderId =
          typeof event.payload.orderId === 'string' ? event.payload.orderId : null;
        if (queryOrderId && payloadOrderId === queryOrderId) {
          void refreshAll();
        }
      },
      [POS_REALTIME_EVENTS.ORDER_PAID]: (event: { payload: Record<string, unknown> }) => {
        const payloadOrderId =
          typeof event.payload.orderId === 'string' ? event.payload.orderId : null;
        if (queryOrderId && payloadOrderId === queryOrderId) {
          void refreshAll();
        }
      },
    }),
    [queryOrderId, refreshAll],
  );

  usePosBranchRealtime(user?.branchId, realtimeHandlers);

  const handleSearch = useCallback(() => {
    const value = orderIdInput.trim();
    if (!value) return;
    setActionError(null);
    setActionSuccess(null);
    setSearchParams({ orderId: value });
  }, [orderIdInput, setSearchParams]);

  const handleBillOrder = useCallback(async () => {
    if (!order) return;
    setIsBilling(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await orderPaymentsApi.billOrder(order.id);
      setActionSuccess('Order billed successfully.');
      await refreshAll();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to bill order.');
    } finally {
      setIsBilling(false);
    }
  }, [order, refreshAll]);

  const handleSubmitPayment = useCallback(async () => {
    if (!order || !shift || !canSubmitPayment) return;

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await orderPaymentsApi.createPayment(order.id, {
        registerShiftId: shift.id,
        paymentMethod: form.paymentMethod,
        amount: Number(form.amount),
        referenceNo: form.referenceNo.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });

      setActionSuccess(`Payment recorded. Remaining: ${formatMoney(Math.max(outstanding - form.amount, 0))}`);
      setForm((prev) => ({ ...prev, referenceNo: '', notes: '' }));
      await refreshAll();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create payment.');
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmitPayment, form, order, outstanding, refreshAll, shift]);

  return (
    <div className="payments-layout">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h1>Payments</h1>
            <p className="muted">Bill orders, take mixed payments, and track settlement.</p>
          </div>
          <button type="button" className="ghost" onClick={refreshAll}>
            Refresh
          </button>
        </div>

        <div className="form-grid payment-order-search">
          <label className="field">
            <span>Order ID</span>
            <input
              value={orderIdInput}
              onChange={(event) => setOrderIdInput(event.target.value)}
              placeholder="Paste order id"
            />
          </label>

          <div className="stack-row payment-order-actions">
            <button type="button" className="primary touch-button" onClick={handleSearch}>
              Load Order
            </button>
            <Link to="/order-entry" className="ghost touch-button">
              Back to Order Entry
            </Link>
          </div>
        </div>

        <DataState
          isLoading={isLoading}
          error={error}
          empty={!isLoading && !error && !order}
          emptyMessage="Load an order to start billing/payment workflow."
        />

        {order ? <PaymentSummaryCard order={order} payments={payments} /> : null}

        {order && !isPayable ? (
          <p className="muted">This order cannot be paid yet. Move it to READY, SERVED, or BILLED first.</p>
        ) : null}

        {order && isBillable ? (
          <button type="button" className="ghost touch-button" onClick={handleBillOrder} disabled={isBilling}>
            {isBilling ? 'Billing...' : 'Bill Order'}
          </button>
        ) : null}

        {isFullyPaid ? <p className="success">Order is fully paid. You can review transaction history below.</p> : null}

        <ShiftStatusBanner shift={shift} />

        {actionError ? <p className="error">{actionError}</p> : null}
        {actionSuccess ? <p className="success">{actionSuccess}</p> : null}

        {order ? (
          <PaymentFormCard
            form={form}
            outstanding={outstanding}
            isSubmitting={isSubmitting}
            isDisabled={!canSubmitPayment}
            onChange={setForm}
            onSubmit={handleSubmitPayment}
          />
        ) : null}

        {!canSubmitPayment && order ? <p className="muted">Payment blocked: {paymentBlockedReason}</p> : null}
      </section>

      <section className="panel">
        <h2>Payment History</h2>
        <PaymentHistoryList payments={payments?.payments ?? []} />

        <h2>Refund History</h2>
        <RefundHistoryList refunds={refunds} />
      </section>
    </div>
  );
}
