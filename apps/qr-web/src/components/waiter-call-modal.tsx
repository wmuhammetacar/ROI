import { useMemo, useState } from 'react';
import { publicWaiterCallsApi, type PublicWaiterCallType } from '../api';
import { toErrorMessage } from '../app/error-utils';
import { Modal } from './modal';

interface WaiterCallModalProps {
  branchId: string;
  tableId: string;
  tableName?: string | null;
  onClose: () => void;
}

const CALL_TYPE_OPTIONS: Array<{ value: PublicWaiterCallType; label: string; description: string }> = [
  { value: 'WAITER', label: 'Call Waiter', description: 'General table assistance' },
  { value: 'BILL', label: 'Ask for Bill', description: 'Request account / payment support' },
  { value: 'SERVICE', label: 'Need Service', description: 'Water, cleanup, or quick support' },
];

export function WaiterCallModal({ branchId, tableId, tableName, onClose }: WaiterCallModalProps) {
  const [callType, setCallType] = useState<PublicWaiterCallType>('WAITER');
  const [note, setNote] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedType = useMemo(
    () => CALL_TYPE_OPTIONS.find((option) => option.value === callType) ?? CALL_TYPE_OPTIONS[0],
    [callType],
  );

  const submit = async () => {
    setIsPending(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await publicWaiterCallsApi.createWaiterCall({
        branchId,
        tableId,
        callType,
        note: note.trim() || undefined,
      });

      setSuccessMessage(`Request sent for ${response.tableName ?? tableName ?? 'your table'} (${selectedType.label}).`);
      setNote('');
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Modal title="Need assistance?" onClose={onClose}>
      <div className="form-grid waiter-call-content">
        <p className="muted">Table {tableName ?? tableId}</p>

        <div className="waiter-call-types">
          {CALL_TYPE_OPTIONS.map((option) => {
            const active = option.value === callType;
            return (
              <button
                key={option.value}
                type="button"
                className={`waiter-call-type ${active ? 'active' : ''}`}
                onClick={() => setCallType(option.value)}
                disabled={isPending}
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            );
          })}
        </div>

        <label>
          Note (optional)
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Any quick detail for staff"
            disabled={isPending}
          />
        </label>

        {error ? <p className="error">{error}</p> : null}
        {successMessage ? <p className="success-note">{successMessage}</p> : null}

        <div className="row-end">
          <button type="button" className="ghost" onClick={onClose} disabled={isPending}>
            Close
          </button>
          <button type="button" onClick={submit} disabled={isPending}>
            {isPending ? 'Sending...' : 'Send Request'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
