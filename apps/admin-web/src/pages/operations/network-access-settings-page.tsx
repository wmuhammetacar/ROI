import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { branchesApi } from '../../api';
import { useBranchContext } from '../../app/branch-context';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, PageHeader } from '../../components';

export function NetworkAccessSettingsPage() {
  const { effectiveBranchId } = useBranchContext();
  const [cidrInput, setCidrInput] = useState('');
  const [allowedCidrs, setAllowedCidrs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!effectiveBranchId) return;
    setIsLoading(true);
    setError(null);
    try {
      const branches = await branchesApi.list();
      const current = branches.find((branch) => branch.id === effectiveBranchId);
      setAllowedCidrs(current?.allowedNetworkCidrs ?? []);
      setCidrInput((current?.allowedNetworkCidrs ?? []).join('\n'));
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [effectiveBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const parsedCidrs = useMemo(
    () => Array.from(new Set(cidrInput.split('\n').map((item) => item.trim()).filter(Boolean))),
    [cidrInput],
  );

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!effectiveBranchId) return;
    setIsSaving(true);
    setError(null);

    try {
      const updated = await branchesApi.updateNetworkSettings(effectiveBranchId, parsedCidrs);
      setAllowedCidrs(updated.allowedNetworkCidrs ?? []);
      setCidrInput((updated.allowedNetworkCidrs ?? []).join('\n'));
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="catalog-content">
      <PageHeader
        title="Network Access Settings"
        description="Allow only venue network CIDRs for internal staff/admin operations."
      />

      <DataState
        isLoading={isLoading}
        error={error}
        empty={false}
        emptyMessage=""
      />

      <section className="page-card form-grid">
        <h3>Allowed CIDR / Subnet List</h3>
        <p className="muted">
          One CIDR per line. Example: 192.168.1.0/24 or 10.0.0.15/32. Empty list means unrestricted.
        </p>
        <form className="form-grid" onSubmit={handleSave}>
          <textarea value={cidrInput} onChange={(e) => setCidrInput(e.target.value)} rows={10} />
          <div className="form-actions">
            <button type="submit" className="secondary" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Network Policy'}
            </button>
          </div>
        </form>
      </section>

      <section className="page-card">
        <h3>Current Effective Allow List</h3>
        {allowedCidrs.length > 0 ? (
          <ul>
            {allowedCidrs.map((cidr) => (
              <li key={cidr}>{cidr}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No CIDRs configured. Internal endpoints are not IP-restricted for this branch.</p>
        )}
      </section>
    </div>
  );
}
