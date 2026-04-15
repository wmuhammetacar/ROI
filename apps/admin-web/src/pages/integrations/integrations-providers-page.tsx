import { useEffect, useMemo, useState } from 'react';
import {
  integrationsProvidersApi,
  integrationsTestIngestApi,
  type IntegrationProvider,
  type TestIngestOrderResponse,
} from '../../api';
import { useBranchContext } from '../../app/branch-context';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, Modal, PageHeader, SectionCard, StatusBadge } from '../../components';
import { ProviderTypeBadge } from './components/integration-badges';

function buildDefaultPayload() {
  return JSON.stringify(
    {
      orderId: `mock-${Date.now()}`,
      status: 'RECEIVED',
      serviceType: 'DELIVERY',
      customer: { name: 'Test Customer', phone: '+90-555-000-0000' },
      notes: 'Admin test ingest',
      items: [{ itemId: 'external-item-1', name: 'Croissant', qty: 1 }],
      metadata: { source: 'admin-test-ui' },
    },
    null,
    2,
  );
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function IntegrationsProvidersPage() {
  const { branches, effectiveBranchId } = useBranchContext();
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [ingestProviderId, setIngestProviderId] = useState('');
  const [ingestBranchId, setIngestBranchId] = useState('');
  const [payloadText, setPayloadText] = useState(buildDefaultPayload());
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingestResult, setIngestResult] = useState<TestIngestOrderResponse | null>(null);
  const [isSubmittingIngest, setIsSubmittingIngest] = useState(false);

  const providerMap = useMemo(() => {
    return new Map(providers.map((provider) => [provider.id, provider]));
  }, [providers]);

  const loadProviders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await integrationsProvidersApi.list();
      setProviders(data);
      if (!ingestProviderId && data.length > 0) {
        setIngestProviderId(data[0].id);
      }
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProviders();
  }, []);

  useEffect(() => {
    setIngestBranchId(effectiveBranchId ?? branches[0]?.id ?? '');
  }, [branches, effectiveBranchId]);

  const openIngestModal = (providerId?: string) => {
    if (providerId) {
      setIngestProviderId(providerId);
    } else if (!ingestProviderId && providers[0]) {
      setIngestProviderId(providers[0].id);
    }
    setPayloadText(buildDefaultPayload());
    setIngestError(null);
    setIngestResult(null);
    setIsIngestModalOpen(true);
  };

  const submitTestIngest = async () => {
    setIsSubmittingIngest(true);
    setIngestError(null);
    setIngestResult(null);

    try {
      if (!ingestProviderId) {
        throw new Error('Select a provider first.');
      }

      const parsedPayload = JSON.parse(payloadText) as Record<string, unknown>;
      const result = await integrationsTestIngestApi.ingestOrder(ingestProviderId, {
        branchId: ingestBranchId || undefined,
        payload: parsedPayload,
      });
      setIngestResult(result);
    } catch (err) {
      setIngestError(toErrorMessage(err));
    } finally {
      setIsSubmittingIngest(false);
    }
  };

  return (
    <div className="catalog-content">
      <PageHeader
        title="Integration Providers"
        description="Visibility for configured provider definitions and test ingestion entrypoint."
        actions={
          <>
            <button type="button" className="secondary" onClick={loadProviders}>
              Refresh
            </button>
            <button type="button" onClick={() => openIngestModal()}>
              Test Ingest
            </button>
          </>
        }
      />

      <SectionCard>
        <DataState
          isLoading={isLoading}
          error={error}
          empty={!isLoading && providers.length === 0}
          emptyMessage="No integration providers are available."
        />

        {!isLoading && providers.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {providers.map((provider) => (
                  <tr key={provider.id}>
                    <td>{provider.name}</td>
                    <td>{provider.code}</td>
                    <td>
                      <ProviderTypeBadge value={provider.providerType} />
                    </td>
                    <td>
                      <StatusBadge
                        active={provider.isActive}
                        activeLabel="Active"
                        inactiveLabel="Inactive"
                      />
                    </td>
                    <td>{formatDate(provider.updatedAt)}</td>
                    <td className="table-actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => openIngestModal(provider.id)}
                      >
                        Test Ingest
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </SectionCard>

      {isIngestModalOpen ? (
        <Modal title="Test Ingest Order" onClose={() => (!isSubmittingIngest ? setIsIngestModalOpen(false) : null)}>
          <div className="form-grid">
            <label>
              Provider
              <select
                value={ingestProviderId}
                onChange={(event) => setIngestProviderId(event.target.value)}
                disabled={isSubmittingIngest}
              >
                <option value="">Select provider</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} ({provider.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Branch
              <select
                value={ingestBranchId}
                onChange={(event) => setIngestBranchId(event.target.value)}
                disabled={isSubmittingIngest}
              >
                <option value="">Use signed-in branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Test Payload (JSON)
              <textarea
                className="integration-json-input"
                value={payloadText}
                onChange={(event) => setPayloadText(event.target.value)}
                spellCheck={false}
              />
            </label>
            {ingestError ? <p className="error">{ingestError}</p> : null}
            {ingestResult ? (
              <div className="integration-json-result">
                <p>
                  <strong>Result:</strong>{' '}
                  {ingestResult.duplicate ? 'Duplicate external order found.' : 'Ingestion completed.'}
                </p>
                <p className="muted">
                  Provider:{' '}
                  {providerMap.get(ingestResult.externalOrder.providerId)?.name ??
                    ingestResult.externalOrder.providerId}
                  {' | '}
                  External Order: {ingestResult.externalOrder.externalOrderId}
                  {' | '}
                  Internal Order: {ingestResult.internalOrder?.orderNumber ?? ingestResult.externalOrder.internalOrderId ?? '—'}
                </p>
                <pre className="integration-json-view">
                  {JSON.stringify(ingestResult, null, 2)}
                </pre>
              </div>
            ) : null}
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setIsIngestModalOpen(false)}
                disabled={isSubmittingIngest}
              >
                Close
              </button>
              <button type="button" onClick={submitTestIngest} disabled={isSubmittingIngest}>
                {isSubmittingIngest ? 'Submitting...' : 'Submit Test Ingest'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
