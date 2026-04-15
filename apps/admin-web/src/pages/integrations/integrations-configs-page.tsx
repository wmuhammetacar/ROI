import { useEffect, useMemo, useState } from 'react';
import {
  integrationsConfigsApi,
  integrationsProvidersApi,
  type BranchIntegrationConfig,
  type BranchIntegrationConfigStatus,
  type IntegrationProvider,
} from '../../api';
import { useBranchContext } from '../../app/branch-context';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, Modal, PageHeader, SectionCard } from '../../components';
import { ConfigStatusBadge } from './components/integration-badges';

const configStatuses: BranchIntegrationConfigStatus[] = ['ACTIVE', 'INACTIVE', 'ERROR'];

const emptyFormState = {
  branchId: '',
  providerId: '',
  status: 'INACTIVE' as BranchIntegrationConfigStatus,
  credentialsText: '{}',
  settingsText: '{}',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function parseJsonField(value: string): Record<string, unknown> | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON field must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

export function IntegrationsConfigsPage() {
  const { branches, effectiveBranchId } = useBranchContext();
  const [configs, setConfigs] = useState<BranchIntegrationConfig[]>([]);
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<BranchIntegrationConfig | null>(null);
  const [detailConfig, setDetailConfig] = useState<BranchIntegrationConfig | null>(null);
  const [formState, setFormState] = useState(emptyFormState);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const providerMap = useMemo(() => new Map(providers.map((provider) => [provider.id, provider])), [providers]);
  const branchMap = useMemo(() => new Map(branches.map((branch) => [branch.id, branch])), [branches]);

  const loadConfigs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [providerData, configData] = await Promise.all([
        integrationsProvidersApi.list(),
        integrationsConfigsApi.list(
          {
            providerId: selectedProviderId === 'all' ? undefined : selectedProviderId,
            status: selectedStatus === 'all' ? undefined : (selectedStatus as BranchIntegrationConfigStatus),
            limit: 200,
          },
          effectiveBranchId ?? undefined,
        ),
      ]);

      setProviders(providerData);
      setConfigs(configData);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadConfigs();
  }, [effectiveBranchId, selectedProviderId, selectedStatus]);

  const openCreate = () => {
    setEditingConfig(null);
    setFormError(null);
    setFormState({
      ...emptyFormState,
      branchId: effectiveBranchId ?? branches[0]?.id ?? '',
      providerId: providers[0]?.id ?? '',
    });
    setIsModalOpen(true);
  };

  const openEdit = (config: BranchIntegrationConfig) => {
    setEditingConfig(config);
    setFormError(null);
    setFormState({
      branchId: config.branchId,
      providerId: config.providerId,
      status: config.status,
      credentialsText: JSON.stringify(config.credentialsJson ?? {}, null, 2),
      settingsText: JSON.stringify(config.settingsJson ?? {}, null, 2),
    });
    setIsModalOpen(true);
  };

  const openDetail = async (config: BranchIntegrationConfig) => {
    try {
      const detail = await integrationsConfigsApi.getById(config.id, effectiveBranchId ?? undefined);
      setDetailConfig(detail);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const submitConfig = async () => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      const credentialsJson = parseJsonField(formState.credentialsText);
      const settingsJson = parseJsonField(formState.settingsText);

      if (editingConfig) {
        await integrationsConfigsApi.update(editingConfig.id, {
          status: formState.status,
          credentialsJson,
          settingsJson,
        });
      } else {
        await integrationsConfigsApi.create({
          branchId: formState.branchId,
          providerId: formState.providerId,
          status: formState.status,
          credentialsJson,
          settingsJson,
        });
      }

      setIsModalOpen(false);
      await loadConfigs();
    } catch (err) {
      setFormError(toErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeStatus = async (config: BranchIntegrationConfig, status: BranchIntegrationConfigStatus) => {
    setUpdatingStatusId(config.id);
    try {
      await integrationsConfigsApi.updateStatus(config.id, status);
      await loadConfigs();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setUpdatingStatusId(null);
    }
  };

  return (
    <div className="catalog-content">
      <PageHeader
        title="Integration Configs"
        description="Branch-level provider credentials, settings, and lifecycle status."
        actions={
          <>
            <button type="button" className="secondary" onClick={loadConfigs}>
              Refresh
            </button>
            <button type="button" onClick={openCreate}>
              New Config
            </button>
          </>
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
            Status
            <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
              <option value="all">All</option>
              {configStatuses.map((status) => (
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
          empty={!isLoading && configs.length === 0}
          emptyMessage="No integration configs found for this scope."
        />

        {!isLoading && configs.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Last Sync</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {configs.map((config) => (
                  <tr key={config.id}>
                    <td>{config.provider?.name ?? providerMap.get(config.providerId)?.name ?? config.providerId}</td>
                    <td>{branchMap.get(config.branchId)?.name ?? config.branchId}</td>
                    <td>
                      <ConfigStatusBadge value={config.status} />
                    </td>
                    <td>{formatDate(config.lastSyncAt)}</td>
                    <td>{formatDate(config.updatedAt)}</td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="secondary" onClick={() => void openDetail(config)}>
                          Detail
                        </button>
                        <button type="button" className="secondary" onClick={() => openEdit(config)}>
                          Edit
                        </button>
                        {configStatuses.map((status) => (
                          <button
                            key={status}
                            type="button"
                            className="secondary"
                            disabled={status === config.status || updatingStatusId === config.id}
                            onClick={() => void changeStatus(config, status)}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </SectionCard>

      {isModalOpen ? (
        <Modal
          title={editingConfig ? 'Edit Integration Config' : 'New Integration Config'}
          onClose={() => (!isSubmitting ? setIsModalOpen(false) : null)}
        >
          <div className="form-grid">
            <label>
              Branch
              <select
                value={formState.branchId}
                disabled={Boolean(editingConfig)}
                onChange={(event) => setFormState((prev) => ({ ...prev, branchId: event.target.value }))}
              >
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Provider
              <select
                value={formState.providerId}
                disabled={Boolean(editingConfig)}
                onChange={(event) => setFormState((prev) => ({ ...prev, providerId: event.target.value }))}
              >
                <option value="">Select provider</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={formState.status}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    status: event.target.value as BranchIntegrationConfigStatus,
                  }))
                }
              >
                {configStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Credentials JSON
              <textarea
                className="integration-json-input"
                spellCheck={false}
                value={formState.credentialsText}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, credentialsText: event.target.value }))
                }
              />
            </label>
            <label>
              Settings JSON
              <textarea
                className="integration-json-input"
                spellCheck={false}
                value={formState.settingsText}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, settingsText: event.target.value }))
                }
              />
            </label>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button type="button" onClick={submitConfig} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Config'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {detailConfig ? (
        <Modal title="Integration Config Detail" onClose={() => setDetailConfig(null)}>
          <div className="form-grid">
            <p>
              <strong>Provider:</strong>{' '}
              {detailConfig.provider?.name ?? providerMap.get(detailConfig.providerId)?.name ?? detailConfig.providerId}
            </p>
            <p>
              <strong>Branch:</strong> {branchMap.get(detailConfig.branchId)?.name ?? detailConfig.branchId}
            </p>
            <p>
              <strong>Status:</strong> <ConfigStatusBadge value={detailConfig.status} />
            </p>
            <p className="muted">Last Sync: {formatDate(detailConfig.lastSyncAt)}</p>
            <p className="muted">Updated: {formatDate(detailConfig.updatedAt)}</p>
            <div>
              <p className="muted">Credentials JSON</p>
              <pre className="integration-json-view">
                {JSON.stringify(detailConfig.credentialsJson ?? {}, null, 2)}
              </pre>
            </div>
            <div>
              <p className="muted">Settings JSON</p>
              <pre className="integration-json-view">
                {JSON.stringify(detailConfig.settingsJson ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
