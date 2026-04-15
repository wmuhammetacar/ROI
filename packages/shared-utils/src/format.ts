export function formatCurrency(value: number | string, currency = 'TRY'): string {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return String(value);
  }

  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

export function cx(...values: Array<string | undefined | null | false>): string {
  return values.filter(Boolean).join(' ');
}
