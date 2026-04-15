import { useEffect, useMemo, useState } from 'react';
import { reportsInventoryApi } from '../../api';
import type { ReportsInventorySummaryResponse } from '../../api/reports-inventory.api';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, MetricCard, PageHeader, QuickLink, SectionCard, StatusBadge } from '../../components';
function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function ReportsInventoryPage() {
  const [summary, setSummary] = useState<ReportsInventorySummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInventory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await reportsInventoryApi.getSummary(10);
      setSummary(snapshot);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadInventory();
  }, []);

  const lowestStock = useMemo(() => summary?.lowestStockItems ?? [], [summary]);

  return (
    <div className="catalog-content">
      <PageHeader
        title="Inventory Report"
        description="Stock visibility, lowest stock items, and recent movements."
        actions={
          <button type="button" className="secondary" onClick={loadInventory}>
            Refresh
          </button>
        }
      />

      <DataState
        isLoading={isLoading}
        error={error}
        empty={!isLoading && !summary}
        emptyMessage="Inventory summary is not available yet."
      />

      {!isLoading && summary ? (
        <>
          <SectionCard title="Inventory Snapshot" subtitle="Active ingredients overview from reporting layer.">
            <div className="metric-grid">
              <MetricCard label="Total Ingredients" value={`${summary.totalIngredients}`} />
              <MetricCard label="Active Ingredients" value={`${summary.activeIngredients}`} />
              <MetricCard label="Inactive Ingredients" value={`${summary.inactiveIngredients}`} />
              <MetricCard label="Latest Waste" value={formatDate(summary.latestWasteAt)} />
            </div>
          </SectionCard>

          <SectionCard title="Lowest Stock Items" subtitle="Heuristic based on current stock values.">
            {lowestStock.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th>Stock</th>
                      <th>Unit</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowestStock.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.currentStock}</td>
                        <td>{item.unit?.code ?? '—'}</td>
                        <td>
                          <StatusBadge active={item.isActive} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No ingredient data available yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Inventory Drill-Down" subtitle="Open inventory detail views.">
            <div className="quick-links">
              <QuickLink to="/inventory/summary" title="Inventory Summary" description="Full ingredient list and actions." />
              <QuickLink to="/inventory/movements" title="Stock Movements" description="Audit movement history." />
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
