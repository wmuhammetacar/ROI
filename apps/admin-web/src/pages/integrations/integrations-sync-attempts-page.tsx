import { useEffect, useMemo, useState } from 'react';
import {
  integrationsProvidersApi,
  integrationsSyncAttemptsApi,
  type IntegrationProvider,
  type IntegrationSyncAttempt,
  type IntegrationSyncDirection,
  type IntegrationSyncStatus,
} from '../../api';
import { useBranchContext } from '../../app/branch-context';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, Modal, PageHeader, SectionCard } from '../../components';
import { DirectionBadge, SyncStatusBadge } from './components/integration-badges';

const directions: IntegrationSyncDirection[] = ['INBOUND', 'OUTBOUND'];
const statuses: IntegrationSyncStatus[] = ['SUCCESS', 'FAILED', 'RETRY_PENDING'];

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function IntegrationsSyncAttemptsPage() {
  const { branches, effectiveBranchId } = useBranchContext();
  const [attempts, setAttempts] = useState<IntegrationSyncAttempt[]>([]);
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState('all');
  const [selectedDirection, setSelectedDirection] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailAttempt, setDetailAttempt] = useState<IntegrationSyncAttempt | null>(null);

  const providerMap = useMemo(() => new Map(providers.map((provider) => [provider.id, provider])), [providers]);
  const branchMap = useMemo(() => new Map(branches.map((branch) => [branch.id, branch])), [branches]);

  const loadAttempts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [providerData, attemptData] = await Promise.all([
        integrationsProvidersApi.list(),
        integrationsSyncAttemptsApi.list(
          {
            providerId: selectedProviderId === 'all' ? undefined : selectedProviderId,
            direction:
              selectedDirection === 'all' ? undefined : (selectedDirection as IntegrationSyncDirection),
            status: selectedStatus === 'all' ? undefined : (selectedStatus as IntegrationSyncStatus),
            limit: 200,
          },
          effectiveBranchId ?? undefined,
        ),
      ]);
      setProviders(providerData);
      setAttempts(attemptData);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAttempts();
  }, [effectiveBranchId, selectedProviderId, selectedDirection, selectedStatus]);

  return (
    <div className="catalog-content">
      <PageHeader
        title="Integration Sync Attempts"
        description="Inbound/outbound operation history with status and error visibility."
        actions={
          <button type="button" className="secondary" onClick={loadAttempts}>
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
            Direction
            <select value={selectedDirection} onChange={(event) => setSelectedDirection(event.target.value)}>
              <option value="all">All</option>
              {directions.map((direction) => (
                <option key={direction} value={direction}>
                  {direction}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            Status
            <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
              <option value="all">All</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <DataState
          isLoading={isLoading}
          error={error}
          empty={!isLoading && attempts.length === 0}
          emptyMessage="No sync attempts found for this scope."
        />

        {!isLoading && attempts.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Branch</th>
                  <th>Direction</th>
                  <th>Operation</th>
                  <th>Target</th>
                  <th>Status</th>
                  <th>Error</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>{attempt.provider?.name ?? providerMap.get(attempt.providerId)?.name ?? attempt.providerId}</td>
                    <td>{branchMap.get(attempt.branchId)?.name ?? attempt.branchId}</td>
                    <td>
                      <DirectionBadge value={attempt.direction} />
                    </td>
                    <td>{attempt.operation}</td>
                    <td>{attempt.targetId ?? '—'}</td>
                    <td>
                      <SyncStatusBadge value={attempt.status} />
                    </td>
                    <td className="muted">{attempt.errorMessage ?? '—'}</td>
                    <td>{formatDate(attempt.createdAt)}</td>
                    <td className="table-actions">
                      <button type="button" className="secondary" onClick={() => setDetailAttempt(attempt)}>
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

      {detailAttempt ? (
        <Modal title="Sync Attempt Detail" onClose={() => setDetailAttempt(null)}>
          <div className="form-grid">
            <p>
              <strong>Provider:</strong>{' '}
              {detailAttempt.provider?.name ??
                providerMap.get(detailAttempt.providerId)?.name ??
                detailAttempt.providerId}
            </p>
            <p>
              <strong>Direction:</strong> <DirectionBadge value={detailAttempt.direction} />
            </p>
            <p>
              <strong>Status:</strong> <SyncStatusBadge value={detailAttempt.status} />
            </p>
            <p className="muted">Operation: {detailAttempt.operation}</p>
            <p className="muted">Target: {detailAttempt.targetId ?? '—'}</p>
            <p className="muted">Error: {detailAttempt.errorMessage ?? '—'}</p>
            <div>
              <p className="muted">Request Payload</p>
              <pre className="integration-json-view">
                {JSON.stringify(detailAttempt.requestPayloadJson ?? {}, null, 2)}
              </pre>
            </div>
            <div>
              <p className="muted">Response Payload</p>
              <pre className="integration-json-view">
                {JSON.stringify(detailAttempt.responsePayloadJson ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
