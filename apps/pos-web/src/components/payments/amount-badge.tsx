import { formatMoney } from './format';

interface AmountBadgeProps {
  label: string;
  amount: number | string;
  tone?: 'neutral' | 'good' | 'warning';
}

export function AmountBadge({ label, amount, tone = 'neutral' }: AmountBadgeProps) {
  return (
    <div className={`amount-badge amount-badge-${tone}`}>
      <span className="muted">{label}</span>
      <strong>{formatMoney(amount)}</strong>
    </div>
  );
}
