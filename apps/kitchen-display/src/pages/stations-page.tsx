import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Station } from '../api';
import { stationsApi } from '../api';
import { DataState, StatusBadge } from '../components';

const LAST_STATION_KEY = 'roi_kds_last_station';

export function StationsPage() {
  const navigate = useNavigate();
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await stationsApi.list();
      setStations(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stations.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStations();
  }, [loadStations]);

  const activeStations = useMemo(
    () =>
      stations
        .filter((station) => station.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [stations],
  );

  const handleSelect = useCallback(
    (station: Station) => {
      localStorage.setItem(LAST_STATION_KEY, station.id);
      navigate(`/board?stationId=${station.id}`);
    },
    [navigate],
  );

  return (
    <section className="panel stations-panel">
      <header className="panel-header">
        <div>
          <h1>Station Selection</h1>
          <p className="muted">Choose a station to open the live board.</p>
        </div>
        <button type="button" onClick={loadStations}>
          Refresh
        </button>
      </header>

      <DataState
        isLoading={isLoading}
        error={error}
        empty={!isLoading && !error && activeStations.length === 0}
        emptyMessage="No active stations configured."
      />

      <div className="station-grid">
        {activeStations.map((station) => (
          <button key={station.id} type="button" className="station-card" onClick={() => handleSelect(station)}>
            <div className="station-card-header">
              <strong>{station.name}</strong>
              <StatusBadge value={station.stationType} />
            </div>
            <span className="muted">Code: {station.code ?? '-'}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
