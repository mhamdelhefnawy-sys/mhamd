export function formatMoney(value: number | string | null | undefined, currency = "SAR"): string {
  const n = Number(value ?? 0);
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatNumber(value: number | string | null | undefined, digits = 2): string {
  const n = Number(value ?? 0);
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function formatPercent(value: number | string | null | undefined, digits = 1): string {
  const n = Number(value ?? 0);
  return `${n.toFixed(digits)}%`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export function toIsoDateTime(dateStr: string): string {
  // <input type="date"> gives YYYY-MM-DD; the API expects a full ISO datetime.
  return new Date(`${dateStr}T00:00:00.000Z`).toISOString();
}
