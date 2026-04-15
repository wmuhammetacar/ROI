import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { financeShiftsApi } from '../../api';
import type { RegisterShift } from '../../api/finance-types';
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

export function FinanceShiftsPage() {
  const [shifts, setShifts] = useState<RegisterShift[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'OPEN' | 'CLOSED'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadShifts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const data = await financeShiftsApi.list({ status, limit: 200 });
      setShifts(data);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadShifts();
  }, [statusFilter]);

  const sortedShifts = useMemo(
    () => [...shifts].sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()),
    [shifts],
  );

  return (
    <div className="catalog-content">
      <PageHeader
        title="Register Shifts"
        description="Review cashier shifts, balances, and closure status."
        actions={
          <button type="button" className="secondary" onClick={loadShifts}>
            Refresh
          </button>
        }
      />

      <SectionCard>
        <div className="table-toolbar">
          <label className="inline-field">
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="all">All</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
            </select>
          </label>
        </div>
        <DataState
          isLoading={isLoading}
          error={error}
          empty={!isLoading && shifts.length === 0}
          emptyMessage="No register shifts found for this branch."
        />
        {!isLoading && shifts.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Opened</th>
                  <th>Closed</th>
                  <th>Opened By</th>
                  <th>Opening Cash</th>
                  <th>Expected Cash</th>
                  <th>Actual Cash</th>
                  <th>Variance</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedShifts.map((shift) => (
                  <tr key={shift.id} className={shift.status === 'OPEN' ? 'active-row' : undefined}>
                    <td>
                      <StatusBadge active={shift.status === 'OPEN'} activeLabel="Open" inactiveLabel="Closed" />
                    </td>
                    <td>{formatDate(shift.openedAt)}</td>
                    <td>{formatDate(shift.closedAt)}</td>
                    <td>{shift.openedByUser?.name ?? shift.openedByUserId}</td>
                    <td>{formatAmount(shift.openingCashAmount)}</td>
                    <td>{formatAmount(shift.closingCashAmountExpected)}</td>
                    <td>{formatAmount(shift.closingCashAmountActual)}</td>
                    <td>{shift.varianceAmount ? formatAmount(shift.varianceAmount) : '—'}</td>
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
    </div>
  );
}
