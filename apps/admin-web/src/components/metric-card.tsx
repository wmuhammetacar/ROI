interface MetricCardProps {
  label: string;
  value: string;
  helper?: string;
}

export function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <div className="metric-card">
      <p className="muted">{label}</p>
      <strong className="metric-value">{value}</strong>
      {helper ? <p className="muted">{helper}</p> : null}
    </div>
  );
}
