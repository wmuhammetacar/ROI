import { cx } from '@roi/shared-utils';

interface BadgeProps {
  value: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}

function PillBadge({ value, tone = 'neutral' }: BadgeProps) {
  return <span className={cx('status-badge', `integration-pill-${tone}`)}>{value}</span>;
}

export function ProviderTypeBadge({ value }: { value: string }) {
  const tone = value === 'MARKETPLACE' ? 'info' : 'neutral';
  return <PillBadge value={value} tone={tone} />;
}

export function ConfigStatusBadge({ value }: { value: string }) {
  if (value === 'ACTIVE') return <PillBadge value={value} tone="success" />;
  if (value === 'ERROR') return <PillBadge value={value} tone="danger" />;
  return <PillBadge value={value} tone="warning" />;
}

export function IngestionStatusBadge({ value }: { value: string }) {
  if (value === 'CREATED_INTERNAL_ORDER') return <PillBadge value="CREATED" tone="success" />;
  if (value === 'FAILED') return <PillBadge value={value} tone="danger" />;
  if (value === 'NORMALIZED') return <PillBadge value={value} tone="info" />;
  return <PillBadge value={value} tone="warning" />;
}

export function SyncStatusBadge({ value }: { value: string }) {
  if (value === 'SUCCESS') return <PillBadge value={value} tone="success" />;
  if (value === 'FAILED') return <PillBadge value={value} tone="danger" />;
  return <PillBadge value={value} tone="warning" />;
}

export function DirectionBadge({ value }: { value: string }) {
  return <PillBadge value={value} tone={value === 'INBOUND' ? 'info' : 'neutral'} />;
}
