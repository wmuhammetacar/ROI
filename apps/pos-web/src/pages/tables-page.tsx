import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Floor, Table, TableSession, TableStatus } from '../api';
import { floorsApi, tableSessionsApi, tablesApi } from '../api';
import { useSession } from '../app/session-context';
import { DataState, Modal, StatusBadge } from '../components';
import { POS_REALTIME_EVENTS, usePosBranchRealtime } from '../realtime';

const TABLE_STATUS_LABEL: Record<TableStatus, string> = {
  AVAILABLE: 'Available',
  OCCUPIED: 'Occupied',
  RESERVED: 'Reserved',
  OUT_OF_SERVICE: 'Out of service',
};

export function TablesPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [floors, setFloors] = useState<Floor[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [openSession, setOpenSession] = useState<TableSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [guestCount, setGuestCount] = useState(2);
  const [sessionNotes, setSessionNotes] = useState('');
  const [isOpeningSession, setIsOpeningSession] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [floorsResponse, tablesResponse] = await Promise.all([floorsApi.list(), tablesApi.list()]);
      setFloors(floorsResponse);
      setTables(tablesResponse);
      if (!selectedFloorId && floorsResponse.length > 0) {
        setSelectedFloorId(floorsResponse[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tables.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedFloorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedFloors = useMemo(
    () => [...floors].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [floors],
  );

  const visibleTables = useMemo(() => {
    if (!selectedFloorId) return tables;
    return tables.filter((table) => table.floorId === selectedFloorId);
  }, [selectedFloorId, tables]);

  const handleSelectTable = useCallback(async (table: Table) => {
    if (table.status === 'OUT_OF_SERVICE') return;

    setSelectedTable(table);
    setOpenSession(null);
    setSessionError(null);
    setSessionLoading(true);

    try {
      const session = await tableSessionsApi.findOpenByTable(table.id);
      setOpenSession(session);
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : 'Failed to load table session.');
    } finally {
      setSessionLoading(false);
    }
  }, []);

  const handleOpenSession = useCallback(async () => {
    if (!selectedTable) return;
    if (guestCount <= 0) {
      setSessionError('Guest count must be greater than 0.');
      return;
    }
    setIsOpeningSession(true);
    setSessionError(null);

    try {
      const session = await tableSessionsApi.open({
        tableId: selectedTable.id,
        guestCount,
        notes: sessionNotes.trim() ? sessionNotes.trim() : undefined,
      });
      setOpenSession(session);
      setIsSessionModalOpen(false);
      navigate(`/order-entry?tableId=${selectedTable.id}`);
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : 'Failed to open table session.');
    } finally {
      setIsOpeningSession(false);
    }
  }, [guestCount, navigate, selectedTable, sessionNotes]);

  const selectedFloor = sortedFloors.find((floor) => floor.id === selectedFloorId);

  usePosBranchRealtime(
    user?.branchId,
    useMemo(
      () => ({
        [POS_REALTIME_EVENTS.ORDER_CREATED]: () => {
          void load();
        },
        [POS_REALTIME_EVENTS.ORDER_STATUS_CHANGED]: () => {
          void load();
        },
        [POS_REALTIME_EVENTS.PUBLIC_ORDER_SUBMITTED]: () => {
          void load();
        },
      }),
      [load],
    ),
  );

  return (
    <div className="tables-layout">
      <section className="tables-panel">
        <div className="panel-header">
          <div>
            <h1>Tables</h1>
            <p className="muted">Tap a table to manage the active session.</p>
          </div>
          <button type="button" className="ghost" onClick={load}>
            Refresh
          </button>
        </div>

        <div className="floor-tabs">
          {sortedFloors.map((floor) => (
            <button
              key={floor.id}
              type="button"
              className={`floor-tab ${selectedFloorId === floor.id ? 'active' : ''}`}
              onClick={() => setSelectedFloorId(floor.id)}
            >
              {floor.name}
            </button>
          ))}
        </div>

        <DataState
          isLoading={isLoading}
          error={error}
          empty={!isLoading && !error && visibleTables.length === 0}
          emptyMessage={selectedFloor ? `No tables on ${selectedFloor.name}.` : 'No tables yet.'}
        />

        <div className="tables-grid">
          {visibleTables.map((table) => (
            <button
              key={table.id}
              type="button"
              className={`table-card ${table.status.toLowerCase().replace(/_/g, '-')} ${
                selectedTable?.id === table.id ? 'selected' : ''
              }`}
              onClick={() => handleSelectTable(table)}
              disabled={table.status === 'OUT_OF_SERVICE'}
            >
              <div className="table-card-header">
                <strong>{table.name}</strong>
                <StatusBadge value={table.status} label={TABLE_STATUS_LABEL[table.status]} />
              </div>
              <span className="muted">Capacity: {table.capacity}</span>
            </button>
          ))}
        </div>
      </section>

      <aside className="table-detail">
        <div className="panel">
          <h2>Table Session</h2>
          {!selectedTable ? (
            <p className="muted">Select a table to view or open a session.</p>
          ) : (
            <div className="detail-stack">
              <div>
                <strong>{selectedTable.name}</strong>
                <div className="muted">Status: {TABLE_STATUS_LABEL[selectedTable.status]}</div>
                <div className="muted">Capacity: {selectedTable.capacity}</div>
              </div>

              {sessionLoading ? <p className="muted">Loading session...</p> : null}
              {sessionError ? <p className="error">{sessionError}</p> : null}

              {openSession ? (
                <div className="session-card">
                  <div>
                    <strong>Open Session</strong>
                    <div className="muted">Guests: {openSession.guestCount}</div>
                    <div className="muted">Opened at: {new Date(openSession.openedAt).toLocaleTimeString()}</div>
                  </div>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => navigate(`/order-entry?tableId=${selectedTable.id}`)}
                  >
                    Open Order Entry
                  </button>
                </div>
              ) : (
                <div className="session-card">
                  <p className="muted">No open session for this table.</p>
                  <button type="button" className="primary" onClick={() => setIsSessionModalOpen(true)}>
                    Open Session
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      <Modal
        open={isSessionModalOpen}
        title={selectedTable ? `Open Session - ${selectedTable.name}` : 'Open Session'}
        onClose={() => setIsSessionModalOpen(false)}
        actions={
          <>
            <button type="button" className="ghost" onClick={() => setIsSessionModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="primary" onClick={handleOpenSession} disabled={isOpeningSession}>
              {isOpeningSession ? 'Opening...' : 'Open Session'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <label className="field">
            <span>Guest Count</span>
            <input
              type="number"
              min={1}
              value={guestCount}
              onChange={(event) => setGuestCount(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Notes (optional)</span>
            <textarea value={sessionNotes} onChange={(event) => setSessionNotes(event.target.value)} />
          </label>
          {sessionError ? <p className="error">{sessionError}</p> : null}
        </div>
      </Modal>
    </div>
  );
}
