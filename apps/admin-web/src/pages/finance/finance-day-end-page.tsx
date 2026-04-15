import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { financeDayEndApi } from '../../api';
import type { RegisterShift, RegisterShiftSummaryResponse } from '../../api/finance-types';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, PageHeader, SectionCard, StatusBadge } from '../../components';
import { formatCurrency } from '@roi/shared-utils';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatAmount(value?: string | null) {
  if (!value) return '—';
  return formatCurrency(Number(value));
}

export function FinanceDayEndPage() {
  const [openShifts, setOpenShifts] = useState<RegisterShift[]>([]);
  const [closedShifts, setClosedShifts] = useState<RegisterShift[]>([]);
  const [latestSummary, setLatestSummary] = useState<RegisterShiftSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadDayEnd = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [openData, closedData] = await Promise.all([
        financeDayEndApi.listOpenShifts(5),
        financeDayEndApi.listClosedShifts(8),
      ]);
      setOpenShifts(openData);
      setClosedShifts(closedData);

      if (closedData.length > 0) {
        const summary = await financeDayEndApi.getShiftSummary(closedData[0].id);
        setLatestSummary(summary);
      } else {
        setLatestSummary(null);
      }
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDayEnd();
  }, []);

  const latestTotals = useMemo(() => latestSummary?.summary.totalsByPaymentMethod ?? [], [latestSummary]);

  return (
    <div className="catalog-content">
      <PageHeader
        title="Day-End Overview"
        description="Monitor open shifts and recent closure summaries for operational control."
        actions={
          <button type="button" className="secondary" onClick={loadDayEnd}>
            Refresh
          </button>
        }
      />

      <DataState
        isLoading={isLoading}
        error={error}
        empty={!isLoading && openShifts.length === 0 && closedShifts.length === 0}
        emptyMessage="No register shifts available yet."
      />

      {!isLoading ? (
        <>
          <SectionCard title="Open Shifts" subtitle="Active cashier sessions currently open.">
            {openShifts.length === 0 ? <p className="muted">No open shifts.</p> : null}
            {openShifts.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Opened</th>
                      <th>Opened By</th>
                      <th>Opening Cash</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {openShifts.map((shift) => (
                      <tr key={shift.id}>
                        <td>
                          <StatusBadge active={shift.status === 'OPEN'} activeLabel="Open" inactiveLabel="Closed" />
                        </td>
                        <td>{formatDate(shift.openedAt)}</td>
                        <td>{shift.openedByUser?.name ?? shift.openedByUserId}</td>
                        <td>{formatAmount(shift.openingCashAmount)}</td>
                        <td className="table-actions">
                          <button type="button" className="secondary" onClick={() => navigate(`/finance/shifts/${shift.id}`)}>
                            View Shift
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Latest Closed Shift" subtitle="Most recent closed shift snapshot.">
            {latestSummary ? (
              <div className="detail-grid">
                <div>
                  <p className="muted">Shift</p>
                  <strong>{latestSummary.shift.id.slice(0, 8)}</strong>
                </div>
                <div>
                  <p className="muted">Closed At</p>
                  <strong>{formatDate(latestSummary.shift.closedAt)}</strong>
                </div>
                <div>
                  <p className="muted">Gross Paid</p>
                  <strong>{formatAmount(latestSummary.summary.grossPaidTotal)}</strong>
                </div>
                <div>
                  <p className="muted">Refunded</p>
                  <strong>{formatAmount(latestSummary.summary.refundedTotal)}</strong>
                </div>
                <div>
                  <p className="muted">Net Paid</p>
                  <strong>{formatAmount(latestSummary.summary.netPaidTotal)}</strong>
                </div>
                <div>
                  <p className="muted">Expected Cash</p>
                  <strong>{formatAmount(latestSummary.summary.expectedCashAmount)}</strong>
                </div>
              </div>
            ) : (
              <p className="muted">No closed shifts available yet.</p>
            )}

            {latestTotals.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table compact">
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
                    {latestTotals.map((row) => (
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
            ) : null}
          </SectionCard>

          <SectionCard title="Recent Closed Shifts" subtitle="Quick access to recent shift closures.">
            {closedShifts.length === 0 ? <p className="muted">No closed shifts yet.</p> : null}
            {closedShifts.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Shift</th>
                      <th>Opened</th>
                      <th>Closed</th>
                      <th>Opening Cash</th>
                      <th>Variance</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedShifts.map((shift) => (
                      <tr key={shift.id}>
                        <td>{shift.id.slice(0, 8)}</td>
                        <td>{formatDate(shift.openedAt)}</td>
                        <td>{formatDate(shift.closedAt)}</td>
                        <td>{formatAmount(shift.openingCashAmount)}</td>
                        <td>{formatAmount(shift.varianceAmount)}</td>
                        <td className="table-actions">
                          <button type="button" className="secondary" onClick={() => navigate(`/finance/shifts/${shift.id}`)}>
                            View Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
