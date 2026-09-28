import { describe, expect, it } from "vitest";
import { price } from "../src/services/market-data/engine.js";
import {
  SCHEDULED_EVENTS,
  activeScheduledEvents,
  upcomingScheduledEvent,
} from "../src/services/market-data/events.js";
import { getActiveEvents, getQuote, topMovers } from "../src/services/market-data/index.js";
import { HOUSE_STOCK, getStockDef, listStockDefs } from "../src/services/market-data/universe.js";
import { ASSET_CLASSES } from "@aadiinvest/shared";

const DAY = 24 * 3600 * 1000;
const CYCLE = 50;

/** A timestamp that lands on a given cycle day at a given UTC hour. */
function atCycleDay(cycleDay: number, hour = 15): Date {
  const dayIndex = 1000 + cycleDay; // 1000 % 50 === 0, so this is exactly cycleDay
  return new Date(dayIndex * DAY + hour * 3600 * 1000);
}

describe("simulated universe", () => {
  const stocks = listStockDefs();

  it("carries a large, varied catalogue", () => {
    expect(stocks.length).toBeGreaterThan(100);
    for (const cls of ASSET_CLASSES) {
      expect(stocks.some((s) => s.assetClass === cls)).toBe(true);
    }
    expect(stocks.some((s) => s.market === "AADI")).toBe(true);
  });

  it("has unique, well-formed symbols", () => {
    const seen = new Set<string>();
    for (const s of stocks) {
      expect(seen.has(s.symbol)).toBe(false);
      seen.add(s.symbol);
      expect(s.symbol).toMatch(/^[A-Z0-9.\-]{1,12}$/);
      expect(s.basePrice).toBeGreaterThan(0);
      expect(s.vol).toBeGreaterThan(0);
    }
  });

  it("gifts the house listing a sane price", () => {
    const house = getStockDef(HOUSE_STOCK);
    expect(house?.name).toBe("Aadidev.co");
    expect(house?.basePrice).toBeGreaterThan(1);
    expect(price(HOUSE_STOCK, new Date())).toBeGreaterThan(0);
  });

  it("keeps every listing positive and sane across a full cycle", () => {
    for (let day = 0; day < CYCLE; day += 1) {
      const t = atCycleDay(day);
      for (const s of stocks) {
        const p = price(s.symbol, t);
        expect(p).toBeGreaterThan(0);
        expect(p).toBeLessThan(1_000_000);
      }
    }
  });

  it("makes crypto far more volatile than bonds", () => {
    const swing = (symbol: string) => {
      let total = 0;
      let n = 0;
      for (let day = 0; day < CYCLE - 1; day++) {
        const a = price(symbol, atCycleDay(day));
        const b = price(symbol, atCycleDay(day + 1));
        total += Math.abs((b - a) / a);
        n++;
      }
      return total / n;
    };
    expect(swing("BTC")).toBeGreaterThan(swing("CAN10Y"));
    expect(swing("DOGE")).toBeGreaterThan(swing("SPY"));
  });
});

describe("scenario events", () => {
  it("schedules a busy cycle", () => {
    expect(SCHEDULED_EVENTS.length).toBeGreaterThanOrEqual(12);
    const keys = new Set(SCHEDULED_EVENTS.map((e) => e.key));
    expect(keys.size).toBe(SCHEDULED_EVENTS.length);
    for (const ev of SCHEDULED_EVENTS) {
      expect(ev.dayOfCycle).toBeGreaterThanOrEqual(0);
      expect(ev.dayOfCycle).toBeLessThan(CYCLE);
      expect(ev.durationHours).toBeGreaterThan(0);
      expect(ev.durationHours).toBeLessThanOrEqual(168);
      expect(ev.modifier).toBeGreaterThan(0.2);
      expect(ev.modifier).toBeLessThan(3);
    }
  });

  it("activates events only inside their window", () => {
    const crash = SCHEDULED_EVENTS.find((e) => e.key === "flash-crash")!;
    const during = atCycleDay(crash.dayOfCycle, crash.startHour + 1);
    const before = atCycleDay(crash.dayOfCycle, Math.max(0, crash.startHour - 1));
    expect(activeScheduledEvents(during).some((e) => e.def.key === "flash-crash")).toBe(true);
    expect(activeScheduledEvents(before).some((e) => e.def.key === "flash-crash")).toBe(false);
  });

  it("crashes the whole market on a flash-crash day", () => {
    const crash = SCHEDULED_EVENTS.find((e) => e.key === "flash-crash")!;
    const during = atCycleDay(crash.dayOfCycle, crash.startHour + 1);
    // A market-wide event moves every listing by the same multiplier.
    const ratio = (symbol: string) => {
      const outside = price(symbol, atCycleDay(crash.dayOfCycle - 1, 15));
      const at = price(symbol, during);
      // One day apart, so allow the normal daily drift on top of the crash.
      return at / outside;
    };
    const apple = ratio("AAPL");
    const gold = ratio("GOLD");
    expect(apple).toBeLessThan(0.85);
    expect(gold).toBeLessThan(0.85);
    // Same market-wide multiplier, so the two land close to each other.
    expect(Math.abs(apple - gold)).toBeLessThan(0.25);
  });

  it("keeps symbol-scoped events scoped", () => {
    const hype = SCHEDULED_EVENTS.find((e) => e.key === "aadidev-hype")!;
    const during = atCycleDay(hype.dayOfCycle, hype.startHour + 1);
    const base = atCycleDay(hype.dayOfCycle - 1, 15);
    expect(price("AADIDEV", during) / price("AADIDEV", base)).toBeGreaterThan(1.3);
    expect(price("AAPL", during) / price("AAPL", base)).toBeLessThan(1.15);
  });

  it("still repeats the whole pattern every 50 days", () => {
    for (const cycleDay of [4, 8, 12, 15, 24, 36, 47]) {
      const consecutiveDay = atCycleDay(cycleDay + 3, 16);
      const nextCycle = new Date(consecutiveDay.getTime() + CYCLE * DAY);
      for (const symbol of ["AAPL", "BTC", "AADIDEV", "GOLD", "CAN10Y"]) {
        expect(price(symbol, nextCycle)).toBeCloseTo(price(symbol, consecutiveDay), 4);
      }
    }
  });

  it("keeps multi-day eras running across their whole window", () => {
    const era = SCHEDULED_EVENTS.find((e) => e.key === "meltdown-era")!;
    const dayTwo = atCycleDay(era.dayOfCycle + 2, 12);
    const key = "meltdown-era";
    expect(activeScheduledEvents(dayTwo).some((e) => e.def.key === key)).toBe(true);
    expect(getActiveEvents(dayTwo).some((e) => e.key === key)).toBe(true);
    // Two days further on the era has ended.
    expect(
      activeScheduledEvents(atCycleDay(era.dayOfCycle + 6, 12)).some(
        (e) => e.def.key === key,
      ),
    ).toBe(false);
  });

  it("exposes active and upcoming events to the UI", () => {
    const flash = SCHEDULED_EVENTS.find((e) => e.key === "flash-crash")!;
    const during = atCycleDay(flash.dayOfCycle, flash.startHour + 1);
    const events = getActiveEvents(during);
    expect(events.length).toBeGreaterThan(0);
    const crash = events.find((e) => e.key === "flash-crash");
    expect(crash?.severity).toBe("crash");
    expect(crash!.percentChange).toBeLessThan(-15);
    expect(new Date(crash!.endsAt).getTime()).toBeGreaterThan(during.getTime());

    const next = upcomingScheduledEvent(atCycleDay(2, 12));
    expect(next).toBeTruthy();
    expect(next!.startsAt.getTime()).toBeGreaterThan(atCycleDay(2, 12).getTime());
  });

  it("flags the moving event on the quote", () => {
    const hype = SCHEDULED_EVENTS.find((e) => e.key === "aadidev-hype")!;
    const during = atCycleDay(hype.dayOfCycle, hype.startHour + 1);
    const quote = getQuote("AADIDEV", during);
    expect(quote.event?.key).toBe("aadidev-hype");
    expect(Number(quote.price)).toBeGreaterThan(0);
    // Other listings are untouched by a symbol-scoped event.
    expect(getQuote("AAPL", during).event?.key).not.toBe("aadidev-hype");
  });

  it("keeps ranking movers across the whole catalogue", () => {
    const { gainers, losers } = topMovers(5);
    expect(gainers).toHaveLength(5);
    expect(losers).toHaveLength(5);
    expect(Number(gainers[0]!.changePercent)).toBeGreaterThanOrEqual(
      Number(gainers[4]!.changePercent),
    );
    expect(gainers[0]!.market).toBeTruthy();
    expect(gainers[0]!.assetClass).toBeTruthy();
  });
});
