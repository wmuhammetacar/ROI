import type { RegisterShift } from '../../api';
import { formatDateTime, formatMoney } from './format';

interface ShiftStatusBannerProps {
  shift: RegisterShift | null;
}

export function ShiftStatusBanner({ shift }: ShiftStatusBannerProps) {
  if (!shift) {
    return (
      <div className="shift-banner warning">
        <strong>No open shift</strong>
        <span className="muted">Open your register shift before taking payment.</span>
      </div>
    );
  }

  return (
    <div className="shift-banner">
      <strong>Open shift ready</strong>
      <span className="muted">
        #{shift.id.slice(0, 8)} | Opened {formatDateTime(shift.openedAt)} | Opening cash {formatMoney(shift.openingCashAmount)}
      </span>
    </div>
  );
}
