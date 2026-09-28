/**
 * Market-state engine — derives the current MARKET REGIME from the pure
 * simulated price timeline.
 *
 * Design rules (mirrors engine.ts):
 *  - A pure function of the timeline. Nothing random at runtime, nothing
 *    stored. Any two readers asking the same instant get the same answer.
 *  - The regime is DERIVED from real simulated prices (breadth, index level,
 *    volatility), never multiplied in out of thin air. "Do not multiply prices
 *    by random numbers" — we read the market that already exists.
 *  - Cheap: one breadth scan is memoised per 60 s bucket, and the hot
 *    trading path never calls this (only banners/news/dashboard do).
 */

import { price } from "./engine.js";
import { listStockDefs } from "./universe.js";
import { activeScheduledEvents } from "./events.js";
import type { MarketRegime } from "@aadiinvest/shared";

const DAY_MS = 24 * 3600 * 1000;
const CACHE_MS = 60_000;

/** The 15 heavyweight listings that stand in for the "index". */
const INDEX_SYMBOLS = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "JPM", "XOM", "JNJ", "WMT", "SPY", "QQQ", "SHOP.TO", "RY.TO", "BTC"];

/** Sentiment bands used by the UI and the news generator. */
export const REGIME_META: Record<MarketRegime, { label: string; emoji: string; blurb: string }> = {
  NORMAL: { label: "Calm", emoji: "🌤️", blurb: "Markets are trading in their usual range." },
  BULL: { label: "Bull Market", emoji: "🐂", blurb: "Broad gains — greed is in the air. Discipline still pays." },
  BEAR: { label: "Bear Market", emoji: "🐻", blurb: "Grinding losses — capital is hiding." },
  CRASH: { label: "Market Crash", emoji: "💥", blurb: "Panic selling across the board. Cash is a position." },
  RECOVERY: { label: "Recovery", emoji: "🌱", blurb: "Bargain hunters are stepping back in." },
  VOLATILE: { label: "High Volatility", emoji: "🌪️", blurb: "Wild swings both ways. Position sizing matters." },
};

export interface MarketState {
  regime: MarketRegime;
  /** −1 (maximum fear) .. +1 (maximum greed) */
  sentiment: number;
  /** Whole-market day change in percent (index-weighted simple average). */
  indexChangePercent: number;
  /** Share of listings up today, 0..1. */
  breadth: number;
  /** Annualised-ish intraday volatility estimate (avg |move| %). */
  volatility: number;
  sectorsUp: number;
  sectorsDown: number;
  at: string;
}

let cache: { at: number; state: MarketState } | null = null;

function dayChangePercent(symbol: string, now: Date): number {
  const prev = price(symbol, new Date(now.getTime() - DAY_MS));
  if (prev <= 0) return 0;
  return ((price(symbol, now) - prev) / prev) * 100;
}

/** Compute (or fetch from the 60 s memo) the market state at `now`. */
export function getMarketState(now: Date = new Date()): MarketState {
  const bucket = Math.floor(now.getTime() / CACHE_MS);
  if (cache && Math.floor(cache.at / CACHE_MS) === bucket) return cache.state;

  const defs = listStockDefs().filter((d) => d.assetClass === "STOCK" || d.assetClass === "ETF");
  let up = 0;
  let sumChange = 0;
  let sumAbsMove = 0;
  let n = 0;
  const sectorChange = new Map<string, number[]>();

  const t0 = now.getTime();
  const sampleStep = defs.length > 120 ? 3 : 1; // sample ~100 listings for speed
  for (let i = 0; i < defs.length; i += sampleStep) {
    const def = defs[i]!;
    const ch = dayChangePercent(def.symbol, now);
    sumChange += ch;
    sumAbsMove += Math.abs(ch);
    n += 1;
    if (ch > 0.05) up += 1;
    const arr = sectorChange.get(def.sector) ?? [];
    arr.push(ch);
    sectorChange.set(def.sector, arr);
  }

  const indexChangePercent = n ? sumChange / n : 0;
  const breadth = n ? up / n : 0.5;
  const volatility = n ? sumAbsMove / n : 0;
  const sectorsUp = [...sectorChange.values()].filter((arr) => arr.reduce((a, b) => a + b, 0) > 0).length;
  const sectorsDown = sectorChange.size - sectorsUp;

  // Index level change over 5 cycle-days for trend context.
  const idxNow = INDEX_SYMBOLS.reduce((a, s) => a + dayChangePercent(s, now), 0) / INDEX_SYMBOLS.length;

  const crashing = activeScheduledEvents(now).some((e) => e.def.severity === "crash" && e.def.scope === "ALL");

  let regime: MarketRegime;
  if (crashing && indexChangePercent <= -6) regime = "CRASH";
  else if (volatility >= 3.5) regime = "VOLATILE";
  else if (indexChangePercent <= -4) regime = "CRASH";
  else if (indexChangePercent <= -2) regime = "BEAR";
  else if (indexChangePercent >= 1.2 && breadth >= 0.6) regime = "BULL";
  else if (indexChangePercent >= 0.7 && breadth >= 0.55 && idxNow > 0) regime = "RECOVERY";
  else regime = "NORMAL";

  // Sentiment: fear/greed blend of breadth, momentum and volatility.
  const sentiment = Math.max(-1, Math.min(1,
    (breadth - 0.5) * 1.4 + (indexChangePercent / 6) * 0.8 - (volatility / 6) * 0.4,
  ));

  const state: MarketState = {
    regime,
    sentiment: Math.round(sentiment * 100) / 100,
    indexChangePercent: Math.round(indexChangePercent * 100) / 100,
    breadth: Math.round(breadth * 100) / 100,
    volatility: Math.round(volatility * 100) / 100,
    sectorsUp,
    sectorsDown,
    at: now.toISOString(),
  };
  cache = { at: t0, state };
  return state;
}

/** Sector heatmap rows for the dashboard / portfolio pages. */
export function getSectorHeatmap(now: Date = new Date()) {
  const defs = listStockDefs().filter((d) => d.assetClass === "STOCK" || d.assetClass === "ETF");
  const acc = new Map<string, { sum: number; n: number }>();
  for (const def of defs) {
    const ch = dayChangePercent(def.symbol, now);
    const row = acc.get(def.sector) ?? { sum: 0, n: 0 };
    row.sum += ch;
    row.n += 1;
    acc.set(def.sector, row);
  }
  return [...acc.entries()]
    .map(([sector, { sum, n }]) => ({ sector, changePercent: Math.round((sum / n) * 100) / 100, listings: n }))
    .sort((a, b) => b.changePercent - a.changePercent);
}
