/** Re-export shared helpers and add client-specific ones. */
export { formatCad, formatCompact, formatPercent, greetingFor } from "@aadiinvest/shared";

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

/** "+$50.00 ↑" / "-$20.00 ↓" — never color alone (accessibility requirement). */
export function deltaWithArrow(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n >= 0 ? `${value} ↑` : `${value.replace("-", "-")} ↓`;
}

export function parseMoney(input: string): string | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return cleaned;
}
