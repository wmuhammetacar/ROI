import { useEffect, useMemo, useState } from 'react';
import { reportsSalesApi } from '../../api';
import type { PaymentMixResponse, SalesSummaryResponse, ShiftsOverviewResponse } from '../../api/reports-sales.api';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, MetricCard, PageHeader, SectionCard } from '../../components';
import { formatCurrency } from '@roi/shared-utils';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatAmount(value?: string | number | null) {
  if (value === null || value === undefined) return '—';
  return formatCurrency(Number(value));
}

export function ReportsSalesPage() {
  const [salesSummary, setSalesSummary] = useState<SalesSummaryResponse | null>(null);
  const [paymentMix, setPaymentMix] = useState<PaymentMixResponse | null>(null);
  const [shiftsOverview, setShiftsOverview] = useState<ShiftsOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSales = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [salesData, paymentData, shiftsData] = await Promise.all([
        reportsSalesApi.getSalesSummary(),
        reportsSalesApi.getPaymentMix(),
        reportsSalesApi.getShiftsOverview(),
      ]);
      setSalesSummary(salesData);
      setPaymentMix(paymentData);
      setShiftsOverview(shiftsData);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSales();
  }, []);

  const totalsByMethod = paymentMix?.totalsByPaymentMethod ?? [];

  const aggregateTotals = useMemo(() => {
    if (!salesSummary) return null;
    return {
      gross: Number(salesSummary.summary.grossPaidTotal),
      refunded: Number(salesSummary.summary.refundedTotal),
      net: Number(salesSummary.summary.netPaidTotal),
    };
  }, [salesSummary]);

  return (
    <div className="catalog-content">
      <PageHeader
        title="Sales Report"
        description="Shift-level sales visibility using available settlement data."
        actions={
          <button type="button" className="secondary" onClick={loadSales}>
            Refresh
          </button>
        }
      />

      <DataState
        isLoading={isLoading}
        error={error}
        empty={!isLoading && !salesSummary}
        emptyMessage="Sales summary is not available yet."
      />

      {!isLoading && salesSummary ? (
        <>
          <SectionCard
            title="Sales Summary"
            subtitle={`Scope: ${salesSummary.scope.type}${salesSummary.scope.shiftId ? ` (${salesSummary.scope.shiftId.slice(0, 6)})` : ''}`}
          >
            {salesSummary ? (
              <div className="metric-grid">
                <MetricCard label="Gross Paid" value={formatAmount(salesSummary.summary.grossPaidTotal)} />
                <MetricCard label="Refunded" value={formatAmount(salesSummary.summary.refundedTotal)} />
                <MetricCard label="Net Paid" value={formatAmount(salesSummary.summary.netPaidTotal)} />
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Payment Method Breakdown" subtitle="From reporting payment mix summary.">
            {totalsByMethod.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>Gross</th>
                      <th>Refunded</th>
                      <th>Net</th>
                      <th>Transactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totalsByMethod.map((row) => (
                      <tr key={row.paymentMethod}>
                        <td>{row.paymentMethod}</td>
                        <td>{formatAmount(row.gross)}</td>
                        <td>{formatAmount(row.refunded)}</td>
                        <td>{formatAmount(row.net)}</td>
                        <td>{row.transactionCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No payment method totals are available yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Sales Totals" subtitle="Summary totals from reporting layer.">
            {aggregateTotals ? (
              <div className="metric-grid">
                <MetricCard label="Gross Total" value={formatAmount(aggregateTotals.gross)} />
                <MetricCard label="Refunded Total" value={formatAmount(aggregateTotals.refunded)} />
                <MetricCard label="Net Total" value={formatAmount(aggregateTotals.net)} />
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Shift Overview" subtitle="Recent closed shifts overview.">
            {shiftsOverview && shiftsOverview.recentShifts.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Shift</th>
                      <th>Opened At</th>
                      <th>Closed At</th>
                      <th>Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shiftsOverview.recentShifts.map((shift) => (
                      <tr key={shift.id}>
                        <td>{shift.id.slice(0, 8)}</td>
                        <td>{formatDate(shift.openedAt)}</td>
                        <td>{formatDate(shift.closedAt)}</td>
                        <td>{formatAmount(shift.varianceAmount ?? '0')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No recent closed shifts available yet.</p>
            )}
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
