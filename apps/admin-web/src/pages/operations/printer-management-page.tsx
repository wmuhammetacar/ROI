import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { printersApi, stationsApi, type PrinterRecord, type StationSummary } from '../../api';
import { useBranchContext } from '../../app/branch-context';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, Modal, PageHeader, StatusBadge } from '../../components';

export function PrinterManagementPage() {
  const { effectiveBranchId } = useBranchContext();
  const [printers, setPrinters] = useState<PrinterRecord[]>([]);
  const [stations, setStations] = useState<StationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [printerRole, setPrinterRole] = useState<PrinterRecord['printerRole']>('KITCHEN');
  const [type, setType] = useState<PrinterRecord['type']>('NETWORK');
  const [stationId, setStationId] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [copyCount, setCopyCount] = useState(1);
  const [priority, setPriority] = useState(100);
  const [fallbackPrinterId, setFallbackPrinterId] = useState('');

  const [previewProductId, setPreviewProductId] = useState('');
  const [previewStationId, setPreviewStationId] = useState('');
  const [routePreview, setRoutePreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rows, stationsRes] = await Promise.all([
        printersApi.list(effectiveBranchId ?? undefined),
        stationsApi.list(),
      ]);
      setPrinters(rows);
      setStations(stationsRes);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [effectiveBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await printersApi.create({
        name,
        printerRole,
        type,
        stationId: stationId || undefined,
        ipAddress: ipAddress || undefined,
        copyCount,
        priority,
        fallbackPrinterId: fallbackPrinterId || undefined,
        isActive: true,
      });
      setIsCreateOpen(false);
      setName('');
      setIpAddress('');
      setCopyCount(1);
      setPriority(100);
      setFallbackPrinterId('');
      await load();
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const toggleActive = async (printer: PrinterRecord) => {
    try {
      await printersApi.update(printer.id, { isActive: !printer.isActive });
      await load();
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const runTest = async (printerId: string) => {
    try {
      const res = await printersApi.test(printerId);
      setRoutePreview(res.message);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const handleRoutePreview = async () => {
    try {
      const preview = await printersApi.previewRoute({
        productId: previewProductId || undefined,
        stationId: previewStationId || undefined,
      });

      setRoutePreview(
        preview.selectedPrinter
          ? `${preview.station.code} -> ${preview.selectedPrinter.name} [priority ${preview.selectedPrinter.priority}]${preview.fallbackPrinter ? ` (fallback: ${preview.fallbackPrinter.name})` : ''}`
          : `${preview.station.code} -> NO ACTIVE PRINTER`,
      );
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  const fallbackCandidates = useMemo(() => printers.filter((printer) => printer.isActive), [printers]);

  return (
    <div className="catalog-content">
      <PageHeader
        title="Printer Management"
        description="Register and assign kitchen/bar/report/cash printers for live operations."
        actions={<button className="secondary" onClick={() => setIsCreateOpen(true)}>Create Printer</button>}
      />

      <DataState isLoading={isLoading} error={error} empty={!isLoading && printers.length === 0} emptyMessage="No printers configured." />

      {routePreview ? <p className="page-card">{routePreview}</p> : null}

      <div className="page-card form-grid">
        <h3>Routing Preview</h3>
        <div className="form-row">
          <input value={previewProductId} onChange={(e) => setPreviewProductId(e.target.value)} placeholder="productId (optional)" />
          <select value={previewStationId} onChange={(e) => setPreviewStationId(e.target.value)}>
            <option value="">Select station</option>
            {stations.map((station) => (
              <option key={station.id} value={station.id}>{station.name} ({station.code})</option>
            ))}
          </select>
          <button className="secondary" onClick={() => void handleRoutePreview()}>Preview Route</button>
        </div>
      </div>

      {printers.length > 0 ? (
        <div className="table-wrap page-card">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Station</th>
                <th>Type</th>
                <th>IP</th>
                <th>Copies</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {printers.map((printer) => (
                <tr key={printer.id}>
                  <td>{printer.name}</td>
                  <td>{printer.printerRole}</td>
                  <td>{printer.station?.code ?? 'ROLE_BASED'}</td>
                  <td>{printer.type}</td>
                  <td>{printer.ipAddress ?? '—'}</td>
                  <td>{printer.copyCount}</td>
                  <td>{printer.priority}</td>
                  <td><StatusBadge active={printer.isActive} activeLabel="Active" inactiveLabel="Inactive" /></td>
                  <td className="table-actions">
                    <button className="secondary" onClick={() => void runTest(printer.id)}>Test</button>
                    <button className="secondary" onClick={() => void toggleActive(printer)}>{printer.isActive ? 'Deactivate' : 'Activate'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {isCreateOpen ? (
        <Modal title="Create Printer" onClose={() => setIsCreateOpen(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
            <label>Printer Role
              <select value={printerRole} onChange={(e) => setPrinterRole(e.target.value as PrinterRecord['printerRole'])}>
                {['CASH','KITCHEN','BAR','REPORT','DAY_END','INVOICE','BARCODE','PACKAGE'].map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </label>
            <label>Connection Type
              <select value={type} onChange={(e) => setType(e.target.value as PrinterRecord['type'])}>
                <option value="NETWORK">NETWORK</option>
                <option value="USB">USB</option>
              </select>
            </label>
            <label>Station (optional)
              <select value={stationId} onChange={(e) => setStationId(e.target.value)}>
                <option value="">Role-based routing</option>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>{station.name} ({station.code})</option>
                ))}
              </select>
            </label>
            <label>IP Address (optional)<input value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} /></label>
            <label>Copy Count<input type="number" min={1} max={5} value={copyCount} onChange={(e) => setCopyCount(Number(e.target.value))} /></label>
            <label>Priority (lower wins)<input type="number" min={1} max={1000} value={priority} onChange={(e) => setPriority(Number(e.target.value))} /></label>
            <label>Fallback Printer (optional)
              <select value={fallbackPrinterId} onChange={(e) => setFallbackPrinterId(e.target.value)}>
                <option value="">No fallback</option>
                {fallbackCandidates.map((printer) => (
                  <option key={printer.id} value={printer.id}>{printer.name}</option>
                ))}
              </select>
            </label>
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setIsCreateOpen(false)}>Cancel</button>
              <button type="submit" className="secondary">Create</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
