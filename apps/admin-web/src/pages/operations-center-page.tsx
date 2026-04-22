import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@roi/shared-utils';
import {
  operationsApi,
  operationsOrderActionsApi,
  printersApi,
  waiterCallsApi,
  type OperationsCatalogCategory,
  type OperationsOrder,
  type OperationsOrderPaymentsResponse,
  type OperationsOrderRefund,
  type OperationsPaymentMethod,
  type OperationsRegisterShift,
  type OperationsOverviewResponse,
  type OperationsOverviewTable,
  type WaiterCall,
} from '../api';
import { useBranchContext } from '../app/branch-context';
import { toErrorMessage } from '../app/error-utils';
import { ADMIN_REALTIME_EVENTS, useAdminBranchRealtime } from '../realtime';
import { BranchScopeBanner, DataState, Modal, PageHeader, StatusBadge } from '../components';

const EDITABLE_ORDER_STATUSES = new Set(['DRAFT', 'PLACED']);
const PAYABLE_ORDER_STATUSES = new Set(['READY', 'SERVED', 'BILLED', 'PAID']);
const BILLABLE_ORDER_STATUSES = new Set(['READY', 'SERVED', 'BILLED', 'PAID']);
const CASHIER_PAYMENT_METHODS: OperationsPaymentMethod[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'OTHER'];

function formatMoney(value: number | string | null | undefined) {
  return formatCurrency(Number(value ?? 0));
}

function formatElapsed(openedAt?: string | null) {
  if (!openedAt) return '—';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(openedAt).getTime()) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}s ${m}d` : `${m}d`;
}

function getActiveOrder(orders: OperationsOrder[]) {
  return orders.find((order) => order.status !== 'CANCELLED' && order.status !== 'PAID') ?? orders[0] ?? null;
}

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

export function OperationsCenterPage() {
  const navigate = useNavigate();
  const { effectiveBranchId } = useBranchContext();

  const [overview, setOverview] = useState<OperationsOverviewResponse | null>(null);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedTable, setSelectedTable] = useState<OperationsOverviewTable | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [tableDetailOrder, setTableDetailOrder] = useState<OperationsOrder | null>(null);
  const [orderPayments, setOrderPayments] = useState<OperationsOrderPaymentsResponse | null>(null);
  const [orderRefunds, setOrderRefunds] = useState<OperationsOrderRefund[]>([]);
  const [openShift, setOpenShift] = useState<OperationsRegisterShift | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [cashierError, setCashierError] = useState<string | null>(null);
  const [cashierInfo, setCashierInfo] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<OperationsCatalogCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [productSubmitPending, setProductSubmitPending] = useState(false);
  const [sendPending, setSendPending] = useState(false);
  const [billPending, setBillPending] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const [closeSessionPending, setCloseSessionPending] = useState(false);
  const [printPending, setPrintPending] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<OperationsPaymentMethod>('CASH');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReferenceNo, setPaymentReferenceNo] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const [openSessionTableId, setOpenSessionTableId] = useState<string>('');
  const [openSessionGuests, setOpenSessionGuests] = useState(2);

  const [callTableId, setCallTableId] = useState<string>('');
  const [callNote, setCallNote] = useState('');
  const [callPending, setCallPending] = useState(false);

  const loadOverview = useCallback(async () => {
    const [overviewRes, waiterCallsRes] = await Promise.all([
      operationsApi.getOverview(effectiveBranchId ?? undefined, 160),
      waiterCallsApi.list(effectiveBranchId ?? undefined),
    ]);
    setOverview(overviewRes);
    setWaiterCalls(waiterCallsRes);

    if (!openSessionTableId && overviewRes.tables.length > 0) {
      setOpenSessionTableId(overviewRes.tables[0].id);
    }
    if (!callTableId && overviewRes.tables.length > 0) {
      setCallTableId(overviewRes.tables[0].id);
    }
  }, [callTableId, effectiveBranchId, openSessionTableId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadOverview();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [loadOverview]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const loadCashierData = useCallback(
    async (orderId: string) => {
      const [paymentsResponse, refundsResponse, openShiftResponse] = await Promise.all([
        operationsOrderActionsApi.getOrderPayments(orderId, effectiveBranchId ?? undefined),
        operationsOrderActionsApi.getOrderRefunds(orderId, effectiveBranchId ?? undefined),
        operationsOrderActionsApi.getOpenShift(effectiveBranchId ?? undefined),
      ]);
      setOrderPayments(paymentsResponse);
      setOrderRefunds(refundsResponse);
      setOpenShift(openShiftResponse);
      const outstanding = toNumber(paymentsResponse.financial.outstandingBalance);
      if (outstanding > 0) {
        setPaymentAmount(outstanding.toFixed(2));
      } else {
        setPaymentAmount('');
      }
    },
    [effectiveBranchId],
  );

  const loadTableDetail = useCallback(
    async (table: OperationsOverviewTable) => {
      setSelectedTable(table);
      setDetailLoading(true);
      setDetailError(null);
      setCashierError(null);
      setCashierInfo(null);
      setTableDetailOrder(null);
      setOrderPayments(null);
      setOrderRefunds([]);
      setOpenShift(null);
      setActiveSessionId(table.openSessionId ?? null);

      try {
        let sessionId = table.openSessionId;
        if (!sessionId) {
          const session = await operationsOrderActionsApi.getOpenSessionByTable(table.id);
          sessionId = session?.id ?? null;
        }

        setActiveSessionId(sessionId ?? null);

        if (!sessionId) {
          setTableDetailOrder(null);
          return;
        }

        const orderList = await operationsOrderActionsApi.listOrdersByTableSession(
          sessionId,
          effectiveBranchId ?? undefined,
        );
        const active = getActiveOrder(orderList);

        if (active) {
          const fullOrder = await operationsOrderActionsApi.getOrderById(active.id, effectiveBranchId ?? undefined);
          setTableDetailOrder(fullOrder);
          await loadCashierData(fullOrder.id);
        }

        const routeSafeCatalog = await operationsOrderActionsApi.getRouteSafeCatalog(effectiveBranchId ?? undefined);
        setCatalog(routeSafeCatalog.categories ?? []);
        if (!selectedCategoryId && (routeSafeCatalog.categories?.length ?? 0) > 0) {
          setSelectedCategoryId(routeSafeCatalog.categories[0].id);
        }
      } catch (err) {
        setDetailError(toErrorMessage(err));
      } finally {
        setDetailLoading(false);
      }
    },
    [effectiveBranchId, loadCashierData, selectedCategoryId],
  );

  const resolveOrder = useCallback(async () => {
    if (!selectedTable) return null;
    if (tableDetailOrder) return tableDetailOrder;

    const session = await operationsOrderActionsApi.getOpenSessionByTable(selectedTable.id);
    if (!session) {
      throw new Error('No OPEN session found for table. Open a session before creating order.');
    }
    setActiveSessionId(session.id);
    const created = await operationsOrderActionsApi.createOrder({
      serviceType: 'DINE_IN',
      tableSessionId: session.id,
    });
    const full = await operationsOrderActionsApi.getOrderById(created.id, effectiveBranchId ?? undefined);
    setTableDetailOrder(full);
    return full;
  }, [effectiveBranchId, selectedTable, tableDetailOrder]);

  const selectedCategory = useMemo(
    () => catalog.find((category) => category.id === selectedCategoryId) ?? catalog[0],
    [catalog, selectedCategoryId],
  );

  const products = useMemo(() => {
    return (selectedCategory?.products ?? []).filter((product) => product.isActive && product.isAvailable);
  }, [selectedCategory]);

  const addSimpleCatalogItem = useCallback(
    async (productId: string) => {
      if (!selectedTable) return;
      setProductSubmitPending(true);
      setDetailError(null);
      try {
        const order = await resolveOrder();
        if (!order) return;
        if (!EDITABLE_ORDER_STATUSES.has(order.status)) {
          setDetailError('Order is not editable.');
          return;
        }
        await operationsOrderActionsApi.addCatalogItem(order.id, {
          productId,
          quantity: 1,
        });
        const refreshed = await operationsOrderActionsApi.getOrderById(order.id, effectiveBranchId ?? undefined);
        setTableDetailOrder(refreshed);
        await loadCashierData(order.id);
        await loadOverview();
      } catch (err) {
        setDetailError(toErrorMessage(err));
      } finally {
        setProductSubmitPending(false);
      }
    },
    [effectiveBranchId, loadCashierData, loadOverview, resolveOrder, selectedTable],
  );

  const changeQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      if (!tableDetailOrder) return;
      if (!EDITABLE_ORDER_STATUSES.has(tableDetailOrder.status)) return;
      try {
        if (quantity <= 0) {
          await operationsOrderActionsApi.removeItem(tableDetailOrder.id, itemId);
        } else {
          await operationsOrderActionsApi.updateCatalogItem(tableDetailOrder.id, itemId, { quantity });
        }
        const refreshed = await operationsOrderActionsApi.getOrderById(
          tableDetailOrder.id,
          effectiveBranchId ?? undefined,
        );
        setTableDetailOrder(refreshed);
        await loadCashierData(tableDetailOrder.id);
        await loadOverview();
      } catch (err) {
        setDetailError(toErrorMessage(err));
      }
    },
    [effectiveBranchId, loadCashierData, loadOverview, tableDetailOrder],
  );

  const sendOrder = useCallback(async () => {
    if (!tableDetailOrder) return;
    setSendPending(true);
    setDetailError(null);
    try {
      await operationsOrderActionsApi.sendOrder(tableDetailOrder.id);
      const refreshed = await operationsOrderActionsApi.getOrderById(tableDetailOrder.id, effectiveBranchId ?? undefined);
      setTableDetailOrder(refreshed);
      await loadCashierData(tableDetailOrder.id);
      await loadOverview();
    } catch (err) {
      setDetailError(toErrorMessage(err));
    } finally {
      setSendPending(false);
    }
  }, [effectiveBranchId, loadCashierData, loadOverview, tableDetailOrder]);

  const openSession = useCallback(async () => {
    if (!openSessionTableId) return;
    try {
      await operationsOrderActionsApi.openSession({
        tableId: openSessionTableId,
        guestCount: Math.max(1, openSessionGuests),
      });
      await loadOverview();
    } catch (err) {
      setError(toErrorMessage(err));
    }
  }, [loadOverview, openSessionGuests, openSessionTableId]);

  const createWaiterCall = useCallback(async () => {
    if (!callTableId) return;
    setCallPending(true);
    try {
      await waiterCallsApi.create({
        tableId: callTableId,
        note: callNote.trim() || undefined,
      });
      setCallNote('');
      await loadOverview();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setCallPending(false);
    }
  }, [callNote, callTableId, loadOverview]);

  const resolveWaiterCall = useCallback(
    async (id: string) => {
      try {
        await waiterCallsApi.resolve(id);
        await loadOverview();
      } catch (err) {
        setError(toErrorMessage(err));
      }
    },
    [loadOverview],
  );

  const financial = orderPayments?.financial ?? null;
  const grandTotal = financial ? toNumber(financial.grandTotal) : toNumber(tableDetailOrder?.grandTotal);
  const paidGrossTotal = financial ? toNumber(financial.paidGrossTotal) : 0;
  const netPaidTotal = financial ? toNumber(financial.netPaidTotal) : 0;
  const refundedTotal = financial ? toNumber(financial.refundedTotal) : 0;
  const outstandingBalance = financial ? toNumber(financial.outstandingBalance) : grandTotal;
  const isFullyPaid = outstandingBalance <= 0.0001 || tableDetailOrder?.status === 'PAID';
  const canBillOrder = !!tableDetailOrder && BILLABLE_ORDER_STATUSES.has(tableDetailOrder.status);
  const canAcceptPayments =
    !!tableDetailOrder &&
    PAYABLE_ORDER_STATUSES.has(tableDetailOrder.status) &&
    !isFullyPaid &&
    !!openShift;
  const parsedPaymentAmount = Number(paymentAmount);
  const paymentAmountIsValid =
    Number.isFinite(parsedPaymentAmount) &&
    parsedPaymentAmount > 0 &&
    parsedPaymentAmount <= outstandingBalance;
  const canCloseSession = !!activeSessionId && isFullyPaid;

  const billOrder = useCallback(async () => {
    if (!tableDetailOrder) return;
    setBillPending(true);
    setCashierError(null);
    setCashierInfo(null);
    try {
      await operationsOrderActionsApi.billOrder(tableDetailOrder.id);
      const [refreshedOrder] = await Promise.all([
        operationsOrderActionsApi.getOrderById(tableDetailOrder.id, effectiveBranchId ?? undefined),
        loadCashierData(tableDetailOrder.id),
      ]);
      setTableDetailOrder(refreshedOrder);
      setCashierInfo('Order is now in billing flow.');
      await loadOverview();
    } catch (err) {
      setCashierError(toErrorMessage(err));
    } finally {
      setBillPending(false);
    }
  }, [effectiveBranchId, loadCashierData, loadOverview, tableDetailOrder]);

  const submitPayment = useCallback(async () => {
    if (!tableDetailOrder || !openShift) return;
    setPaymentPending(true);
    setCashierError(null);
    setCashierInfo(null);
    try {
      await operationsOrderActionsApi.createPayment(tableDetailOrder.id, {
        registerShiftId: openShift.id,
        paymentMethod,
        amount: parsedPaymentAmount,
        referenceNo: paymentReferenceNo.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      });
      const [refreshedOrder] = await Promise.all([
        operationsOrderActionsApi.getOrderById(tableDetailOrder.id, effectiveBranchId ?? undefined),
        loadCashierData(tableDetailOrder.id),
      ]);
      setTableDetailOrder(refreshedOrder);
      setPaymentReferenceNo('');
      setPaymentNotes('');
      setCashierInfo('Payment recorded successfully.');
      await loadOverview();
    } catch (err) {
      setCashierError(toErrorMessage(err));
    } finally {
      setPaymentPending(false);
    }
  }, [
    effectiveBranchId,
    loadCashierData,
    loadOverview,
    openShift,
    parsedPaymentAmount,
    paymentMethod,
    paymentNotes,
    paymentReferenceNo,
    tableDetailOrder,
  ]);

  const closeTableSession = useCallback(async () => {
    if (!activeSessionId) return;
    setCloseSessionPending(true);
    setCashierError(null);
    setCashierInfo(null);
    try {
      await operationsOrderActionsApi.closeSession(activeSessionId);
      setCashierInfo('Table session closed successfully.');
      await loadOverview();
      if (selectedTable) {
        await loadTableDetail(selectedTable);
      }
    } catch (err) {
      setCashierError(toErrorMessage(err));
    } finally {
      setCloseSessionPending(false);
    }
  }, [activeSessionId, loadOverview, loadTableDetail, selectedTable]);

  const triggerReceiptPrint = useCallback(async () => {
    if (!tableDetailOrder) return;
    setPrintPending(true);
    setCashierError(null);
    setCashierInfo(null);
    try {
      const printers = await printersApi.list(effectiveBranchId ?? undefined);
      const targetPrinter = printers.find((printer) => printer.isActive && printer.printerRole === 'CASH');
      if (!targetPrinter) {
        setCashierError('No active CASH printer configured for receipt print hook.');
        return;
      }
      await printersApi.test(targetPrinter.id);
      setCashierInfo(`Receipt print hook dispatched to ${targetPrinter.name}.`);
    } catch (err) {
      setCashierError(toErrorMessage(err));
    } finally {
      setPrintPending(false);
    }
  }, [effectiveBranchId, tableDetailOrder]);

  const refreshSelectedDetailIfOpen = useCallback(() => {
    if (selectedTable) {
      void loadTableDetail(selectedTable);
    }
  }, [loadTableDetail, selectedTable]);

  useAdminBranchRealtime(
    effectiveBranchId,
    useMemo(
      () => ({
        [ADMIN_REALTIME_EVENTS.ORDER_CREATED]: () => {
          void loadOverview();
          refreshSelectedDetailIfOpen();
        },
        [ADMIN_REALTIME_EVENTS.ORDER_UPDATED]: () => {
          void loadOverview();
          refreshSelectedDetailIfOpen();
        },
        [ADMIN_REALTIME_EVENTS.ORDER_SENT]: () => {
          void loadOverview();
          refreshSelectedDetailIfOpen();
        },
        [ADMIN_REALTIME_EVENTS.ORDER_STATUS_CHANGED]: () => {
          void loadOverview();
          refreshSelectedDetailIfOpen();
        },
        [ADMIN_REALTIME_EVENTS.PAYMENT_RECORDED]: () => {
          void loadOverview();
          refreshSelectedDetailIfOpen();
        },
        [ADMIN_REALTIME_EVENTS.ORDER_PAID]: () => {
          void loadOverview();
          refreshSelectedDetailIfOpen();
        },
        [ADMIN_REALTIME_EVENTS.PRODUCTION_ITEM_UPDATED]: () => {
          void loadOverview();
          refreshSelectedDetailIfOpen();
        },
        [ADMIN_REALTIME_EVENTS.TABLE_UPDATED]: () => {
          void loadOverview();
          refreshSelectedDetailIfOpen();
        },
        [ADMIN_REALTIME_EVENTS.WAITER_CALL_UPDATED]: () => {
          void loadOverview();
        },
      }),
      [loadOverview, refreshSelectedDetailIfOpen],
    ),
  );

  const tables = overview?.tables ?? [];
  const liveOrders = overview?.liveOrders ?? [];
  const pendingCalls = waiterCalls.filter((call) => call.status === 'PENDING');

  return (
    <div className="catalog-content">
      <PageHeader
        title="Operations Command Center"
        description="Live desktop control surface for tables, orders, production, and cashflow."
        actions={
          <button type="button" className="secondary" onClick={loadAll}>
            Refresh System
          </button>
        }
      />

      <BranchScopeBanner sectionLabel="Operations" />

      <DataState isLoading={loading} error={error} empty={!loading && !overview} emptyMessage="Operations data is unavailable." />

      {overview ? (
        <div className="ops-grid">
          <section className="page-card ops-panel ops-tables">
            <div className="ops-panel-header">
              <h2>Tables</h2>
              <strong>{tables.length}</strong>
            </div>
            <div className="ops-table-list">
              {tables.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  className={`ops-table-row ${table.status === 'AVAILABLE' ? 'available' : 'occupied'}`}
                  onClick={() => void loadTableDetail(table)}
                >
                  <div>
                    <strong>{table.name}</strong>
                    <div className="muted">{table.floor?.name ?? 'Floor'}</div>
                  </div>
                  <div className="ops-table-metrics">
                    <span>{formatMoney(table.currentTotal)}</span>
                    <span>{table.itemCount} items</span>
                    <span>{formatElapsed(table.openedAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="page-card ops-panel ops-orders">
            <div className="ops-panel-header">
              <h2>Live Orders</h2>
              <strong>{liveOrders.length}</strong>
            </div>
            <div className="ops-order-list">
              {liveOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  className="ops-order-row"
                  onClick={() => {
                    const table = tables.find((item) => item.id === order.tableId);
                    if (table) {
                      void loadTableDetail(table);
                    }
                  }}
                >
                  <div>
                    <strong>{order.tableName ?? 'No table'}</strong>
                    <div className="muted">#{order.orderNumber}</div>
                  </div>
                  <div className="ops-order-meta">
                    <StatusBadge
                      active={order.status !== 'PAID' && order.status !== 'CANCELLED'}
                      activeLabel={order.status}
                      inactiveLabel={order.status}
                    />
                    <span>{order.itemCount} items</span>
                    <strong>{formatMoney(order.grandTotal)}</strong>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="page-card ops-panel ops-sales">
            <div className="ops-panel-header">
              <h2>Sales Snapshot</h2>
            </div>
            <div className="ops-kpi-grid">
              <div className="ops-kpi">
                <span className="muted">Today Revenue</span>
                <strong>{formatMoney(overview.salesSnapshot.todayRevenue)}</strong>
              </div>
              <div className="ops-kpi">
                <span className="muted">Active Unpaid</span>
                <strong>{formatMoney(overview.salesSnapshot.activeUnpaidAmount)}</strong>
              </div>
              <div className="ops-kpi">
                <span className="muted">Open Orders</span>
                <strong>{overview.salesSnapshot.openOrderCount}</strong>
              </div>
              <div className="ops-kpi">
                <span className="muted">Completed Today</span>
                <strong>{overview.salesSnapshot.completedOrderCount}</strong>
              </div>
            </div>
          </section>

          <section className="page-card ops-panel ops-kitchen">
            <div className="ops-panel-header">
              <h2>Kitchen / Bar Status</h2>
            </div>
            <div className="ops-kitchen-grid">
              {Object.entries(overview.kitchenBarStatus).map(([station, counts]) => (
                <div key={station} className="ops-station-card">
                  <strong>{station}</strong>
                  <div className="ops-station-metrics">
                    <span>Queued: {counts.queued}</span>
                    <span>In Progress: {counts.inProgress}</span>
                    <span>Ready: {counts.ready}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="page-card ops-panel ops-calls">
            <div className="ops-panel-header">
              <h2>Waiter Calls</h2>
              <strong>{pendingCalls.length} pending</strong>
            </div>
            <div className="ops-call-create">
              <select value={callTableId} onChange={(event) => setCallTableId(event.target.value)}>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name}
                  </option>
                ))}
              </select>
              <input
                value={callNote}
                onChange={(event) => setCallNote(event.target.value)}
                placeholder="Optional call note"
              />
              <button type="button" className="secondary" onClick={createWaiterCall} disabled={callPending}>
                Add Call
              </button>
            </div>
            <div className="ops-call-list">
              {waiterCalls.slice(0, 12).map((call) => (
                <div key={call.id} className="ops-call-row">
                  <div>
                    <strong>{call.table?.name ?? call.tableId}</strong>
                    <div className="muted">{call.callType}</div>
                    <div className="muted">{new Date(call.requestedAt).toLocaleTimeString()}</div>
                    {call.note ? <div className="muted">{call.note}</div> : null}
                  </div>
                  <div className="ops-call-meta">
                    <StatusBadge
                      active={call.status === 'PENDING'}
                      activeLabel="PENDING"
                      inactiveLabel="RESOLVED"
                    />
                    {call.status === 'PENDING' ? (
                      <button type="button" className="secondary" onClick={() => void resolveWaiterCall(call.id)}>
                        Resolve
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="page-card ops-panel ops-quick-actions">
            <div className="ops-panel-header">
              <h2>Quick Actions</h2>
            </div>
            <div className="ops-actions-row">
              <select value={openSessionTableId} onChange={(event) => setOpenSessionTableId(event.target.value)}>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={openSessionGuests}
                onChange={(event) => setOpenSessionGuests(Number(event.target.value))}
              />
              <button type="button" className="secondary" onClick={openSession}>
                Open New Table Session
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  if (selectedTable) {
                    void loadTableDetail(selectedTable);
                  }
                }}
              >
                Jump To Table
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  if (tableDetailOrder) {
                    navigate(`/finance/orders/${tableDetailOrder.id}`);
                  } else {
                    navigate('/finance/orders');
                  }
                }}
              >
                Open Payments Screen
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => navigate('/operations/customers')}
              >
                Open Customer Desk
              </button>
              <button type="button" className="secondary" onClick={loadAll}>
                Refresh System
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {selectedTable ? (
      <Modal
        title={selectedTable ? `Table Detail — ${selectedTable.name}` : 'Table Detail'}
        onClose={() => {
          setSelectedTable(null);
          setActiveSessionId(null);
          setTableDetailOrder(null);
          setOrderPayments(null);
          setOrderRefunds([]);
          setOpenShift(null);
          setDetailError(null);
          setCashierError(null);
          setCashierInfo(null);
        }}
      >
        <div className="ops-detail-wrap">
          <div className="ops-actions-row">
            <button
              type="button"
              className="secondary"
              onClick={() => {
                if (selectedTable) {
                  void loadTableDetail(selectedTable);
                }
              }}
            >
              Refresh Detail
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                if (tableDetailOrder) {
                  navigate(`/finance/orders/${tableDetailOrder.id}`);
                }
              }}
              disabled={!tableDetailOrder}
            >
              Go To Payments
            </button>
          </div>
          <DataState
            isLoading={detailLoading}
            error={detailError}
            empty={!detailLoading && !detailError && !tableDetailOrder}
            emptyMessage="No active order for this table yet."
          />

          {tableDetailOrder ? (
            <>
              <div className="ops-detail-header">
                <StatusBadge
                  active={EDITABLE_ORDER_STATUSES.has(tableDetailOrder.status)}
                  activeLabel={tableDetailOrder.status}
                  inactiveLabel={tableDetailOrder.status}
                />
                <strong>Total: {formatMoney(tableDetailOrder.grandTotal)}</strong>
              </div>
              <div className="ops-detail-items">
                {tableDetailOrder.items.map((item) => (
                  <div key={item.id} className="ops-detail-item">
                    <div>
                      <strong>{item.productNameSnapshot}</strong>
                      {item.variantNameSnapshot ? <div className="muted">Variant: {item.variantNameSnapshot}</div> : null}
                      {item.notes ? <div className="muted">Note: {item.notes}</div> : null}
                    </div>
                    <div className="ops-detail-item-meta">
                      <span>{formatMoney(item.lineTotal)}</span>
                      <div className="ops-mini-actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => void changeQuantity(item.id, Number(item.quantity) - 1)}
                          disabled={!EDITABLE_ORDER_STATUSES.has(tableDetailOrder.status)}
                        >
                          -
                        </button>
                        <span>{Number(item.quantity)}</span>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => void changeQuantity(item.id, Number(item.quantity) + 1)}
                          disabled={!EDITABLE_ORDER_STATUSES.has(tableDetailOrder.status)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="ops-detail-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={!EDITABLE_ORDER_STATUSES.has(tableDetailOrder.status) || sendPending}
                  onClick={() => void sendOrder()}
                >
                  {sendPending ? 'Sending...' : 'Send Order'}
                </button>
              </div>

              <div className="ops-cashier-panel">
                <div className="ops-panel-header">
                  <h3>Cashier Payment Flow</h3>
                  <StatusBadge
                    active={!isFullyPaid}
                    activeLabel={isFullyPaid ? 'PAID' : 'OPEN BALANCE'}
                    inactiveLabel={isFullyPaid ? 'PAID' : 'OPEN BALANCE'}
                  />
                </div>

                <div className="ops-cashier-summary-grid">
                  <div className="ops-cashier-summary-card">
                    <span className="muted">Table</span>
                    <strong>{selectedTable.name}</strong>
                  </div>
                  <div className="ops-cashier-summary-card">
                    <span className="muted">Order Status</span>
                    <strong>{tableDetailOrder.status}</strong>
                  </div>
                  <div className="ops-cashier-summary-card">
                    <span className="muted">Grand Total</span>
                    <strong>{formatMoney(grandTotal)}</strong>
                  </div>
                  <div className="ops-cashier-summary-card">
                    <span className="muted">Paid Gross</span>
                    <strong>{formatMoney(paidGrossTotal)}</strong>
                  </div>
                  <div className="ops-cashier-summary-card">
                    <span className="muted">Refunded</span>
                    <strong>{formatMoney(refundedTotal)}</strong>
                  </div>
                  <div className="ops-cashier-summary-card highlight">
                    <span className="muted">Remaining</span>
                    <strong>{formatMoney(outstandingBalance)}</strong>
                  </div>
                  <div className="ops-cashier-summary-card">
                    <span className="muted">Net Paid</span>
                    <strong>{formatMoney(netPaidTotal)}</strong>
                  </div>
                  <div className="ops-cashier-summary-card">
                    <span className="muted">Billed At</span>
                    <strong>{tableDetailOrder.billedAt ? new Date(tableDetailOrder.billedAt).toLocaleTimeString() : '—'}</strong>
                  </div>
                  <div className="ops-cashier-summary-card">
                    <span className="muted">Paid At</span>
                    <strong>{tableDetailOrder.paidAt ? new Date(tableDetailOrder.paidAt).toLocaleTimeString() : '—'}</strong>
                  </div>
                </div>

                <div className="ops-cashier-actions">
                  <button type="button" className="secondary" onClick={() => void billOrder()} disabled={!canBillOrder || billPending}>
                    {billPending ? 'Billing...' : 'Bill Order'}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void closeTableSession()}
                    disabled={!canCloseSession || closeSessionPending}
                  >
                    {closeSessionPending ? 'Closing...' : 'Close Table Session'}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void triggerReceiptPrint()}
                    disabled={printPending || !tableDetailOrder}
                  >
                    {printPending ? 'Printing...' : 'Print Receipt (Hook)'}
                  </button>
                </div>

                {!openShift ? (
                  <div className="ops-inline-warning">
                    No OPEN register shift found for current user. Payments are blocked until shift opens.
                  </div>
                ) : (
                  <div className="ops-inline-info">
                    Open shift: {openShift.id.slice(0, 8)} • opened {new Date(openShift.openedAt).toLocaleTimeString()}
                  </div>
                )}

                {!PAYABLE_ORDER_STATUSES.has(tableDetailOrder.status) ? (
                  <div className="ops-inline-warning">
                    Payments are available after order reaches READY/SERVED/BILLED.
                  </div>
                ) : null}

                <div className="ops-cashier-form">
                  <label>
                    Payment Method
                    <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as OperationsPaymentMethod)}>
                      {CASHIER_PAYMENT_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Amount
                    <input
                      type="number"
                      min={0.01}
                      max={Math.max(outstandingBalance, 0)}
                      step={0.01}
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                  <label>
                    Reference No (Optional)
                    <input
                      value={paymentReferenceNo}
                      onChange={(event) => setPaymentReferenceNo(event.target.value)}
                      placeholder="POS slip / receipt no"
                    />
                  </label>
                  <label>
                    Note (Optional)
                    <input
                      value={paymentNotes}
                      onChange={(event) => setPaymentNotes(event.target.value)}
                      placeholder="Payment note"
                    />
                  </label>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void submitPayment()}
                    disabled={!canAcceptPayments || !paymentAmountIsValid || paymentPending}
                  >
                    {paymentPending ? 'Recording...' : 'Record Payment'}
                  </button>
                </div>

                {cashierInfo ? <p className="success">{cashierInfo}</p> : null}
                {cashierError ? <p className="error">{cashierError}</p> : null}

                <div className="ops-cashier-history">
                  <h4>Payment History</h4>
                  {(orderPayments?.payments.length ?? 0) === 0 ? (
                    <p className="muted">No payments recorded yet.</p>
                  ) : (
                    <div className="ops-cashier-list">
                      {orderPayments?.payments.map((payment) => (
                        <div key={payment.id} className="ops-cashier-row">
                          <div>
                            <strong>{payment.paymentMethod}</strong>
                            <div className="muted">{new Date(payment.createdAt).toLocaleString()}</div>
                            {payment.referenceNo ? <div className="muted">Ref: {payment.referenceNo}</div> : null}
                          </div>
                          <div className="ops-cashier-row-right">
                            <StatusBadge
                              active={payment.status === 'COMPLETED' || payment.status === 'REFUNDED_PARTIAL'}
                              activeLabel={payment.status}
                              inactiveLabel={payment.status}
                            />
                            <strong>{formatMoney(payment.amount)}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="ops-cashier-history">
                  <h4>Refund Visibility</h4>
                  {orderRefunds.length === 0 ? (
                    <p className="muted">No refunds recorded for this order.</p>
                  ) : (
                    <div className="ops-cashier-list">
                      {orderRefunds.map((refund) => (
                        <div key={refund.id} className="ops-cashier-row">
                          <div>
                            <strong>{refund.paymentTransaction?.paymentMethod ?? 'REFUND'}</strong>
                            <div className="muted">{new Date(refund.createdAt).toLocaleString()}</div>
                            <div className="muted">{refund.reason}</div>
                          </div>
                          <div className="ops-cashier-row-right">
                            <strong>-{formatMoney(refund.amount)}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}

          <div className="ops-detail-catalog">
            <h3>Add Items</h3>
            <div className="catalog-tabs">
              {catalog.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`catalog-tab ${selectedCategory?.id === category.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategoryId(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
            <div className="ops-detail-product-grid">
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="ops-detail-product"
                  onClick={() => void addSimpleCatalogItem(product.id)}
                  disabled={productSubmitPending || !tableDetailOrder || !EDITABLE_ORDER_STATUSES.has(tableDetailOrder.status)}
                >
                  <strong>{product.name}</strong>
                  <span>{formatMoney(product.basePrice)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
      ) : null}
    </div>
  );
}
