interface StatusBadgeProps {
  value: string;
  label?: string;
}

export function StatusBadge({ value, label }: StatusBadgeProps) {
  const className = `status-badge status-${value.toLowerCase().replace(/_/g, '-')}`;
  return <span className={className}>{label ?? value}</span>;
}
