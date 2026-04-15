import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type {
  KdsQueueResponse,
  KdsSummaryResponse,
  ProductionTicket,
  ProductionTicketItem,
  ProductionTicketItemStatus,
  Station,
} from '../api';
import { kdsApi, productionApi, stationsApi } from '../api';
import { useSession } from '../app/session-context';
import { DataState, StatusBadge, SummaryChip } from '../components';
import { KDS_REALTIME_EVENTS, useKdsRealtime } from '../realtime';

const LAST_STATION_KEY = 'roi_kds_last_station';
const POLL_INTERVAL_MS = 25000;

function formatTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function getTicketTitle(ticket: ProductionTicket) {
  if (ticket.order?.orderNumber) return `Order ${ticket.order.orderNumber}`;
  return `Order ${ticket.orderId.slice(0, 6)}`;
}

function getTableLabel(ticket: ProductionTicket) {
  if (ticket.tableSession?.table?.name) return ticket.tableSession.table.name;
  if (ticket.tableSessionId) return `Session ${ticket.tableSessionId.slice(0, 6)}`;
  return 'No table';
}

function mapItemStatusLabel(status: ProductionTicketItemStatus) {
  switch (status) {
    case 'QUEUED':
      return 'Queued';
    case 'IN_PROGRESS':
      return 'In Progress';
    case 'READY':
      return 'Ready';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status;
  }
}

function getNextStatus(status: ProductionTicketItemStatus): ProductionTicketItemStatus | null {
  if (status === 'QUEUED') return 'IN_PROGRESS';
  if (status === 'IN_PROGRESS') return 'READY';
  if (status === 'READY') return 'COMPLETED';
  return null;
}

function groupTickets(queue: KdsQueueResponse | null) {
  const grouped: Record<'queued' | 'inProgress' | 'ready', ProductionTicket[]> = {
    queued: [],
    inProgress: [],
    ready: [],
  };
  if (!queue) return grouped;
  queue.tickets.forEach((ticket) => {
    if (ticket.status === 'READY') {
      grouped.ready.push(ticket);
    } else if (ticket.status === 'IN_PROGRESS') {
      grouped.inProgress.push(ticket);
    } else {
      grouped.queued.push(ticket);
    }
  });
  return grouped;
}

export function BoardPage() {
  const { user } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const stationId = searchParams.get('stationId') ?? localStorage.getItem(LAST_STATION_KEY);

  const [station, setStation] = useState<Station | null>(null);
  const [stationOptions, setStationOptions] = useState<Station[]>([]);
  const [queue, setQueue] = useState<KdsQueueResponse | null>(null);
  const [summary, setSummary] = useState<KdsSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [updatingItemIds, setUpdatingItemIds] = useState<string[]>([]);

  const timerRef = useRef<number | null>(null);

  const loadStation = useCallback(async (id: string) => {
    try {
      const response = await stationsApi.getById(id);
      setStation(response);
    } catch {
      setStation((prev) =>
        prev ?? {
          id,
          branchId: '',
          name: `Station ${id.slice(0, 6)}`,
          code: null,
          stationType: 'OTHER',
          sortOrder: 0,
          isActive: true,
          createdAt: '',
          updatedAt: '',
        },
      );
    }
  }, []);

  const loadStationsList = useCallback(async () => {
    try {
      const response = await stationsApi.list();
      setStationOptions(response.filter((item) => item.isActive));
    } catch {
      setStationOptions([]);
    }
  }, []);

  const loadQueue = useCallback(
    async (id: string) => {
      const [queueResponse, summaryResponse] = await Promise.all([kdsApi.getQueue(id), kdsApi.getSummary(id)]);
      setQueue(queueResponse);
      setSummary(summaryResponse);
      setLastUpdated(new Date().toISOString());
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!stationId) return;
    if (isRefreshing) return;
    setIsRefreshing(true);
    setError(null);
    try {
      await loadQueue(stationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh queue.');
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, loadQueue, stationId]);

  useEffect(() => {
    if (!stationId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    void (async () => {
      try {
        await Promise.all([loadStation(stationId), loadStationsList(), loadQueue(stationId)]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load board.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadQueue, loadStation, loadStationsList, stationId]);

  useEffect(() => {
    if (!stationId) return;
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
    }
    timerRef.current = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [refresh, stationId]);

  const grouped = useMemo(() => groupTickets(queue), [queue]);

  const realtimeHandlers = useMemo(
    () => ({
      [KDS_REALTIME_EVENTS.PRODUCTION_TICKET_CREATED]: () => {
        void refresh();
      },
      [KDS_REALTIME_EVENTS.PRODUCTION_ITEM_UPDATED]: () => {
        void refresh();
      },
      [KDS_REALTIME_EVENTS.ORDER_SENT_TO_STATION]: () => {
        void refresh();
      },
      [KDS_REALTIME_EVENTS.PUBLIC_ORDER_SUBMITTED]: () => {
        void refresh();
      },
    }),
    [refresh],
  );

  useKdsRealtime(user?.branchId, stationId, realtimeHandlers);

  const handleItemStatus = useCallback(
    async (item: ProductionTicketItem) => {
      const nextStatus = getNextStatus(item.status);
      if (!nextStatus) return;
      setUpdatingItemIds((prev) => [...prev, item.id]);
      setError(null);
      try {
        await productionApi.updateItemStatus(item.id, { status: nextStatus });
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update item status.');
      } finally {
        setUpdatingItemIds((prev) => prev.filter((id) => id !== item.id));
      }
    },
    [refresh],
  );

  const handleStationChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      if (!value) return;
      localStorage.setItem(LAST_STATION_KEY, value);
      setSearchParams({ stationId: value });
    },
    [setSearchParams],
  );

  if (!stationId) {
    return (
      <section className="panel">
        <h1>KDS Board</h1>
        <p className="muted">Select a station to open the board.</p>
        <Link to="/stations" className="nav-btn">
          Go to Stations
        </Link>
      </section>
    );
  }

  return (
    <section className="panel board-panel">
      <header className="board-header">
        <div>
          <h1>{station ? station.name : 'KDS Board'}</h1>
          <div className="muted">
            {station?.stationType ?? 'Station'} | Last update: {lastUpdated ? formatTime(lastUpdated) : '-'}
          </div>
        </div>
        <div className="board-actions">
          <select value={station?.id ?? stationId} onChange={handleStationChange}>
            {(stationOptions.length > 0 ? stationOptions : [{ id: stationId, name: 'Current', stationType: 'OTHER', isActive: true, branchId: '', code: null, sortOrder: 0, createdAt: '', updatedAt: '' }]).map(
              (option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ),
            )}
          </select>
          <button type="button" onClick={refresh} disabled={isRefreshing}>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      <DataState isLoading={isLoading} error={error} />

      {summary ? (
        <div className="summary-bar">
          <SummaryChip label="Queued Tickets" value={summary.totals.queuedTickets} />
          <SummaryChip label="In Progress Tickets" value={summary.totals.inProgressTickets} />
          <SummaryChip label="Ready Tickets" value={summary.totals.readyTickets} />
          <SummaryChip label="Queued Items" value={summary.totals.queuedItems} />
          <SummaryChip label="In Progress Items" value={summary.totals.inProgressItems} />
          <SummaryChip label="Ready Items" value={summary.totals.readyItems} />
        </div>
      ) : null}

      <div className="board-grid">
        {(
          [
            { key: 'queued', title: 'Queued', items: grouped.queued },
            { key: 'inProgress', title: 'In Progress', items: grouped.inProgress },
            { key: 'ready', title: 'Ready', items: grouped.ready },
          ] as const
        ).map((column) => (
          <div key={column.key} className="column">
            <div className="column-header">
              <h3>{column.title}</h3>
              <span className="muted">{column.items.length}</span>
            </div>
            {column.items.length === 0 ? <p className="muted">No tickets</p> : null}
            <div className="ticket-stack">
              {column.items.map((ticket) => (
                <article key={ticket.id} className="ticket-card">
                  <header className="ticket-header">
                    <div>
                      <strong>{getTicketTitle(ticket)}</strong>
                      <div className="muted">
                        {getTableLabel(ticket)} | {ticket.serviceType}
                      </div>
                    </div>
                    <StatusBadge value={ticket.status} />
                  </header>
                  <div className="ticket-meta">
                    <span className="muted">Fired: {formatTime(ticket.items[0]?.firedAt ?? ticket.createdAt)}</span>
                    <span className="muted">Items: {ticket.items.length}</span>
                  </div>
                  <div className="ticket-items">
                    {ticket.items.map((item) => {
                      const pending = updatingItemIds.includes(item.id);
                      const nextStatus = getNextStatus(item.status);
                      return (
                        <div key={item.id} className="ticket-item-row">
                          <div>
                            <strong>
                              {item.quantity}x {item.productNameSnapshot}
                            </strong>
                            {item.variantNameSnapshot ? (
                              <span className="muted">Variant: {item.variantNameSnapshot}</span>
                            ) : null}
                            {item.notesSnapshot ? <span className="muted">Note: {item.notesSnapshot}</span> : null}
                          </div>
                          <div className="ticket-item-actions">
                            <StatusBadge value={item.status} label={mapItemStatusLabel(item.status)} />
                            {nextStatus ? (
                              <button
                                type="button"
                                className="action-btn"
                                onClick={() => handleItemStatus(item)}
                                disabled={pending}
                              >
                                {pending ? 'Updating...' : `Mark ${mapItemStatusLabel(nextStatus)}`}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
