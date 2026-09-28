/** Format money in CAD, e.g. 1234.5 -> "$1,234.50 CAD" */
export function formatCad(
  value: number,
  opts: { withCode?: boolean; sign?: boolean } = {},
): string {
  const formatted = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    signDisplay: opts.sign ? "always" : "auto",
  }).format(value);
  return opts.withCode ? `${formatted} CAD` : formatted;
}

/** Format a compact number, e.g. 1234567 -> "1.23M" */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format a decimal-like percentage, e.g. 11.111 -> "+11.11%" (sign included) */
export function formatPercent(value: number, alwaysSign = true): string {
  const formatted = new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: alwaysSign ? "always" : "auto",
  }).format(value);
  return `${formatted}%`;
}

/** "Good morning/afternoon/evening" greeting for the dashboard header */
export function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
