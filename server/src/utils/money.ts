/**
 * Decimal-safe money helpers. NEVER do arithmetic on floats for balances.
 * All server math goes through Decimal here; DB columns are Decimal(16,2).
 */

import { Decimal } from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_EVEN });

export type DecimalLike = Decimal | string | number;

export function dec(value: DecimalLike | null | undefined): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  return value instanceof Decimal ? value : new Decimal(value);
}

/** Round to cents (2 dp), bankers' rounding. */
export function money(value: DecimalLike): Decimal {
  return dec(value).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
}

/** Round to 6 dp — used for fractional share quantities. */
export function shares(value: DecimalLike): Decimal {
  return dec(value).toDecimalPlaces(6, Decimal.ROUND_HALF_EVEN);
}

export function toCentsString(value: DecimalLike): string {
  return money(value).toFixed(2);
}

export function greaterThan(a: DecimalLike, b: DecimalLike): boolean {
  return dec(a).greaterThan(dec(b));
}

export function greaterThanOrEqualTo(a: DecimalLike, b: DecimalLike): boolean {
  return dec(a).greaterThanOrEqualTo(dec(b));
}

export function lessThan(a: DecimalLike, b: DecimalLike): boolean {
  return dec(a).lessThan(dec(b));
}

export function isPositive(value: DecimalLike): boolean {
  return dec(value).greaterThan(0);
}

export function sum(...values: DecimalLike[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(dec(v)), new Decimal(0));
}

/* ---------- Storage conversions (DB stores integer cents / micro-shares) ---------- */

export const MICRO_SHARES = 1_000_000; // 1 share = 1,000,000 micro-shares

/** DB cents → Decimal dollars. */
export function fromCents(cents: number | null | undefined): Decimal {
  return new Decimal(cents ?? 0).div(100);
}

/** Decimal dollars → integer cents (rounded half-even). */
export function toCents(value: DecimalLike): number {
  return money(value).times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).toNumber();
}

/** DB micro-shares → Decimal shares. */
export function fromMicro(micro: number | null | undefined): Decimal {
  return new Decimal(micro ?? 0).div(MICRO_SHARES);
}

/** Decimal shares → integer micro-shares. */
export function toMicro(value: DecimalLike): number {
  return shares(value).times(MICRO_SHARES).toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).toNumber();
}

/** DB cents → API string "$1234.56" style (no $ sign). */
export function centsToString(cents: number | null | undefined): string {
  return fromCents(cents).toFixed(2);
}

export { Decimal };
