import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '@roi/shared-utils';
import { inventorySummaryApi, operationsApi, reportsDashboardApi } from '../api';
import type { ReportsDashboardSummary } from '../api/reports-dashboard.api';
import type { OperationsOverviewResponse } from '../api/operations.api';
import type { InventorySummary } from '../api/inventory-types';
import { useBranchContext } from '../app/branch-context';
import { toErrorMessage } from '../app/error-utils';
import { BranchScopeBanner, DataState, MetricCard, PageHeader, QuickLink, SectionCard } from '../components';
import { ADMIN_REALTIME_EVENTS, useAdminBranchRealtime } from '../realtime';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function amount(value: number | string | null | undefined) {
  if (value === null || value === undefined) return formatCurrency(0);
  return formatCurrency(Number(value));
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function riskLevel(score: number): 'healthy' | 'attention' | 'risk' {
  if (score >= 2) return 'risk';
  if (score === 1) return 'attention';
  return 'healthy';
}

export function DashboardPage() {
  const { effectiveBranchId } = useBranchContext();
  const [reports, setReports] = useState<ReportsDashboardSummary | null>(null);
  const [operations, setOperations] = useState<OperationsOverviewResponse | null>(null);
  const [inventory, setInventory] = useState<InventorySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [reportData, operationsData, inventoryData] = await Promise.all([
        reportsDashboardApi.getSummary(effectiveBranchId ?? undefined),
        operationsApi.getOverview(effectiveBranchId ?? undefined, 150),
        inventorySummaryApi.getSummary({ activeOnly: true, limit: 500 }, effectiveBranchId ?? undefined),
      ]);

      setReports(reportData);
      setOperations(operationsData);
      setInventory(inventoryData);
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
        [ADMIN_REALTIME_EVENTS.PRODUCTION_ITEM_UPDATED]: () => {
          void loadDashboard();
        },
      }),
      [loadDashboard],
    ),
  );

  const paymentTotals = reports?.paymentMixSnapshot.totalsByPaymentMethod ?? [];
  const salesSnapshot = operations?.salesSnapshot;
  const openOrderCount = salesSnapshot?.openOrderCount ?? 0;
  const completedOrderCount = salesSnapshot?.completedOrderCount ?? 0;
  const unpaidAmount = salesSnapshot?.activeUnpaidAmount ?? 0;
  const todayRevenue = salesSnapshot?.todayRevenue ?? 0;

  const activeTables = useMemo(
    () => operations?.tables.filter((table) => table.openSessionId !== null).length ?? 0,
    [operations],
  );
  const totalTables = operations?.tables.length ?? 0;
  const tableOccupancyRate = totalTables > 0 ? Math.round((activeTables / totalTables) * 100) : 0;

  const kitchen = operations?.kitchenBarStatus.KITCHEN ?? { queued: 0, inProgress: 0, ready: 0 };
  const bar = operations?.kitchenBarStatus.BAR ?? { queued: 0, inProgress: 0, ready: 0 };

  const lowStockCount = inventory?.lowStockCount ?? 0;
  const lowStockItems = useMemo(
    () => (inventory?.items ?? []).filter((item) => item.isLowStock).slice(0, 6),
    [inventory],
  );

  const refundedTotal = toNumber(reports?.salesSnapshot.summary.refundedTotal);
  const grossTotal = toNumber(reports?.salesSnapshot.summary.grossPaidTotal);
  const refundRatio = grossTotal > 0 ? (refundedTotal / grossTotal) * 100 : 0;

  const riskScore =
    (unpaidAmount > 0 ? 1 : 0) +
    (lowStockCount > 0 ? 1 : 0) +
    (refundRatio >= 20 ? 1 : 0) +
    (kitchen.queued + bar.queued >= 8 ? 1 : 0);
  const overall = riskLevel(riskScore >= 3 ? 2 : riskScore > 0 ? 1 : 0);

  const riskLabel =
    overall === 'healthy'
      ? 'Healthy'
      : overall === 'attention'
        ? 'Attention Needed'
        : 'Risk Elevated';

  return (
    <div className="catalog-content">
      <PageHeader
        title="Owner Control Surface"
        description="Revenue, operational load, production pressure, and risk visibility in one branch-scoped panel."
        actions={
          <button type="button" className="secondary" onClick={loadDashboard}>
            Refresh
          </button>
        }
      />

      <BranchScopeBanner sectionLabel="Owner Dashboard" />

      <DataState
        isLoading={isLoading}
        error={error}
        empty={!isLoading && (!reports || !operations || !inventory)}
        emptyMessage="Owner dashboard data is not available yet."
      />

      {!isLoading && reports && operations && inventory ? (
        <>
          <SectionCard title="Venue Pulse" subtitle="Fast-read global state for owner/manager decisions.">
            <div className="metric-grid">
              <MetricCard label="Overall State" value={riskLabel} helper={`Updated ${formatDate(operations.generatedAt)}`} />
              <MetricCard label="Today Revenue" value={amount(todayRevenue)} />
              <MetricCard label="Active Unpaid" value={amount(unpaidAmount)} helper={unpaidAmount > 0 ? 'Attention required' : 'No unpaid load'} />
              <MetricCard label="Low Stock Items" value={`${lowStockCount}`} helper={lowStockCount > 0 ? 'Inventory risk present' : 'No immediate stock risk'} />
            </div>
          </SectionCard>

          <SectionCard title="Revenue Snapshot" subtitle="Current branch revenue and order settlement state.">
            <div className="metric-grid">
              <MetricCard label="Today Revenue" value={amount(todayRevenue)} />
              <MetricCard label="Open Orders" value={`${openOrderCount}`} />
              <MetricCard label="Completed / Paid Today" value={`${completedOrderCount}`} />
              <MetricCard label="Active Unpaid Amount" value={amount(unpaidAmount)} helper={unpaidAmount > 0 ? 'Unsettled order value' : 'Fully settled'} />
            </div>
          </SectionCard>

          <SectionCard title="Payment Mix" subtitle="How money is flowing by payment method.">
            {paymentTotals.length > 0 ? (
              <div className="metric-grid">
                {paymentTotals.map((row) => (
                  <MetricCard
                    key={row.paymentMethod}
                    label={row.paymentMethod}
                    value={amount(row.net)}
                    helper={`Gross ${amount(row.gross)} | Refund ${amount(row.refunded)}`}
                  />
                ))}
              </div>
            ) : (
              <p className="muted">Payment mix will appear as transactions are processed.</p>
            )}
          </SectionCard>

          <SectionCard title="Operational Load" subtitle="Active table and order pressure.">
            <div className="metric-grid">
              <MetricCard label="Active Tables" value={`${activeTables}/${totalTables}`} helper={`${tableOccupancyRate}% occupancy`} />
              <MetricCard label="Active Orders" value={`${openOrderCount}`} />
              <MetricCard
                label="Open Shifts"
                value={`${reports.shiftSnapshot.openShiftCount}`}
                helper={`Latest shift: ${formatDate(reports.shiftSnapshot.recentShifts[0]?.openedAt ?? null)}`}
              />
              <MetricCard
                label="Recent Orders"
                value={`${operations.liveOrders.length}`}
                helper={operations.liveOrders[0] ? `Latest #${operations.liveOrders[0].orderNumber}` : 'No active orders'}
              />
            </div>
          </SectionCard>

          <SectionCard title="Production Pressure" subtitle="BAR and KITCHEN queue pressure for bottleneck detection.">
            <div className="metric-grid">
              <MetricCard label="BAR Queued" value={`${bar.queued}`} helper={`In Progress ${bar.inProgress} | Ready ${bar.ready}`} />
              <MetricCard
                label="KITCHEN Queued"
                value={`${kitchen.queued}`}
                helper={`In Progress ${kitchen.inProgress} | Ready ${kitchen.ready}`}
              />
              <MetricCard label="BAR Total Active" value={`${bar.queued + bar.inProgress + bar.ready}`} />
              <MetricCard label="KITCHEN Total Active" value={`${kitchen.queued + kitchen.inProgress + kitchen.ready}`} />
            </div>
          </SectionCard>

          <SectionCard title="Inventory Risk" subtitle="Low stock visibility with quick drill-down into stock desk.">
            <div className="metric-grid">
              <MetricCard label="Low Stock Count" value={`${lowStockCount}`} />
              <MetricCard label="Active Ingredients" value={`${inventory.activeIngredients}`} />
              <MetricCard label="Inactive Ingredients" value={`${inventory.inactiveIngredients}`} />
              <MetricCard label="Recent Movements (24h)" value={`${inventory.recentMovementCount24h}`} />
            </div>
            {lowStockItems.length > 0 ? (
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th>Current</th>
                      <th>Threshold</th>
                      <th>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.currentStock}</td>
                        <td>{item.lowStockThreshold}</td>
                        <td>{item.unit?.code ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Refund / Risk Visibility" subtitle="Financial and operational risk indicators.">
            <div className="metric-grid">
              <MetricCard label="Refunded Total" value={amount(refundedTotal)} />
              <MetricCard label="Refund Ratio" value={`${refundRatio.toFixed(1)}%`} helper={refundRatio >= 20 ? 'Attention: high refund ratio' : 'Within normal range'} />
              <MetricCard label="Unpaid Exposure" value={amount(unpaidAmount)} helper={unpaidAmount > 0 ? 'Outstanding orders open' : 'No current exposure'} />
              <MetricCard
                label="Queue Pressure"
                value={`${bar.queued + kitchen.queued}`}
                helper={bar.queued + kitchen.queued >= 8 ? 'Attention: queue buildup' : 'Queue level normal'}
              />
            </div>
          </SectionCard>

          <SectionCard title="Quick Navigation" subtitle="Jump directly from oversight to action.">
            <div className="quick-links">
              <QuickLink to="/operations" title="Operations Center" description="Live tables, orders, calls." />
              <QuickLink to="/finance/orders" title="Finance / Payments" description="Unpaid and settlement actions." />
              <QuickLink to="/inventory/summary" title="Inventory Desk" description="Low stock and adjustments." />
              <QuickLink to="/operations/customers" title="Customer Desk" description="Phone/package flow handling." />
              <QuickLink to="/catalog/products" title="Menu Management" description="Products, modifiers, routing." />
              <QuickLink to="/reports/sales" title="Detailed Reports" description="Sales and shift reporting." />
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
