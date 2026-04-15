import { useEffect, useMemo, useState } from 'react';
import { reportsOperationsApi } from '../../api';
import type { ReportsOperationsSummaryResponse } from '../../api/reports-operations.api';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, MetricCard, PageHeader, QuickLink, SectionCard, StatusBadge } from '../../components';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function ReportsOperationsPage() {
  const [summary, setSummary] = useState<ReportsOperationsSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOperations = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await reportsOperationsApi.getSummary(5);
      setSummary(snapshot);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadOperations();
  }, []);

  const productionCounts = useMemo(() => summary?.productionStatusCounts ?? {}, [summary]);

  return (
    <div className="catalog-content">
      <PageHeader
        title="Operations Report"
        description="Shift status and operational order distribution using existing reads."
        actions={
          <button type="button" className="secondary" onClick={loadOperations}>
            Refresh
          </button>
        }
      />

      <DataState
        isLoading={isLoading}
        error={error}
        empty={!isLoading && !summary}
        emptyMessage="No operational data available yet."
      />

      {!isLoading && summary ? (
        <>
          <SectionCard title="Open Shifts" subtitle="Active cashier sessions for the branch.">
            {summary.openShiftCount === 0 ? <p className="muted">No open shifts.</p> : null}
            {summary.recentShifts.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Opened</th>
                      <th>Shift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentShifts.map((shift) => (
                      <tr key={shift.id}>
                        <td>
                          <StatusBadge active={shift.status === 'OPEN'} activeLabel="Open" inactiveLabel="Closed" />
                        </td>
                        <td>{formatDate(shift.openedAt)}</td>
                        <td>{shift.id.slice(0, 8)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Production Status Snapshot" subtitle="Kitchen ticket item status distribution.">
            {Object.keys(productionCounts).length > 0 ? (
              <div className="metric-grid">
                {Object.entries(productionCounts).map(([status, count]) => (
                  <MetricCard key={status} label={status} value={`${count}`} />
                ))}
              </div>
            ) : (
              <p className="muted">No production status data yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Operational Links" subtitle="Shortcuts into operations views.">
            <div className="quick-links">
              <QuickLink to="/stations" title="Stations" description="Station routing and configuration." />
              <QuickLink to="/finance/shifts" title="Shift Management" description="Register shifts and closures." />
              <QuickLink to="/finance/orders" title="Order Finance" description="Payment and refund history." />
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
