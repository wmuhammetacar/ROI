import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type {
  Order,
  OrderItem,
  OrderPaymentsResponse,
  PosCatalogCategory,
  PosCatalogModifierGroup,
  PosCatalogModifierLink,
  PosCatalogProduct,
  Table,
  TableSession,
} from '../api';
import { orderPaymentsApi, ordersApi, posCatalogApi, tableSessionsApi, tablesApi } from '../api';
import { useSession } from '../app/session-context';
import { DataState, Modal, StatusBadge } from '../components';
import { POS_REALTIME_EVENTS, usePosBranchRealtime } from '../realtime';

const ORDER_EDITABLE_STATUSES = new Set(['DRAFT', 'PLACED']);

function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  if (Number.isNaN(amount)) return '0.00';
  return amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function findActiveOrder(orders: Order[]): Order | null {
  const active = orders.find((item) => item.status !== 'CANCELLED' && item.status !== 'PAID');
  return active ?? orders[0] ?? null;
}

function getActiveOptions(group: PosCatalogModifierGroup) {
  return group.options.filter((option) => option.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function OrderEntryPage() {
  const { user } = useSession();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tableId = searchParams.get('tableId');

  const [table, setTable] = useState<Table | null>(null);
  const [tableSession, setTableSession] = useState<TableSession | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [orderPayments, setOrderPayments] = useState<OrderPaymentsResponse | null>(null);
  const [catalog, setCatalog] = useState<PosCatalogCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isSendingToStation, setIsSendingToStation] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionGuestCount, setSessionGuestCount] = useState(2);
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isOpeningSession, setIsOpeningSession] = useState(false);

  const [configProduct, setConfigProduct] = useState<PosCatalogProduct | null>(null);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [configVariantId, setConfigVariantId] = useState<string | null>(null);
  const [configSelections, setConfigSelections] = useState<Record<string, string[]>>({});
  const [configQuantity, setConfigQuantity] = useState(1);
  const [configNotes, setConfigNotes] = useState('');
  const [configError, setConfigError] = useState<string | null>(null);
  const [isConfigSubmitting, setIsConfigSubmitting] = useState(false);

  const loadCatalog = useCallback(async () => {
    setIsLoadingCatalog(true);
    setCatalogError(null);
    try {
      const response = await posCatalogApi.getPosProducts();
      setCatalog(response.categories ?? []);
      if (!selectedCategoryId && response.categories.length > 0) {
        setSelectedCategoryId(response.categories[0].id);
      }
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : 'Failed to load catalog.');
    } finally {
      setIsLoadingCatalog(false);
    }
  }, [selectedCategoryId]);

  const loadContext = useCallback(async () => {
    if (!tableId) {
      setIsLoadingContext(false);
      return;
    }
    setIsLoadingContext(true);
    setContextError(null);

    try {
      const [tableResponse, sessionResponse] = await Promise.all([
        tablesApi.getById(tableId),
        tableSessionsApi.findOpenByTable(tableId),
      ]);
      setTable(tableResponse);
      setTableSession(sessionResponse);
    } catch (err) {
      setContextError(err instanceof Error ? err.message : 'Failed to load table context.');
    } finally {
      setIsLoadingContext(false);
    }
  }, [tableId]);

  const loadOrder = useCallback(async () => {
    if (!tableSession) return;
    setIsLoadingOrder(true);
    setOrderError(null);
    try {
      const orders = await ordersApi.list({ tableSessionId: tableSession.id, limit: 5 });
      const active = findActiveOrder(orders);
      if (active) {
        const [detailed, payments] = await Promise.all([
          ordersApi.getById(active.id),
          orderPaymentsApi.getPayments(active.id).catch(() => null),
        ]);
        setOrder(detailed);
        setOrderPayments(payments);
      } else {
        setOrder(null);
        setOrderPayments(null);
      }
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Failed to load order.');
    } finally {
      setIsLoadingOrder(false);
    }
  }, [tableSession]);

  const refreshOrder = useCallback(async () => {
    if (!order) return;
    try {
      const [updated, payments] = await Promise.all([
        ordersApi.getById(order.id),
        orderPaymentsApi.getPayments(order.id).catch(() => null),
      ]);
      setOrder(updated);
      setOrderPayments(payments);
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Failed to refresh order.');
    }
  }, [order]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (tableSession) {
      void loadOrder();
    } else {
      setOrder(null);
      setOrderPayments(null);
    }
  }, [loadOrder, tableSession]);

  const categories = useMemo(
    () => [...catalog].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [catalog],
  );

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? categories[0];

  const products = useMemo(() => {
    if (!selectedCategory) return [];
    return [...(selectedCategory.products ?? [])]
      .filter((product) => product.isActive && product.isAvailable)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [selectedCategory]);

  const isOrderEditable = order ? ORDER_EDITABLE_STATUSES.has(order.status) : false;

  const realtimeHandlers = useMemo(
    () => ({
      [POS_REALTIME_EVENTS.ORDER_UPDATED]: (event: { payload: Record<string, unknown> }) => {
        const payloadOrderId =
          typeof event.payload.orderId === 'string' ? event.payload.orderId : null;
        const payloadTableSessionId =
          typeof event.payload.tableSessionId === 'string' ? event.payload.tableSessionId : null;

        if (order && payloadOrderId === order.id) {
          void refreshOrder();
          return;
        }

        if (tableSession && payloadTableSessionId && payloadTableSessionId === tableSession.id) {
          void loadOrder();
        }
      },
      [POS_REALTIME_EVENTS.ORDER_STATUS_CHANGED]: (event: { payload: Record<string, unknown> }) => {
        const payloadOrderId =
          typeof event.payload.orderId === 'string' ? event.payload.orderId : null;
        if (order && payloadOrderId === order.id) {
          void refreshOrder();
        }
      },
      [POS_REALTIME_EVENTS.ORDER_SENT_TO_STATION]: (event: { payload: Record<string, unknown> }) => {
        const payloadOrderId =
          typeof event.payload.orderId === 'string' ? event.payload.orderId : null;
        if (order && payloadOrderId === order.id) {
          void refreshOrder();
        }
      },
      [POS_REALTIME_EVENTS.PAYMENT_RECORDED]: (event: { payload: Record<string, unknown> }) => {
        const payloadOrderId =
          typeof event.payload.orderId === 'string' ? event.payload.orderId : null;
        if (order && payloadOrderId === order.id) {
          void refreshOrder();
        }
      },
      [POS_REALTIME_EVENTS.ORDER_PAID]: (event: { payload: Record<string, unknown> }) => {
        const payloadOrderId =
          typeof event.payload.orderId === 'string' ? event.payload.orderId : null;
        if (order && payloadOrderId === order.id) {
          void refreshOrder();
        }
      },
      [POS_REALTIME_EVENTS.PUBLIC_ORDER_SUBMITTED]: (event: { payload: Record<string, unknown> }) => {
        const payloadTableSessionId =
          typeof event.payload.tableSessionId === 'string' ? event.payload.tableSessionId : null;
        if (tableSession && payloadTableSessionId && payloadTableSessionId === tableSession.id) {
          void loadOrder();
        }
      },
    }),
    [loadOrder, order, refreshOrder, tableSession],
  );

  usePosBranchRealtime(user?.branchId, realtimeHandlers);

  const handleCreateOrder = useCallback(async () => {
    if (!tableSession) return;
    setIsCreatingOrder(true);
    setOrderError(null);
    try {
      const created = await ordersApi.create({ serviceType: 'DINE_IN', tableSessionId: tableSession.id });
      setOrder(created);
      setOrderPayments(null);
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Failed to create order.');
    } finally {
      setIsCreatingOrder(false);
    }
  }, [tableSession]);

  const handleOpenSession = useCallback(async () => {
    if (!table) return;
    if (sessionGuestCount <= 0) {
      setSessionError('Guest count must be greater than 0.');
      return;
    }
    setIsOpeningSession(true);
    setSessionError(null);
    try {
      const session = await tableSessionsApi.open({
        tableId: table.id,
        guestCount: sessionGuestCount,
        notes: sessionNotes.trim() ? sessionNotes.trim() : undefined,
      });
      setTableSession(session);
      setIsSessionModalOpen(false);
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : 'Failed to open session.');
    } finally {
      setIsOpeningSession(false);
    }
  }, [sessionGuestCount, sessionNotes, table]);

  const handleSendToStation = useCallback(async () => {
    if (!order) return;
    setIsSendingToStation(true);
    setOrderError(null);
    try {
      await ordersApi.sendToStation(order.id);
      await refreshOrder();
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Failed to send order to station.');
    } finally {
      setIsSendingToStation(false);
    }
  }, [order, refreshOrder]);

  const openConfig = useCallback(
    (product: PosCatalogProduct, item?: OrderItem) => {
      setConfigProduct(product);
      setEditingItem(item ?? null);
      setConfigQuantity(item ? Number(item.quantity) : 1);
      setConfigNotes(item?.notes ?? '');
      if (item?.variantId) {
        setConfigVariantId(item.variantId);
      } else if (product.variants.length === 1) {
        setConfigVariantId(product.variants[0].id);
      } else {
        setConfigVariantId(null);
      }
      const selections: Record<string, string[]> = {};
      if (item?.modifierSelections) {
        item.modifierSelections.forEach((selection) => {
          if (!selections[selection.modifierGroupId]) {
            selections[selection.modifierGroupId] = [];
          }
          selections[selection.modifierGroupId].push(selection.modifierOptionId);
        });
      }
      setConfigSelections(selections);
      setConfigError(null);
    },
    [],
  );

  const closeConfig = useCallback(() => {
    setConfigProduct(null);
    setEditingItem(null);
    setConfigVariantId(null);
    setConfigSelections({});
    setConfigQuantity(1);
    setConfigNotes('');
    setConfigError(null);
  }, []);

  const handleToggleOption = useCallback(
    (group: PosCatalogModifierGroup, optionId: string) => {
      setConfigSelections((prev) => {
        const current = prev[group.id] ?? [];
        if (group.selectionType === 'SINGLE') {
          return { ...prev, [group.id]: current.includes(optionId) ? [] : [optionId] };
        }
        if (current.includes(optionId)) {
          return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
        }
        return { ...prev, [group.id]: [...current, optionId] };
      });
    },
    [],
  );

  const buildModifierPayload = useCallback(() => {
    if (!configProduct) return { payload: [], errors: [] as string[] };
    const errors: string[] = [];
    const payload: { modifierGroupId: string; optionIds: string[] }[] = [];

    const sortedLinks = [...configProduct.modifierGroupLinks].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.modifierGroup.name.localeCompare(b.modifierGroup.name),
    );

    sortedLinks.forEach((link) => {
      const group = link.modifierGroup;
      if (!group.isActive) return;
      const selected = configSelections[group.id] ?? [];
      const minRequired = Math.max(group.minSelect ?? 0, link.isRequired ? 1 : 0);
      if (selected.length < minRequired) {
        errors.push(`${group.name} requires at least ${minRequired} selection(s).`);
      }
      if (selected.length > group.maxSelect) {
        errors.push(`${group.name} allows at most ${group.maxSelect} selection(s).`);
      }
      if (group.selectionType === 'SINGLE' && selected.length > 1) {
        errors.push(`${group.name} allows only one selection.`);
      }
      const activeOptions = getActiveOptions(group).map((option) => option.id);
      const filtered = selected.filter((optionId) => activeOptions.includes(optionId));
      if (filtered.length > 0) {
        payload.push({ modifierGroupId: group.id, optionIds: filtered });
      }
    });

    return { payload, errors };
  }, [configProduct, configSelections]);

  const handleSubmitConfig = useCallback(async () => {
    if (!order || !configProduct) return;
    if (configQuantity <= 0) {
      setConfigError('Quantity must be greater than 0.');
      return;
    }

    const { payload, errors } = buildModifierPayload();
    if (errors.length > 0) {
      setConfigError(errors[0]);
      return;
    }

    setIsConfigSubmitting(true);
    setConfigError(null);
    try {
      if (editingItem) {
        await ordersApi.updateCatalogItem(order.id, editingItem.id, {
          productId: configProduct.id,
          variantId: configVariantId,
          quantity: configQuantity,
          notes: configNotes.trim() ? configNotes.trim() : undefined,
          modifierSelections: payload,
        });
      } else {
        await ordersApi.addCatalogItem(order.id, {
          productId: configProduct.id,
          variantId: configVariantId,
          quantity: configQuantity,
          notes: configNotes.trim() ? configNotes.trim() : undefined,
          modifierSelections: payload,
        });
      }
      await refreshOrder();
      closeConfig();
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to update order item.');
    } finally {
      setIsConfigSubmitting(false);
    }
  }, [
    buildModifierPayload,
    closeConfig,
    configNotes,
    configProduct,
    configQuantity,
    configVariantId,
    editingItem,
    order,
    refreshOrder,
  ]);

  const handleRemoveItem = useCallback(
    async (item: OrderItem) => {
      if (!order) return;
      setOrderError(null);
      try {
        await ordersApi.removeItem(order.id, item.id);
        await refreshOrder();
      } catch (err) {
        setOrderError(err instanceof Error ? err.message : 'Failed to remove item.');
      }
    },
    [order, refreshOrder],
  );

  const handleQuickAdd = useCallback(
    (product: PosCatalogProduct) => {
      if (!isOrderEditable) return;
      if (product.variants.length === 0 && product.modifierGroupLinks.length === 0) {
        openConfig(product);
      } else {
        openConfig(product);
      }
    },
    [isOrderEditable, openConfig],
  );

  const getProductForItem = useCallback(
    (item: OrderItem) => {
      if (!item.productId) return null;
      return catalog.flatMap((category) => category.products).find((product) => product.id === item.productId) ?? null;
    },
    [catalog],
  );

  const configVariant = useMemo(() => {
    if (!configProduct || !configVariantId) return null;
    return configProduct.variants.find((variant) => variant.id === configVariantId) ?? null;
  }, [configProduct, configVariantId]);

  const configLinks = useMemo(() => {
    if (!configProduct) return [] as PosCatalogModifierLink[];
    return [...configProduct.modifierGroupLinks].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.modifierGroup.name.localeCompare(b.modifierGroup.name),
    );
  }, [configProduct]);

  const paidTotal = Number(orderPayments?.financial.netPaidTotal ?? 0);
  const outstanding = Number(orderPayments?.financial.outstandingBalance ?? order?.grandTotal ?? 0);

  const editableNotice = order && !isOrderEditable ? 'Order is locked for edits by backend order rules.' : null;
  const paidNotice = order?.status === 'PAID' ? 'Order is fully paid. Item edits are disabled.' : null;

  const handleOpenPayments = useCallback(() => {
    if (!order) return;
    navigate(`/payments?orderId=${order.id}`);
  }, [navigate, order]);

  if (!tableId) {
    return (
      <div className="panel">
        <h1>Order Entry</h1>
        <p className="muted">Select a table from the tables screen to start a dine-in order.</p>
        <Link to="/tables" className="primary">
          Go to Tables
        </Link>
      </div>
    );
  }

  return (
    <div className="order-entry">
      <section className="order-entry-main">
        <div className="panel-header">
          <div>
            <h1>Order Entry</h1>
            <p className="muted">Table-driven dine-in ordering.</p>
          </div>
          <button type="button" className="ghost" onClick={loadContext}>
            Refresh
          </button>
        </div>

        <div className="context-card">
          <DataState isLoading={isLoadingContext} error={contextError} />
          {table ? (
            <div className="context-grid">
              <div>
                <strong>{table.name}</strong>
                <div className="muted">Status: {table.status}</div>
                <div className="muted">Capacity: {table.capacity}</div>
              </div>
              <div>
                {tableSession ? (
                  <div>
                    <strong>Session Open</strong>
                    <div className="muted">Guests: {tableSession.guestCount}</div>
                    <div className="muted">Opened: {new Date(tableSession.openedAt).toLocaleTimeString()}</div>
                  </div>
                ) : (
                  <div>
                    <strong>No open session</strong>
                    <div className="muted">Open a session to start ordering.</div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {!tableSession ? (
          <div className="panel">
            <h2>Open a session</h2>
            <p className="muted">This table has no open session. Open one to start ordering.</p>
            <div className="stack-row">
              <button type="button" className="primary" onClick={() => setIsSessionModalOpen(true)}>
                Open Session
              </button>
              <Link to="/tables" className="ghost">
                Back to Tables
              </Link>
            </div>
          </div>
        ) : null}

        {tableSession ? (
          <div className="catalog-panel">
            <div className="panel-header">
              <div>
                <h2>Catalog</h2>
                <p className="muted">Tap an item to add it to the order.</p>
              </div>
              <button type="button" className="ghost" onClick={loadCatalog}>
                Reload
              </button>
            </div>

            <div className="category-tabs">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`category-tab ${selectedCategory?.id === category.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategoryId(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>

            <DataState
              isLoading={isLoadingCatalog}
              error={catalogError}
              empty={!isLoadingCatalog && !catalogError && products.length === 0}
              emptyMessage={selectedCategory ? `No products in ${selectedCategory.name}.` : 'No products yet.'}
            />

            <div className="product-grid">
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="product-card"
                  onClick={() => handleQuickAdd(product)}
                  disabled={!isOrderEditable}
                >
                  <strong>{product.name}</strong>
                  <span className="muted">Base: {formatMoney(product.basePrice)}</span>
                  {product.variants.length > 0 ? <span className="pill">Variants</span> : null}
                  {product.modifierGroupLinks.length > 0 ? <span className="pill">Modifiers</span> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <aside className="order-entry-cart">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Current Order</h2>
              {order ? (
                <div className="order-status-stack">
                  <StatusBadge value={order.status} />
                  {order.status === 'BILLED' ? <span className="muted">Billed: waiting for payment settlement.</span> : null}
                  {order.status === 'PAID' ? <span className="muted">Paid: no further item changes allowed.</span> : null}
                </div>
              ) : (
                <span className="muted">No order yet</span>
              )}
            </div>
            <button type="button" className="ghost" onClick={loadOrder}>
              Refresh
            </button>
          </div>

          {orderError ? <p className="error">{orderError}</p> : null}
          {editableNotice ? <p className="muted">{editableNotice}</p> : null}
          {paidNotice ? <p className="success">{paidNotice}</p> : null}
          {isLoadingOrder ? <p className="muted">Loading order...</p> : null}

          {!order && tableSession ? (
            <button type="button" className="primary" onClick={handleCreateOrder} disabled={isCreatingOrder}>
              {isCreatingOrder ? 'Creating...' : 'Create Dine-in Order'}
            </button>
          ) : null}

          {order ? (
            <div className="order-items">
              {order.items.length === 0 ? <p className="muted">No items added yet.</p> : null}
              {order.items.map((item) => {
                const product = getProductForItem(item);
                return (
                  <div key={item.id} className="order-item-row">
                    <div className="order-item-main">
                      <strong>{item.productNameSnapshot}</strong>
                      {item.variantNameSnapshot ? <span className="muted">Variant: {item.variantNameSnapshot}</span> : null}
                      {item.modifierSelections.length > 0 ? (
                        <ul>
                          {item.modifierSelections.map((selection) => (
                            <li key={selection.id}>
                              {selection.modifierGroupNameSnapshot}: {selection.modifierOptionNameSnapshot}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {item.notes ? <span className="muted">Note: {item.notes}</span> : null}
                    </div>
                    <div className="order-item-meta">
                      <span>x{item.quantity}</span>
                      <span>{formatMoney(item.lineTotal)}</span>
                      {isOrderEditable ? (
                        <div className="order-item-actions">
                          <button type="button" onClick={() => product && openConfig(product, item)} disabled={!product}>
                            Edit
                          </button>
                          <button type="button" className="ghost" onClick={() => handleRemoveItem(item)}>
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {order ? (
            <div className="order-totals">
              <div>
                <span>Subtotal</span>
                <strong>{formatMoney(order.subtotal)}</strong>
              </div>
              <div>
                <span>Discount</span>
                <strong>{formatMoney(order.discountTotal)}</strong>
              </div>
              <div className="grand">
                <span>Total</span>
                <strong>{formatMoney(order.grandTotal)}</strong>
              </div>
            </div>
          ) : null}

          {order ? (
            <div className="order-finance-strip">
              <div>
                <span className="muted">Paid</span>
                <strong>{formatMoney(paidTotal)}</strong>
              </div>
              <div>
                <span className="muted">Outstanding</span>
                <strong>{formatMoney(outstanding)}</strong>
              </div>
              <button type="button" className="ghost touch-button" onClick={handleOpenPayments}>
                Open Payments
              </button>
            </div>
          ) : null}

          {order && isOrderEditable ? (
            <button
              type="button"
              className="primary"
              onClick={handleSendToStation}
              disabled={isSendingToStation}
            >
              {isSendingToStation ? 'Sending...' : 'Send to Station'}
            </button>
          ) : null}
        </div>
      </aside>

      <Modal
        open={Boolean(configProduct)}
        title={configProduct ? `Add ${configProduct.name}` : 'Configure Item'}
        onClose={closeConfig}
        actions={
          <>
            <button type="button" className="ghost" onClick={closeConfig}>
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleSubmitConfig}
              disabled={isConfigSubmitting || !order || !isOrderEditable}
            >
              {isConfigSubmitting ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
            </button>
          </>
        }
      >
        {configProduct ? (
          <div className="form-grid">
            <div className="field">
              <span>Base price</span>
              <strong>{formatMoney(configProduct.basePrice)}</strong>
            </div>

            {configProduct.variants.length > 0 ? (
              <div className="field">
                <span>Variant</span>
                <div className="option-list">
                  {configProduct.variants
                    .filter((variant) => variant.isActive)
                    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
                    .map((variant) => (
                      <label key={variant.id} className="option-item">
                        <input
                          type="radio"
                          name="variant"
                          checked={configVariantId === variant.id}
                          onChange={() => setConfigVariantId(variant.id)}
                        />
                        <span>{variant.name}</span>
                        <span className="muted">Delta: {formatMoney(variant.priceDelta)}</span>
                      </label>
                    ))}
                </div>
              </div>
            ) : null}

            {configLinks.map((link) => {
              const group = link.modifierGroup;
              if (!group.isActive) return null;
              const options = getActiveOptions(group);
              const selected = configSelections[group.id] ?? [];
              const minRequired = Math.max(group.minSelect ?? 0, link.isRequired ? 1 : 0);

              return (
                <div key={group.id} className="field">
                  <div className="field-header">
                    <span>{group.name}</span>
                    <span className="muted">
                      {group.selectionType === 'SINGLE' ? 'Single' : 'Multiple'} | Min {minRequired} / Max {group.maxSelect}
                    </span>
                  </div>
                  <div className="option-list">
                    {options.map((option) => (
                      <label key={option.id} className="option-item">
                        <input
                          type={group.selectionType === 'SINGLE' ? 'radio' : 'checkbox'}
                          name={`group-${group.id}`}
                          checked={selected.includes(option.id)}
                          onChange={() => handleToggleOption(group, option.id)}
                        />
                        <span>{option.name}</span>
                        <span className="muted">Delta: {formatMoney(option.priceDelta)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            <label className="field">
              <span>Quantity</span>
              <input
                type="number"
                min={1}
                value={configQuantity}
                onChange={(event) => setConfigQuantity(Number(event.target.value))}
              />
            </label>

            <label className="field">
              <span>Notes</span>
              <textarea value={configNotes} onChange={(event) => setConfigNotes(event.target.value)} />
            </label>

            {configError ? <p className="error">{configError}</p> : null}

            {configVariant ? (
              <div className="field">
                <span>Selected variant</span>
                <strong>
                  {configVariant.name} ({formatMoney(configVariant.priceDelta)})
                </strong>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={isSessionModalOpen}
        title={table ? `Open Session - ${table.name}` : 'Open Session'}
        onClose={() => setIsSessionModalOpen(false)}
        actions={
          <>
            <button type="button" className="ghost" onClick={() => setIsSessionModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="primary" onClick={handleOpenSession} disabled={isOpeningSession}>
              {isOpeningSession ? 'Opening...' : 'Open Session'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <label className="field">
            <span>Guest Count</span>
            <input
              type="number"
              min={1}
              value={sessionGuestCount}
              onChange={(event) => setSessionGuestCount(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Notes (optional)</span>
            <textarea value={sessionNotes} onChange={(event) => setSessionNotes(event.target.value)} />
          </label>
          {sessionError ? <p className="error">{sessionError}</p> : null}
        </div>
      </Modal>
    </div>
  );
}
