interface StatusBadgeProps {
  value: string;
  label?: string;
}

export function StatusBadge({ value, label }: StatusBadgeProps) {
  const className = `status-pill status-${value.toLowerCase().replace(/_/g, '-')}`;
  return <span className={className}>{label ?? value}</span>;
}
