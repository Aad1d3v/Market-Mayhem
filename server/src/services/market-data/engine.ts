/**
 * Deterministic simulated price engine.
 *
 * Core property: price(symbol, timestamp) is a PURE function of (symbol,
 * timestamp). The pattern repeats every 50 days. Nothing is random at
 * runtime, nothing is stored — charts, quotes and portfolio marks are always
 * consistent, and the series can be replayed for any past or future date.
 *
 * All prices are SIMULATED and expressed in CAD.
 */

import { getStockDef, type StockDef } from "./universe";
import { CYCLE_DAYS, scheduledMultiplier } from "./events";

export { CYCLE_DAYS };

export type Timeframe = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "5Y";

const DAY_MS = 24 * 3600 * 1000;

/** Small stable integer hash (FNV-1a) for per-symbol deterministic noise. */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic pseudo-random in [0,1) from an integer seed. */
function rand(seed: number): number {
  let x = seed >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return ((x >>> 0) % 100000) / 100000;
}

/**
 * Anchor price level for a position within the 50-day cycle.
 * Depends ONLY on (symbol, dayOfCycle) so the whole series repeats exactly.
 */
function baseForPhase(symbol: string, def: StockDef, dayOfCycle: number): number {
  const h = hash(`${symbol}:${dayOfCycle}`);
  const shift = (rand(h) - 0.5) * def.drift; // in [-drift/2, +drift/2]
  return Math.max(0.5, def.basePrice * (1 + shift));
}

/**
 * Simulated price at a given instant.
 *
 * Composed of:
 *  - a per-cycle anchor (changes once per 50-day cycle)
 *  - smooth harmonic waves across the cycle (trend + two oscillations)
 *  - a deterministic daily wobble
 *  - a gentle intraday curve so 1D charts are not flat
 *  - the scheduled scenario overlay: crashes, rallies and frenzies that
 *    multiply the whole thing for a few hours (`events.ts`)
 *
 * The volatility of each listing scales with its asset class, so crypto and
 * commodities swing hard while bonds barely move.
 */
export function price(symbol: string, at: Date = new Date()): number {
  const def = getStockDef(symbol);
  if (!def) throw new Error(`Unknown symbol: ${symbol}`);
  return priceForDef(def, at);
}

export function priceForDef(def: StockDef, at: Date): number {
  const symbol = def.symbol;
  const t = at.getTime();
  const dayIndex = Math.floor(t / DAY_MS);
  const cycle = Math.floor(dayIndex / CYCLE_DAYS);
  const dayOfCycle = dayIndex - cycle * CYCLE_DAYS; // 0..49 — the phase that repeats

  const base = baseForPhase(symbol, def, dayOfCycle);
  const vol = def.vol; // per-listing volatility multiplier

  // Smooth component across the cycle (0..1 progress)
  const u = dayOfCycle / CYCLE_DAYS;
  const wave =
    vol *
    (Math.sin(u * Math.PI) * 0.035 + // mid-cycle bulge
      Math.sin(u * 2 * Math.PI + hash(symbol) % 7) * 0.02 + // one full oscillation
      Math.sin(u * 4 * Math.PI + hash(symbol + "b") % 11) * 0.008); // finer ripple
  const trend = vol * (u - 0.5) * def.drift; // drift across the cycle

  // Daily wobble — deterministic per (symbol, phase day), periodic every 50 days
  const dailyNoise = vol * (rand(hash(symbol + ":" + dayOfCycle)) - 0.5) * 0.012;

  // Intraday curve: subtle rise/fall within the day
  const secondsIntoDay = (t % DAY_MS) / 1000;
  const intraday = vol * Math.sin((secondsIntoDay / 86400) * Math.PI * 2) * 0.0025;

  const event = scheduledMultiplier(def, at);

  const raw = base * (1 + wave + trend + dailyNoise + intraday) * event;
  return Math.max(0.05, Math.round(raw * 100) / 100);
}

export function computePrice(
  symbol: string,
  at: Date = new Date(),
): { price: number; volume: number } {
  const def = getStockDef(symbol);
  if (!def) throw new Error(`Unknown symbol: ${symbol}`);
  const p = price(symbol, at);
  const dayIndex = Math.floor(at.getTime() / DAY_MS);
  const dayOfCycle = dayIndex - Math.floor(dayIndex / CYCLE_DAYS) * CYCLE_DAYS;
  const volume = Math.round(
    2_000_000 + rand(hash(symbol + "v" + dayOfCycle)) * 8_000_000,
  );
  return { price: p, volume };
}

/** The simulated close of the previous calendar day (used for daily change). */
export function previousClose(symbol: string, now: Date = new Date()): number {
  const dayIndex = Math.floor(now.getTime() / DAY_MS);
  const prevDay = new Date((dayIndex - 1) * DAY_MS + 12 * 3600 * 1000);
  return price(symbol, prevDay);
}

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const TIMEFRAME_CONFIG: Record<
  Timeframe,
  { spanDays: number; bucketMinutes: number }
> = {
  "1D": { spanDays: 1, bucketMinutes: 15 },
  "1W": { spanDays: 7, bucketMinutes: 60 },
  "1M": { spanDays: 30, bucketMinutes: 240 },
  "3M": { spanDays: 90, bucketMinutes: 720 },
  "6M": { spanDays: 182, bucketMinutes: 1440 },
  "1Y": { spanDays: 365, bucketMinutes: 1440 },
  "5Y": { spanDays: 1826, bucketMinutes: 10080 },
};

/** Build OHLCV candles for a timeframe ending `now`. */
export function getCandles(
  symbol: string,
  timeframe: Timeframe,
  now: Date = new Date(),
): { candles: Candle[]; cycleInfo: { cycleDay: number; cycleOf: number } } {
  const cfg = TIMEFRAME_CONFIG[timeframe] ?? TIMEFRAME_CONFIG["1M"];
  const end = now.getTime();
  const start = end - cfg.spanDays * DAY_MS;
  const bucketMs = cfg.bucketMinutes * 60 * 1000;

  const candles: Candle[] = [];
  for (let t = Math.floor(start / bucketMs) * bucketMs; t <= end; t += bucketMs) {
    const at = new Date(t);
    const open = price(symbol, at);
    const close = price(symbol, new Date(Math.min(t + bucketMs, end)));
    let high = Math.max(open, close);
    let low = Math.min(open, close);
    // Two interior samples for a better high/low shape
    for (const f of [0.33, 0.66]) {
      const p = price(symbol, new Date(t + f * bucketMs));
      high = Math.max(high, p);
      low = Math.min(low, p);
    }
    const dayIdx = Math.floor(t / DAY_MS);
    const phase = dayIdx - Math.floor(dayIdx / CYCLE_DAYS) * CYCLE_DAYS;
    candles.push({
      time: at.toISOString(),
      open,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close,
      volume: Math.round(2_000_000 + rand(hash(symbol + "v" + phase)) * 8_000_000),
    });
  }

  const dayIndex = Math.floor(now.getTime() / DAY_MS);
  const cycle = Math.floor(dayIndex / CYCLE_DAYS);
  return {
    candles,
    cycleInfo: { cycleDay: dayIndex - cycle * CYCLE_DAYS, cycleOf: CYCLE_DAYS },
  };
}

/** Highest / lowest price over the past 52 simulated weeks (~364 days). */
export function range52Weeks(symbol: string, now: Date = new Date()) {
  const end = now.getTime();
  const start = end - 364 * DAY_MS;
  let high = -Infinity;
  let low = Infinity;
  for (let t = start; t <= end; t += 12 * 3600 * 1000) {
    const p = price(symbol, new Date(t));
    if (p > high) high = p;
    if (p < low) low = p;
  }
  return { high, low };
}

/**
 * Simulated fundamentals. Values are fixed functions of the stock definition
 * (stable across time) and clearly fictional.
 */
const DIVIDEND_SECTORS = new Set([
  "Consumer Staples",
  "Financials",
  "Utilities",
  "Energy",
  "Telecom",
  "Real Estate",
]);

/** Asset classes whose "dividend" column is really a yield of some kind. */
const YIELD_LABELS: Record<string, string> = {
  STOCK: "Dividend Yield",
  ETF: "Distribution Yield",
  BOND: "Yield to Maturity",
  CRYPTO: "Staking Yield",
  COMMODITY: "Storage Cost",
};

/**
 * Simulated fundamentals. Values are fixed functions of the stock definition
 * (stable across time) and clearly fictional. Non-equity asset classes report
 * `null` for the metrics that do not apply to them.
 */
export function getFundamentals(symbol: string) {
  const def = getStockDef(symbol);
  if (!def) throw new Error(`Unknown symbol: ${symbol}`);
  const h = hash(symbol + "fund");
  const { high, low } = range52Weeks(symbol);
  const avgVolume = Math.round(3_000_000 + rand(h) * 9_000_000);
  const isEquity = def.assetClass === "STOCK";
  const pe = isEquity ? 18 + rand(h + 1) * 24 : null;
  const paysDividend =
    def.assetClass === "BOND" ||
    def.assetClass === "ETF" ||
    (isEquity && DIVIDEND_SECTORS.has(def.sector));
  const dy = paysDividend ? 1.2 + rand(h + 2) * 3.2 : null;
  // Commodities are not companies: no market cap, no shares outstanding.
  const marketCap =
    def.assetClass === "COMMODITY"
      ? null
      : Math.round(def.basePrice * (50e6 + rand(h + 3) * 2_500e6));
  return {
    marketCap,
    week52High: high,
    week52Low: low,
    averageVolume: avgVolume,
    peRatio: pe,
    dividendYield: dy,
    yieldLabel: YIELD_LABELS[def.assetClass] ?? "Dividend Yield",
  };
}
