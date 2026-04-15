import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { financeOrdersApi } from '../../api';
import type { OrderSummary } from '../../api/finance-types';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, PageHeader, SectionCard } from '../../components';
import { formatCurrency } from '@roi/shared-utils';

const orderStatuses = [
  'DRAFT',
  'PLACED',
  'SENT_TO_STATION',
  'PREPARING',
  'READY',
  'SERVED',
  'BILLED',
  'PAID',
  'CANCELLED',
];

const serviceTypes = ['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'QUICK_SALE'];

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatAmount(value?: string | null) {
  if (!value) return '—';
  return formatCurrency(Number(value));
}

export function FinanceOrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [searchId, setSearchId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadOrders = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const serviceType = serviceFilter === 'all' ? undefined : serviceFilter;
      const data = await financeOrdersApi.list({ status, serviceType, limit: 200 });
      setOrders(data);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, [statusFilter, serviceFilter]);

  const handleSearchNavigate = () => {
    if (searchId.trim()) {
      navigate(`/finance/orders/${searchId.trim()}`);
    }
  };

  return (
    <div className="catalog-content">
      <PageHeader
        title="Finance Orders"
        description="Inspect orders with payment history, refunds, and settlement status."
        actions={
          <button type="button" className="secondary" onClick={loadOrders}>
            Refresh
          </button>
        }
      />

      <SectionCard>
        <div className="table-toolbar">
          <label className="inline-field">
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All</option>
              {orderStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            Service
            <select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}>
              <option value="all">All</option>
              {serviceTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            Order ID
            <input
              value={searchId}
              onChange={(event) => setSearchId(event.target.value)}
              placeholder="Paste order id"
            />
          </label>
          <button type="button" className="secondary" onClick={handleSearchNavigate}>
            Go
          </button>
        </div>

        <DataState
          isLoading={isLoading}
          error={error}
          empty={!isLoading && orders.length === 0}
          emptyMessage="No orders found for the selected filter."
        />

        {!isLoading && orders.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Service</th>
                  <th>Grand Total</th>
                  <th>Billed</th>
                  <th>Paid</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <div className="title-stack">
                        <strong>{order.orderNumber ?? order.id.slice(0, 8)}</strong>
                        <span className="muted">{order.id}</span>
                      </div>
                    </td>
                    <td>{order.status}</td>
                    <td>{order.serviceType ?? '—'}</td>
                    <td>{formatAmount(order.grandTotal)}</td>
                    <td>{formatDate(order.billedAt)}</td>
                    <td>{formatDate(order.paidAt)}</td>
                    <td className="table-actions">
                      <button type="button" className="secondary" onClick={() => navigate(`/finance/orders/${order.id}`)}>
                        View Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
