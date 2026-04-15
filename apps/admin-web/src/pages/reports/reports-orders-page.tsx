import { useEffect, useMemo, useState } from 'react';
import { reportsOrdersApi } from '../../api';
import type { OrdersSummaryResponse } from '../../api/reports-orders.api';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, MetricCard, PageHeader, QuickLink, SectionCard } from '../../components';

export function ReportsOrdersPage() {
  const [summary, setSummary] = useState<OrdersSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await reportsOrdersApi.getSummary();
      setSummary(snapshot);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  const statusCounts = useMemo(() => summary?.orderCountByStatus ?? {}, [summary]);

  return (
    <div className="catalog-content">
      <PageHeader
        title="Orders Report"
        description="Operational order visibility using the latest order records."
        actions={
          <button type="button" className="secondary" onClick={loadOrders}>
            Refresh
          </button>
        }
      />

      <DataState
        isLoading={isLoading}
        error={error}
        empty={!isLoading && !summary}
        emptyMessage="No orders are available to report yet."
      />

      {!isLoading && summary ? (
        <>
          <SectionCard title="Order Status Distribution" subtitle="Counts from the latest order list.">
            <div className="metric-grid">
              {Object.entries(statusCounts).map(([status, count]) => (
                <MetricCard key={status} label={status} value={`${count}`} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Orders Drill-Down" subtitle="Use finance orders for detailed payment history.">
            <div className="quick-links">
              <QuickLink to="/finance/orders" title="Finance Orders" description="Open detailed order payment history." />
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
