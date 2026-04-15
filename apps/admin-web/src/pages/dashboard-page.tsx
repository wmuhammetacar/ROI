import { useCallback, useEffect, useMemo, useState } from 'react';
import { reportsDashboardApi } from '../api';
import type { ReportsDashboardSummary } from '../api/reports-dashboard.api';
import { useBranchContext } from '../app/branch-context';
import { toErrorMessage } from '../app/error-utils';
import { BranchScopeBanner, DataState, MetricCard, PageHeader, QuickLink, SectionCard, StatusBadge } from '../components';
import { formatCurrency } from '@roi/shared-utils';
import { ADMIN_REALTIME_EVENTS, useAdminBranchRealtime } from '../realtime';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatAmount(value?: string | number | null) {
  if (value === null || value === undefined) return '—';
  return formatCurrency(Number(value));
}

export function DashboardPage() {
  const { effectiveBranchId } = useBranchContext();
  const [snapshot, setSnapshot] = useState<ReportsDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await reportsDashboardApi.getSummary(effectiveBranchId ?? undefined);
      setSnapshot(data);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [effectiveBranchId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useAdminBranchRealtime(
    effectiveBranchId,
    useMemo(
      () => ({
        [ADMIN_REALTIME_EVENTS.ORDER_CREATED]: () => {
          void loadDashboard();
        },
        [ADMIN_REALTIME_EVENTS.ORDER_STATUS_CHANGED]: () => {
          void loadDashboard();
        },
        [ADMIN_REALTIME_EVENTS.PAYMENT_RECORDED]: () => {
          void loadDashboard();
        },
        [ADMIN_REALTIME_EVENTS.ORDER_PAID]: () => {
          void loadDashboard();
        },
        [ADMIN_REALTIME_EVENTS.PUBLIC_ORDER_SUBMITTED]: () => {
          void loadDashboard();
        },
      }),
      [loadDashboard],
    ),
  );

  const latestSummary = snapshot?.salesSnapshot;
  const paymentTotals = snapshot?.paymentMixSnapshot.totalsByPaymentMethod ?? [];

  const orderStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const orderCounts = snapshot?.ordersSnapshot.orderCountByStatus ?? {};
    Object.entries(orderCounts).forEach(([status, count]) => {
      counts[status] = count;
    });
    return counts;
  }, [snapshot]);

  const lowestStock = useMemo(() => {
    return snapshot?.inventoryRiskSnapshot.lowestStockItems ?? [];
  }, [snapshot]);

  return (
    <div className="catalog-content">
      <PageHeader
        title="Owner Dashboard"
        description="Live operational visibility from today’s activity."
        actions={
          <button type="button" className="secondary" onClick={loadDashboard}>
            Refresh
          </button>
        }
      />

      <BranchScopeBanner sectionLabel="Dashboard" />

      <DataState
        isLoading={isLoading}
        error={error}
        empty={!isLoading && !snapshot}
        emptyMessage="Dashboard data is not available yet."
      />

      {!isLoading && snapshot ? (
        <>
          <SectionCard title="Daily Sales Snapshot" subtitle="Based on reporting sales summary.">
            {latestSummary ? (
              <div className="metric-grid">
                <MetricCard label="Gross Paid" value={formatAmount(latestSummary.summary.grossPaidTotal)} />
                <MetricCard label="Refunded" value={formatAmount(latestSummary.summary.refundedTotal)} />
                <MetricCard label="Net Paid" value={formatAmount(latestSummary.summary.netPaidTotal)} />
              </div>
            ) : (
              <p className="muted">No closed shift summary is available yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Payment Method Snapshot" subtitle="Distribution from the latest closed shift.">
            {paymentTotals.length > 0 ? (
              <div className="metric-grid">
                {paymentTotals.map((row) => (
                  <MetricCard
                    key={row.paymentMethod}
                    label={row.paymentMethod}
                    value={formatAmount(row.net)}
                    helper={`Gross ${formatAmount(row.gross)} | Refunds ${formatAmount(row.refunded)}`}
                  />
                ))}
              </div>
            ) : (
              <p className="muted">Payment method totals will appear after a shift closes.</p>
            )}
          </SectionCard>

          <SectionCard title="Shift Snapshot" subtitle="Open shift visibility and recent closure.">
            <div className="detail-grid">
              <div>
                <p className="muted">Open Shifts</p>
                <strong>{snapshot.shiftSnapshot.openShiftCount}</strong>
              </div>
              <div>
                <p className="muted">Latest Closed Shift</p>
                <strong>{snapshot.shiftSnapshot.recentShifts[0]?.id.slice(0, 8) ?? '—'}</strong>
                <p className="muted">Closed {formatDate(snapshot.shiftSnapshot.recentShifts[0]?.closedAt)}</p>
              </div>
            </div>
            {snapshot.shiftSnapshot.openShifts.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Opened</th>
                      <th>Opened By</th>
                      <th>Opening Cash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.shiftSnapshot.openShifts.map((shift) => (
                      <tr key={shift.id}>
                        <td>
                          <StatusBadge active={shift.status === 'OPEN'} activeLabel="Open" inactiveLabel="Closed" />
                        </td>
                        <td>{formatDate(shift.openedAt)}</td>
                        <td>{shift.openedByUser?.name ?? shift.openedByUserId}</td>
                        <td>{formatAmount(shift.openingCashAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Inventory Alert Snapshot" subtitle="Lowest stock items (heuristic).">
            {lowestStock.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table compact">
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
              <p className="muted">Inventory items will appear after ingredients are configured.</p>
            )}
          </SectionCard>

          <SectionCard title="Order Status Snapshot" subtitle="Current operational distribution from reporting summary.">
            {Object.keys(orderStatusCounts).length > 0 ? (
              <div className="metric-grid">
                {Object.entries(orderStatusCounts).map(([status, count]) => (
                  <MetricCard key={status} label={status} value={`${count}`} />
                ))}
              </div>
            ) : (
              <p className="muted">Order distribution is not available yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Quick Links" subtitle="Jump into finance and operational workflows.">
            <div className="quick-links">
              <QuickLink to="/finance/shifts" title="Finance Shifts" description="Review register shifts." />
              <QuickLink to="/finance/orders" title="Finance Orders" description="Inspect payments and refunds." />
              <QuickLink to="/inventory/summary" title="Inventory Summary" description="Stock visibility and alerts." />
              <QuickLink to="/inventory/movements" title="Stock Movements" description="Audit stock activity." />
              <QuickLink to="/catalog/pos-preview" title="Catalog Preview" description="Validate POS catalog payload." />
              <QuickLink to="/reports/sales" title="Sales Report" description="Shift-level sales snapshot." />
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
