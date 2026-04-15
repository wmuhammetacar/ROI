interface QuantityControlProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
}

export function QuantityControl({ value, min = 1, max = 20, onChange }: QuantityControlProps) {
  return (
    <div className="quantity-control">
      <button
        type="button"
        className="ghost"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        -
      </button>
      <strong>{value}</strong>
      <button
        type="button"
        className="ghost"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}
