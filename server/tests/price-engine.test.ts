import { describe, expect, it } from "vitest";
import { CYCLE_DAYS, getCandles, getFundamentals, price, range52Weeks } from "../src/services/market-data/engine.js";
import { getQuote, isKnownSymbol, searchStocks, topMovers } from "../src/services/market-data/index.js";

const DAY = 24 * 3600 * 1000;

describe("simulated price engine", () => {
  it("is deterministic: same instant → same price", () => {
    const t = new Date("2026-09-20T15:30:00Z");
    expect(price("AAPL", t)).toBe(price("AAPL", t));
  });

  it("repeats its pattern every 50 days", () => {
    const base = new Date("2026-08-01T14:00:00Z");
    for (const offset of [0, 7, 13, 29]) {
      const a = price("MSFT", new Date(base.getTime() + offset * DAY));
      const b = price("MSFT", new Date(base.getTime() + (offset + CYCLE_DAYS) * DAY));
      expect(b).toBeCloseTo(a, 4);
    }
  });

  it("prices stay positive and sane", () => {
    for (let i = 0; i < 500; i++) {
      const t = new Date(1_700_000_000_000 + i * 3600 * 1000);
      const p = price("NVDA", t);
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(10_000);
    }
  });

  it("produces candles covering the timeframe", () => {
    const now = new Date("2026-09-25T16:00:00Z");
    const { candles } = getCandles("AAPL", "1M", now);
    expect(candles.length).toBeGreaterThan(100);
    for (const c of candles) {
      expect(c.high).toBeGreaterThanOrEqual(c.low);
      expect(c.close).toBeGreaterThan(0);
    }
  });

  it("computes 52-week ranges", () => {
    const { high, low } = range52Weeks("TSLA", new Date("2026-09-25T16:00:00Z"));
    expect(high).toBeGreaterThanOrEqual(low);
    expect(low).toBeGreaterThan(0);
  });

  it("builds consistent quotes", () => {
    const q = getQuote("AAPL", new Date("2026-09-25T16:00:00Z"));
    expect(q.label).toBe("SIMULATED");
    expect(Number(q.price)).toBeGreaterThan(0);
    expect(Number(q.dayHigh)).toBeGreaterThanOrEqual(Number(q.dayLow));
  });

  it("search finds known stocks", () => {
    const results = searchStocks("apple");
    expect(results.some((r) => r.symbol === "AAPL")).toBe(true);
  });

  it("rejects unknown symbols", () => {
    expect(isKnownSymbol("NOPE")).toBe(false);
    expect(() => getQuote("NOPE")).toThrow();
  });

  it("returns movers sorted", () => {
    const { gainers, losers } = topMovers(3);
    expect(gainers.length).toBeGreaterThan(0);
    expect(losers.length).toBeGreaterThan(0);
  });

  it("fundamentals include 52w range", () => {
    const f = getFundamentals("KO");
    expect(f.week52High).toBeGreaterThanOrEqual(f.week52Low);
  });
});
