import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@roi/shared-utils';
import { customersApi, operationsOrderActionsApi, type CustomerHistoryOrder, type CustomerRecord, type OperationsOrder } from '../../api';
import { useBranchContext } from '../../app/branch-context';
import { toErrorMessage } from '../../app/error-utils';
import { BranchScopeBanner, DataState, Modal, PageHeader, StatusBadge } from '../../components';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatMoney(value?: string | number | null) {
  return formatCurrency(Number(value ?? 0));
}

const emptyCustomerForm = {
  fullName: '',
  phonePrimary: '',
  phoneSecondary: '',
  phoneTertiary: '',
  addressLine: '',
  notes: '',
  isActive: true,
};

export function CustomerPackageDeskPage() {
  const navigate = useNavigate();
  const { effectiveBranchId } = useBranchContext();

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [history, setHistory] = useState<CustomerHistoryOrder[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [activeOrder, setActiveOrder] = useState<OperationsOrder | null>(null);
  const [quickProducts, setQuickProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [catalogOrderLoading, setCatalogOrderLoading] = useState(false);
  const [catalogOrderError, setCatalogOrderError] = useState<string | null>(null);

  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);
  const [customerSubmitPending, setCustomerSubmitPending] = useState(false);

  const [repeatPendingOrderId, setRepeatPendingOrderId] = useState<string | null>(null);

  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await customersApi.list({ q: query.trim() || undefined, limit: 50 }, effectiveBranchId ?? undefined);
      setSearchResults(list);
      if (!selectedCustomerId && list.length > 0) {
        setSelectedCustomerId(list[0].id);
      }
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, [effectiveBranchId]);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const catalog = await operationsOrderActionsApi.getRouteSafeCatalog(effectiveBranchId ?? undefined);
        const products = (catalog.categories ?? [])
          .flatMap((category) => category.products ?? [])
          .filter((product) => product.isActive && product.isAvailable)
          .slice(0, 6)
          .map((product) => ({ id: product.id, name: product.name }));
        setQuickProducts(products);
      } catch {
        setQuickProducts([]);
      }
    };
    void loadCatalog();
  }, [effectiveBranchId]);

  const loadCustomerDetail = async (customerId: string) => {
    setDetailLoading(true);
    setCatalogOrderError(null);
    try {
      const [customerDetail, orderHistory] = await Promise.all([
        customersApi.getById(customerId, effectiveBranchId ?? undefined),
        customersApi.getOrderHistory(customerId),
      ]);
      setCustomer(customerDetail);
      setHistory(orderHistory);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomer(null);
      setHistory([]);
      return;
    }
    void loadCustomerDetail(selectedCustomerId);
  }, [selectedCustomerId, effectiveBranchId]);

  const openCreateCustomer = () => {
    setEditingCustomer(null);
    setCustomerForm({ ...emptyCustomerForm });
    setCustomerModalOpen(true);
  };

  const openEditCustomer = () => {
    if (!customer) return;
    setEditingCustomer(customer);
    setCustomerForm({
      fullName: customer.fullName,
      phonePrimary: customer.phonePrimary,
      phoneSecondary: customer.phoneSecondary ?? '',
      phoneTertiary: customer.phoneTertiary ?? '',
      addressLine: customer.addressLine ?? '',
      notes: customer.notes ?? '',
      isActive: customer.isActive,
    });
    setCustomerModalOpen(true);
  };

  const submitCustomer = async () => {
    setCustomerSubmitPending(true);
    setError(null);
    try {
      const payload = {
        fullName: customerForm.fullName.trim(),
        phonePrimary: customerForm.phonePrimary.trim(),
        phoneSecondary: customerForm.phoneSecondary.trim() || undefined,
        phoneTertiary: customerForm.phoneTertiary.trim() || undefined,
        addressLine: customerForm.addressLine.trim() || undefined,
        notes: customerForm.notes.trim() || undefined,
        isActive: customerForm.isActive,
      };

      if (editingCustomer) {
        await customersApi.update(editingCustomer.id, payload);
        setSelectedCustomerId(editingCustomer.id);
      } else {
        const created = await customersApi.create(payload);
        setSelectedCustomerId(created.id);
      }

      await loadCustomers();
      if (selectedCustomerId) {
        await loadCustomerDetail(selectedCustomerId);
      }
      setCustomerModalOpen(false);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setCustomerSubmitPending(false);
    }
  };

  const refreshActiveOrder = async (orderId: string) => {
    const full = await operationsOrderActionsApi.getOrderById(orderId, effectiveBranchId ?? undefined);
    setActiveOrder(full);
  };

  const startPackageOrder = async () => {
    if (!customer) return;
    setCatalogOrderLoading(true);
    setCatalogOrderError(null);
    try {
      const order = await customersApi.startOrder(customer.id, { serviceType: 'TAKEAWAY' });
      await refreshActiveOrder(order.id);
    } catch (err) {
      setCatalogOrderError(toErrorMessage(err));
    } finally {
      setCatalogOrderLoading(false);
    }
  };

  const repeatOrder = async (sourceOrderId: string) => {
    if (!customer) return;
    setRepeatPendingOrderId(sourceOrderId);
    setCatalogOrderError(null);
    try {
      const result = await customersApi.repeatOrder(customer.id, sourceOrderId);
      await refreshActiveOrder(result.order.id);
    } catch (err) {
      setCatalogOrderError(toErrorMessage(err));
    } finally {
      setRepeatPendingOrderId(null);
    }
  };

  const addQuickItem = async (productId: string) => {
    if (!activeOrder) return;
    setCatalogOrderLoading(true);
    setCatalogOrderError(null);
    try {
      await operationsOrderActionsApi.addCatalogItem(activeOrder.id, {
        productId,
        quantity: 1,
      });
      await refreshActiveOrder(activeOrder.id);
    } catch (err) {
      setCatalogOrderError(toErrorMessage(err));
    } finally {
      setCatalogOrderLoading(false);
    }
  };

  const sendActiveOrder = async () => {
    if (!activeOrder) return;
    setCatalogOrderLoading(true);
    setCatalogOrderError(null);
    try {
      await operationsOrderActionsApi.sendOrder(activeOrder.id);
      await refreshActiveOrder(activeOrder.id);
    } catch (err) {
      setCatalogOrderError(toErrorMessage(err));
    } finally {
      setCatalogOrderLoading(false);
    }
  };

  const customerPhones = useMemo(
    () => [customer?.phonePrimary, customer?.phoneSecondary, customer?.phoneTertiary].filter(Boolean),
    [customer],
  );

  return (
    <div className="catalog-content">
      <PageHeader
        title="Packet / Phone / Customer Desk"
        description="Live call and package-order flow: find customer, inspect history, start or repeat takeaway order fast."
        actions={
          <>
            <button type="button" className="secondary" onClick={loadCustomers}>
              Refresh
            </button>
            <button type="button" onClick={openCreateCustomer}>
              New Customer
            </button>
          </>
        }
      />

      <BranchScopeBanner sectionLabel="Customer Desk" />

      {error ? <p className="error">{error}</p> : null}

      <div className="customer-desk-grid">
        <section className="page-card">
          <h2>Customer / Phone Lookup</h2>
          <div className="table-toolbar">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Phone or name"
            />
            <button type="button" className="secondary" onClick={loadCustomers}>
              Search
            </button>
          </div>
          <DataState
            isLoading={loading}
            error={null}
            empty={!loading && searchResults.length === 0}
            emptyMessage="No customers found. Create new customer to start package flow."
          />
          <div className="customer-list">
            {searchResults.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`customer-row ${item.id === selectedCustomerId ? 'active' : ''}`}
                onClick={() => setSelectedCustomerId(item.id)}
              >
                <div>
                  <strong>{item.fullName}</strong>
                  <div className="muted">{item.phonePrimary}</div>
                </div>
                <StatusBadge active={item.isActive} activeLabel="ACTIVE" inactiveLabel="INACTIVE" />
              </button>
            ))}
          </div>
        </section>

        <section className="page-card">
          <h2>Customer Detail</h2>
          <DataState
            isLoading={detailLoading}
            error={null}
            empty={!detailLoading && !customer}
            emptyMessage="Select customer from lookup panel."
          />

          {customer ? (
            <div className="customer-detail-stack">
              <div className="detail-grid">
                <div>
                  <p className="muted">Name</p>
                  <strong>{customer.fullName}</strong>
                </div>
                <div>
                  <p className="muted">Phones</p>
                  <div className="badge-row">
                    {customerPhones.map((phone) => (
                      <span key={String(phone)} className="chip">{phone}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="muted">Address</p>
                  <strong>{customer.addressLine || '—'}</strong>
                </div>
                <div>
                  <p className="muted">Notes</p>
                  <strong>{customer.notes || '—'}</strong>
                </div>
              </div>

              <div className="ops-actions-row">
                <button type="button" className="secondary" onClick={openEditCustomer}>
                  Edit Customer
                </button>
                <button type="button" className="secondary" onClick={() => void startPackageOrder()} disabled={catalogOrderLoading}>
                  Start Package Order
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={!history[0] || repeatPendingOrderId !== null}
                  onClick={() => history[0] && void repeatOrder(history[0].id)}
                >
                  Repeat Last Order
                </button>
              </div>
            </div>
          ) : null}

          <h3>Order History</h3>
          <div className="customer-history-list">
            {history.map((order) => (
              <div key={order.id} className="customer-history-row">
                <div>
                  <strong>#{order.orderNumber}</strong>
                  <div className="muted">{formatDate(order.createdAt)}</div>
                  <div className="muted">{order.items.map((item) => item.productNameSnapshot).join(', ') || 'No items'}</div>
                </div>
                <div className="customer-history-meta">
                  <StatusBadge active={order.status !== 'CANCELLED'} activeLabel={order.status} inactiveLabel={order.status} />
                  <strong>{formatMoney(order.grandTotal)}</strong>
                  <button
                    type="button"
                    className="secondary"
                    disabled={repeatPendingOrderId === order.id}
                    onClick={() => void repeatOrder(order.id)}
                  >
                    {repeatPendingOrderId === order.id ? 'Repeating...' : 'Repeat'}
                  </button>
                </div>
              </div>
            ))}
            {history.length === 0 ? <p className="muted">No order history yet.</p> : null}
          </div>
        </section>

        <section className="page-card">
          <h2>Active Package Order</h2>
          {catalogOrderError ? <p className="error">{catalogOrderError}</p> : null}
          {!activeOrder ? (
            <p className="muted">Start or repeat order from customer detail to activate package flow.</p>
          ) : (
            <div className="customer-detail-stack">
              <div className="detail-grid">
                <div>
                  <p className="muted">Order</p>
                  <strong>#{activeOrder.orderNumber}</strong>
                </div>
                <div>
                  <p className="muted">Status</p>
                  <strong>{activeOrder.status}</strong>
                </div>
                <div>
                  <p className="muted">Total</p>
                  <strong>{formatMoney(activeOrder.grandTotal)}</strong>
                </div>
                <div>
                  <p className="muted">Items</p>
                  <strong>{activeOrder.items.length}</strong>
                </div>
              </div>

              <div className="ops-actions-row">
                {quickProducts.slice(0, 2).map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="secondary"
                    disabled={catalogOrderLoading}
                    onClick={() => void addQuickItem(product.id)}
                  >
                    + {product.name}
                  </button>
                ))}
                <button type="button" className="secondary" disabled={catalogOrderLoading || activeOrder.items.length === 0} onClick={() => void sendActiveOrder()}>
                  Send Order
                </button>
                <button type="button" className="secondary" onClick={() => navigate(`/finance/orders/${activeOrder.id}`)}>
                  Open Finance / Payment
                </button>
              </div>

              <div className="customer-history-list">
                {activeOrder.items.map((item) => (
                  <div key={item.id} className="customer-history-row">
                    <div>
                      <strong>{item.productNameSnapshot}</strong>
                      <div className="muted">Qty: {Number(item.quantity)}</div>
                    </div>
                    <strong>{formatMoney(item.lineTotal)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {customerModalOpen ? (
        <Modal title={editingCustomer ? 'Edit Customer' : 'New Customer'} onClose={() => setCustomerModalOpen(false)}>
          <div className="form-grid">
            <label>
              Full Name
              <input
                value={customerForm.fullName}
                onChange={(event) => setCustomerForm((prev) => ({ ...prev, fullName: event.target.value }))}
              />
            </label>
            <div className="form-row">
              <label>
                Phone 1
                <input
                  value={customerForm.phonePrimary}
                  onChange={(event) => setCustomerForm((prev) => ({ ...prev, phonePrimary: event.target.value }))}
                />
              </label>
              <label>
                Phone 2
                <input
                  value={customerForm.phoneSecondary}
                  onChange={(event) => setCustomerForm((prev) => ({ ...prev, phoneSecondary: event.target.value }))}
                />
              </label>
              <label>
                Phone 3
                <input
                  value={customerForm.phoneTertiary}
                  onChange={(event) => setCustomerForm((prev) => ({ ...prev, phoneTertiary: event.target.value }))}
                />
              </label>
            </div>
            <label>
              Address
              <input
                value={customerForm.addressLine}
                onChange={(event) => setCustomerForm((prev) => ({ ...prev, addressLine: event.target.value }))}
              />
            </label>
            <label>
              Notes
              <textarea
                value={customerForm.notes}
                onChange={(event) => setCustomerForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={customerForm.isActive}
                onChange={(event) => setCustomerForm((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
              Active
            </label>
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setCustomerModalOpen(false)}>
                Cancel
              </button>
              <button type="button" onClick={() => void submitCustomer()} disabled={customerSubmitPending}>
                {customerSubmitPending ? 'Saving...' : 'Save Customer'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
