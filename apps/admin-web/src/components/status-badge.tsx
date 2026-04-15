import { cx } from '@roi/shared-utils';

interface StatusBadgeProps {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}

export function StatusBadge({
  active,
  activeLabel = 'Active',
  inactiveLabel = 'Inactive',
}: StatusBadgeProps) {
  return (
    <span className={cx('status-badge', active ? 'yes' : 'no')}>
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}
