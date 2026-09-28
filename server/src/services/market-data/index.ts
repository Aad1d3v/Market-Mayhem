/**
 * MarketDataService — the single seam between the app and any price source.
 *
 * Today it wraps the deterministic SIMULATED engine (per product decision).
 * To plug in a real provider later, add an adapter next to `simulated.ts`
 * and switch `MARKET_DATA_PROVIDER` — nothing else in the codebase may read
 * prices directly from the engine.
 *
 * Two layers sit on top of the raw engine:
 *  1. `events.ts` — scheduled scenario events baked into the timeline
 *     (flash crashes, meme frenzies…) — applied INSIDE the engine, purely.
 *  2. `overlay.ts` — admin-activated events, applied here, with a fade.
 */

import {
  CYCLE_DAYS,
  computePrice,
  getCandles,
  getFundamentals,
  price,
  priceForDef,
  type Timeframe,
} from "./engine.js";
import {
  activeScheduledEvents,
  eventAppliesTo,
  severityOf,
  upcomingScheduledEvent,
} from "./events.js";
import { activeManualEvents, adminEventMultiplier } from "./overlay.js";
import { getStockDef, listStockDefs, type StockDef } from "./universe.js";
import type {
  AssetClass,
  Candle,
  CompanyProfile,
  Market,
  MarketEventView,
  MarketStatus,
  NewsItem,
  Quote,
  UpcomingEventView,
} from "@aadiinvest/shared";

export { CYCLE_DAYS };
export { SCHEDULED_EVENTS } from "./events.js";
export { primeMarketEventOverlay } from "./overlay.js";
export { HOUSE_STOCK, HOUSE_STOCK_NAME, listSectors } from "./universe.js";

export type { Timeframe };

const DAY_MS = 24 * 3600 * 1000;

export const TIMEFRAMES: Timeframe[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"];

export const DATA_LABEL = "SIMULATED" as const;

export const SIMULATION_DISCLOSURE =
  "All prices are simulated for education. The pattern repeats every 50 days — with scheduled crashes and rallies baked in. Nothing here is real market data.";

/** New York Stock Exchange hours in ET, used for the Market Open/Closed badge. */
function nyTimeParts(now: Date): { minutes: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  );
  const hour = parseInt(parts.hour === "24" ? "0" : parts.hour ?? "0", 10);
  const minute = parseInt(parts.minute ?? "0", 10);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekday = parts.weekday ?? "Mon";
  return { minutes: hour * 60 + minute, day: Math.max(0, days.indexOf(weekday)) };
}

export function getMarketStatus(now: Date = new Date()): MarketStatus {
  const { minutes, day } = nyTimeParts(now);
  const isWeekday = day >= 0 && day <= 4;
  const open = 9 * 60 + 30; // 09:30 ET
  const close = 16 * 60; // 16:00 ET
  const isOpen = isWeekday && minutes >= open && minutes < close;

  const note = isOpen
    ? "Market open — prices are simulated and update continuously."
    : "Market closed — showing latest available simulated price.";

  return {
    isOpen,
    nextChange: null,
    note,
  };
}

export class MarketDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketDataError";
  }
}

/* --------------------------- event-aware pricing --------------------------- */

/**
 * The price of one listing at one instant, including any scenario event.
 * Everything money-related (trading, marks, charts) goes through here.
 */
export function priceAt(symbol: string, at: Date = new Date()): number {
  const def = requireStock(symbol);
  return round2(priceForDef(def, at) * adminEventMultiplier(at));
}

/** The most recent scheduled event currently moving this listing, if any. */
export function activeEventFor(
  def: StockDef,
  at: Date = new Date(),
): MarketEventView | null {
  const active = activeScheduledEvents(at).filter((e) => eventAppliesTo(e.def, def));
  const manual = activeManualEvents(at);
  const views: MarketEventView[] = [
    ...active.map((e) => ({
      key: e.def.key,
      name: e.def.name,
      headline: e.def.headline,
      description: e.def.description,
      modifier: e.def.modifier,
      percentChange: (e.def.modifier - 1) * 100,
      scope: e.def.scope,
      target: e.def.target ?? null,
      severity: e.def.severity,
      startedAt: e.startedAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
    })),
    ...manual,
  ];
  if (views.length === 0) return null;
  // Bigger absolute move wins the headline slot.
  return views.sort(
    (a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange),
  )[0]!;
}

/** Every scenario event in effect right now (market-wide banner material). */
export function getActiveEvents(at: Date = new Date()): MarketEventView[] {
  const scheduled: MarketEventView[] = activeScheduledEvents(at).map((e) => ({
    key: e.def.key,
    name: e.def.name,
    headline: e.def.headline,
    description: e.def.description,
    modifier: e.def.modifier,
    percentChange: (e.def.modifier - 1) * 100,
    scope: e.def.scope,
    target: e.def.target ?? null,
    severity: e.def.severity,
    startedAt: e.startedAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
  }));
  return [...activeManualEvents(at), ...scheduled].sort(
    (a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange),
  );
}

/** A teaser for the next scheduled shock ("something is coming…"). */
export function getUpcomingEvent(at: Date = new Date()): UpcomingEventView | null {
  const next = upcomingScheduledEvent(at);
  if (!next) return null;
  const { def, startsAt } = next;
  const where =
    def.scope === "ALL"
      ? "the whole market"
      : def.scope === "SYMBOL"
        ? def.target ?? "one listing"
        : def.scope === "SECTOR"
          ? `${def.target ?? "one sector"} listings`
          : `${def.target ?? "one asset class"} prices`;
  return {
    key: def.key,
    name: def.name,
    teaser: `Rumour mill: “${def.name}” could hit ${where} soon. Simulated scenario event — severity ${severityOf(def.modifier)}.`,
    startsAt: startsAt.toISOString(),
    severity: def.severity,
  };
}

/* --------------------------------- quotes --------------------------------- */

export function getQuote(symbol: string, now: Date = new Date()): Quote {
  const def = requireStock(symbol);
  const p = priceAt(def.symbol, now);
  const prev = previousClose(def.symbol, now);
  const change = round2(p - prev);
  const changePercent = prev > 0 ? round2(((p - prev) / prev) * 100) : 0;

  // Day high/low: min/max of today's 15-minute samples so far
  const dayStart = startOfDayUtc(now);
  let high = p;
  let low = p;
  const step = 15 * 60000;
  for (let t = dayStart; t <= now.getTime(); t += step) {
    const q = priceAt(def.symbol, new Date(t));
    high = Math.max(high, q);
    low = Math.min(low, q);
  }

  const { volume } = computePrice(def.symbol, now);

  return {
    symbol: def.symbol,
    name: def.name,
    exchange: def.exchange,
    market: def.market,
    assetClass: def.assetClass,
    sector: def.sector,
    price: p.toFixed(2),
    change: (change >= 0 ? "+" : "") + change.toFixed(2),
    changePercent: (changePercent >= 0 ? "+" : "") + changePercent.toFixed(2),
    dayHigh: high.toFixed(2),
    dayLow: low.toFixed(2),
    volume,
    event: activeEventFor(def, now),
    label: DATA_LABEL,
  };
}

export function getHistoricalPrices(
  symbol: string,
  timeframe: Timeframe,
  now: Date = new Date(),
): Candle[] {
  requireStock(symbol);
  const { candles } = getCandles(symbol, timeframe, now);
  // Admin-activated events only exist for part of the timeline: scale each
  // candle by the multiplier in force when it closed.
  return candles.map((c) => {
    const m = adminEventMultiplier(new Date(c.time));
    const scale = (v: number) => (m === 1 ? v : round2(v * m));
    return {
      time: c.time,
      open: scale(c.open).toFixed(2),
      high: scale(c.high).toFixed(2),
      low: scale(c.low).toFixed(2),
      close: scale(c.close).toFixed(2),
      volume: c.volume,
    };
  });
}

export function searchStocks(query: string, limit = 20): Quote[] {
  const q = query.trim().toLowerCase();
  const all = listStockDefs();
  const matches = all
    .filter(
      (s) =>
        q.length === 0 ||
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q),
    )
    .slice(0, limit);

  const now = new Date();
  return matches.map((s) => getQuote(s.symbol, now));
}

export function getCompanyProfile(symbol: string): CompanyProfile {
  const profile = getCompanyProfileRaw(symbol);
  return profile;
}

function getCompanyProfileRaw(symbol: string): CompanyProfile {
  const def = requireStock(symbol);
  const f = getFundamentals(symbol);
  return {
    symbol: def.symbol,
    name: def.name,
    exchange: def.exchange,
    market: def.market,
    assetClass: def.assetClass,
    sector: def.sector,
    description: def.description,
    marketCap: f.marketCap ? f.marketCap.toLocaleString("en-CA") : "—",
    week52High: f.week52High.toFixed(2),
    week52Low: f.week52Low.toFixed(2),
    averageVolume: f.averageVolume,
    peRatio: f.peRatio ? f.peRatio.toFixed(1) : null,
    dividendYield: f.dividendYield ? `${f.dividendYield.toFixed(2)}%` : null,
    yieldLabel: f.yieldLabel,
  };
}

export function getMarketNews(symbol?: string, limit = 12): NewsItem[] {
  const now = new Date();
  const defs = symbol ? [requireStock(symbol)] : listStockDefs();
  const templates: { headline: (n: string) => string; summary: (n: string) => string; source: string }[] = [
    {
      headline: (n) => `${n} (simulated) releases quarterly results — analysts weigh outlook`,
      summary: (n) =>
        `In this simulated scenario, ${n} reported results that the simulated analyst community describes as mixed. This is a fictional story for education.`,
      source: "Market Mayhem Simulated Wire",
    },
    {
      headline: (n) => `Simulated analysts raise price target on ${n}`,
      summary: (n) =>
        `A fictional research note — generated for this simulation — imagines increased enthusiasm about ${n}. Not real research.`,
      source: "Market Mayhem Simulated Wire",
    },
    {
      headline: (n) => `${n} announces (fictional) share buyback program`,
      summary: (n) =>
        `Simulated story: ${n}'s board approves a buyback in this fictional scenario. This did not happen.`,
      source: "Market Mayhem Simulated Wire",
    },
    {
      headline: (n) => `Sector rotation narrative (simulated) touches ${n}`,
      summary: (n) =>
        `In this fictional scenario, investors rotate between sectors, affecting ${n}. Educational fiction only.`,
      source: "Market Mayhem Simulated Wire",
    },
  ];

  const items: NewsItem[] = [];

  // Scenario events make the headlines — crashes and frenzies come first.
  for (const ev of getActiveEvents(now)) {
    items.push({
      id: `event-${ev.key}-${ev.startedAt}`,
      headline: `⚡ ${ev.headline}`,
      summary: `${ev.description} Move: ${
        ev.percentChange >= 0 ? "+" : ""
      }${ev.percentChange.toFixed(1)}% while active.`,
      source: "Market Mayhem Scenario Desk",
      publishedAt: ev.startedAt,
      symbols: ev.target ? [ev.target] : [],
      label: DATA_LABEL,
    });
  }

  defs.forEach((def, di) => {
    for (let i = 0; i < 3; i++) {
      const t = templates[(def.seed + i) % templates.length]!;
      const publishedAt = new Date(
        now.getTime() - (di * 3 + i) * 7 * 3600 * 1000,
      );
      items.push({
        id: `sim-${def.symbol}-${i}`,
        headline: t.headline(def.name),
        summary: t.summary(def.name),
        source: t.source,
        publishedAt: publishedAt.toISOString(),
        symbols: [def.symbol],
        label: DATA_LABEL,
      });
    }
  });

  return items
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}

export function listQuotes(filter: {
  market?: Market | "ALL";
  assetClass?: AssetClass | "ALL";
} = {}): Quote[] {
  const defs = listStockDefs().filter((s) => {
    if (filter.market && filter.market !== "ALL" && s.market !== filter.market) return false;
    if (
      filter.assetClass &&
      filter.assetClass !== "ALL" &&
      s.assetClass !== filter.assetClass
    ) {
      return false;
    }
    return true;
  });
  const now = new Date();
  return defs.map((s) => getQuote(s.symbol, now));
}

export function listSymbolsByMarket(market: Market | "ALL"): Quote[] {
  return listQuotes({ market });
}

export function topMovers(limit = 5): { gainers: Quote[]; losers: Quote[] } {
  const quotes = listQuotes();
  const sorted = [...quotes].sort(
    (a, b) => parseFloat(b.changePercent) - parseFloat(a.changePercent),
  );
  return {
    gainers: sorted.slice(0, limit),
    losers: sorted.slice(-limit).reverse(),
  };
}

export function isKnownSymbol(symbol: string): boolean {
  return getStockDef(symbol) !== undefined;
}

export function simulationPrice(symbol: string, at: Date = new Date()): number {
  if (!isKnownSymbol(symbol)) {
    throw new MarketDataError(`Unknown symbol: ${symbol}`);
  }
  return priceAt(symbol, at);
}

/**
 * Price that never throws — for marking existing portfolios. Anything that is
 * no longer listed (a retired symbol in an old account) is worth `fallback`.
 */
export function safeSimulationPrice(
  symbol: string,
  fallback = 0,
  at: Date = new Date(),
): number {
  try {
    return priceAt(symbol, at);
  } catch {
    return fallback;
  }
}

export function stockMeta(symbol: string) {
  const def = requireStock(symbol);
  return {
    symbol: def.symbol,
    name: def.name,
    exchange: def.exchange,
    market: def.market,
    assetClass: def.assetClass,
    sector: def.sector,
    description: def.description,
  };
}

/** Raw engine price without any admin overlay (charts, debugging, tests). */
export function basePriceAt(symbol: string, at: Date = new Date()): number {
  requireStock(symbol);
  return price(symbol, at);
}

function requireStock(symbol: string) {
  const def = getStockDef(symbol);
  if (!def) throw new MarketDataError(`Unknown symbol: ${symbol}`);
  return def;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Simulated close of the previous UTC day, including scenario events. */
function previousClose(symbol: string, now: Date): number {
  const dayIndex = Math.floor(now.getTime() / DAY_MS);
  const prev = new Date((dayIndex - 1) * DAY_MS + 12 * 3600 * 1000);
  return priceAt(symbol, prev);
}

function startOfDayUtc(d: Date): number {
  const dt = new Date(d);
  dt.setUTCHours(0, 0, 0, 0);
  return dt.getTime();
}
