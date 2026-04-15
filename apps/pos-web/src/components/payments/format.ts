export function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  if (Number.isNaN(amount)) return '0.00';
  return amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}
