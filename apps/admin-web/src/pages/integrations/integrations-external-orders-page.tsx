import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  integrationsExternalOrdersApi,
  integrationsProvidersApi,
  type ExternalOrder,
  type ExternalOrderIngestionStatus,
  type IntegrationProvider,
} from '../../api';
import { useBranchContext } from '../../app/branch-context';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, Modal, PageHeader, SectionCard } from '../../components';
import { IngestionStatusBadge } from './components/integration-badges';

const ingestionStatuses: ExternalOrderIngestionStatus[] = [
  'RECEIVED',
  'NORMALIZED',
  'CREATED_INTERNAL_ORDER',
  'FAILED',
];

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function IntegrationsExternalOrdersPage() {
  const { branches, effectiveBranchId } = useBranchContext();
  const [orders, setOrders] = useState<ExternalOrder[]>([]);
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchExternalOrderId, setSearchExternalOrderId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<ExternalOrder | null>(null);

  const providerMap = useMemo(() => new Map(providers.map((provider) => [provider.id, provider])), [providers]);
  const branchMap = useMemo(() => new Map(branches.map((branch) => [branch.id, branch])), [branches]);

  const loadOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [providerData, orderData] = await Promise.all([
        integrationsProvidersApi.list(),
        integrationsExternalOrdersApi.list(
          {
            providerId: selectedProviderId === 'all' ? undefined : selectedProviderId,
            ingestionStatus:
              selectedStatus === 'all' ? undefined : (selectedStatus as ExternalOrderIngestionStatus),
            externalOrderId: searchExternalOrderId.trim() || undefined,
            limit: 200,
          },
          effectiveBranchId ?? undefined,
        ),
      ]);
      setProviders(providerData);
      setOrders(orderData);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, [effectiveBranchId, selectedProviderId, selectedStatus]);

  const openDetail = async (order: ExternalOrder) => {
    try {
      const detail = await integrationsExternalOrdersApi.getById(order.id, effectiveBranchId ?? undefined);
      setDetailOrder(detail);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  return (
    <div className="catalog-content">
      <PageHeader
        title="External Orders"
        description="Audit external ingestion records and linked internal orders."
        actions={
          <button type="button" className="secondary" onClick={loadOrders}>
            Refresh
          </button>
        }
      />

      <SectionCard>
        <div className="table-toolbar">
          <label className="inline-field">
            Provider
            <select value={selectedProviderId} onChange={(event) => setSelectedProviderId(event.target.value)}>
              <option value="all">All</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            Ingestion
            <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
              <option value="all">All</option>
              {ingestionStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            External Order ID
            <input
              value={searchExternalOrderId}
              onChange={(event) => setSearchExternalOrderId(event.target.value)}
              placeholder="Search external order id"
            />
          </label>
          <button type="button" className="secondary" onClick={loadOrders}>
            Apply
          </button>
        </div>

        <DataState
          isLoading={isLoading}
          error={error}
          empty={!isLoading && orders.length === 0}
          emptyMessage="No external orders found for this scope."
        />

        {!isLoading && orders.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Branch</th>
                  <th>External Order</th>
                  <th>Status</th>
                  <th>Service</th>
                  <th>Ingestion</th>
                  <th>Internal Order</th>
                  <th>Failure</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.provider?.name ?? providerMap.get(order.providerId)?.name ?? order.providerId}</td>
                    <td>{branchMap.get(order.branchId)?.name ?? order.branchId}</td>
                    <td>
                      <div className="title-stack">
                        <strong>{order.externalOrderId}</strong>
                        <span className="muted">{order.externalStatus}</span>
                      </div>
                    </td>
                    <td>{order.externalStatus}</td>
                    <td>{order.serviceType}</td>
                    <td>
                      <IngestionStatusBadge value={order.ingestionStatus} />
                    </td>
                    <td>
                      {order.internalOrderId ? (
                        <Link className="branch-link-button" to={`/finance/orders/${order.internalOrderId}`}>
                          {order.internalOrder?.orderNumber ?? order.internalOrderId}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="muted">{order.failureReason ?? '—'}</td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td className="table-actions">
                      <button type="button" className="secondary" onClick={() => void openDetail(order)}>
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </SectionCard>

      {detailOrder ? (
        <Modal title="External Order Detail" onClose={() => setDetailOrder(null)}>
          <div className="form-grid">
            <p>
              <strong>External Order:</strong> {detailOrder.externalOrderId}
            </p>
            <p>
              <strong>Provider:</strong>{' '}
              {detailOrder.provider?.name ?? providerMap.get(detailOrder.providerId)?.name ?? detailOrder.providerId}
            </p>
            <p>
              <strong>Branch:</strong> {branchMap.get(detailOrder.branchId)?.name ?? detailOrder.branchId}
            </p>
            <p>
              <strong>Ingestion:</strong> <IngestionStatusBadge value={detailOrder.ingestionStatus} />
            </p>
            <p className="muted">Failure: {detailOrder.failureReason ?? '—'}</p>
            <p className="muted">Created: {formatDate(detailOrder.createdAt)}</p>
            <div>
              <p className="muted">Normalized JSON</p>
              <pre className="integration-json-view">
                {JSON.stringify(detailOrder.normalizedJson ?? {}, null, 2)}
              </pre>
            </div>
            <div>
              <p className="muted">Raw Payload JSON</p>
              <pre className="integration-json-view">
                {JSON.stringify(detailOrder.payloadJson ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
