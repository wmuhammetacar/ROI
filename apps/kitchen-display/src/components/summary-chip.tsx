interface SummaryChipProps {
  label: string;
  value: number | string;
}

export function SummaryChip({ label, value }: SummaryChipProps) {
  return (
    <div className="summary-chip">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
