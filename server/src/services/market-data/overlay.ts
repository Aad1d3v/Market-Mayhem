/**
 * Admin-activated scenario overlay.
 *
 * The Admin panel can switch a stored MarketEvent on (Bull Run, Market Crash…).
 * Doing so makes the modifier apply to EVERY simulated price from that moment:
 * full strength for the first six hours, then fading out over the next 42 —
 * so an activated "Market Crash" is a real, temporary market crash instead of
 * a number in a table.
 *
 * The overlay is cached because `simulationPrice()` is synchronous and called
 * from the trading/portfolio hot paths. A stale read for a few seconds is
 * harmless; the refresh happens in the background.
 */

import { prisma } from "../../db.js";
import type { MarketEventView } from "@aadiinvest/shared";

const TTL_MS = 15_000;
const FULL_STRENGTH_HOURS = 6;
const FADE_HOURS = 42;
const HOUR_MS = 3600 * 1000;

interface CachedEvent {
  id: string;
  name: string;
  description: string;
  modifier: number;
  activatedAt: number;
}

let cache: { at: number; items: CachedEvent[] } = { at: 0, items: [] };
let refreshing: Promise<void> | null = null;

async function refresh(): Promise<void> {
  const rows = await prisma.marketEvent.findMany({ where: { active: true } });
  cache = {
    at: Date.now(),
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      modifier: r.modifier,
      activatedAt: r.updatedAt.getTime(),
    })),
  };
}

/** Warm the cache (called on boot and whenever an admin toggles an event). */
export function primeMarketEventOverlay(): void {
  void refresh().catch(() => {});
}

function ensureFresh(): void {
  if (Date.now() - cache.at <= TTL_MS || refreshing) return;
  refreshing = refresh()
    .catch(() => {})
    .finally(() => {
      refreshing = null;
    });
}

/** Remaining strength of an activated event, 0 when fully faded. */
function strength(ev: CachedEvent, at: Date): number {
  const ageHours = (at.getTime() - ev.activatedAt) / HOUR_MS;
  if (ageHours < 0) return 0;
  if (ageHours <= FULL_STRENGTH_HOURS) return 1;
  return Math.max(0, 1 - (ageHours - FULL_STRENGTH_HOURS) / FADE_HOURS);
}

/** Combined multiplier from admin-activated events at a given instant. */
export function adminEventMultiplier(at: Date = new Date()): number {
  ensureFresh();
  let mult = 1;
  for (const ev of cache.items) {
    const s = strength(ev, at);
    if (s > 0) mult *= 1 + (ev.modifier - 1) * s;
  }
  return mult;
}

/** Admin-activated events currently in effect, for banners and news. */
export function activeManualEvents(at: Date = new Date()): MarketEventView[] {
  ensureFresh();
  return cache.items
    .map((ev) => ({ ev, s: strength(ev, at) }))
    .filter(({ s }) => s > 0.01)
    .map(({ ev, s }) => {
      const modifier = 1 + (ev.modifier - 1) * s;
      const endsAt = new Date(
        ev.activatedAt + (FULL_STRENGTH_HOURS + FADE_HOURS) * HOUR_MS,
      );
      return {
        key: `admin-${ev.id}`,
        name: ev.name,
        headline: `Admin-triggered scenario: ${ev.name}`,
        description: ev.description,
        modifier,
        percentChange: (modifier - 1) * 100,
        scope: "MANUAL" as const,
        target: null,
        severity: (modifier < 1 ? "crash" : modifier > 1.35 ? "wild" : "rally") as
          | "crash"
          | "rally"
          | "wild",
        startedAt: new Date(ev.activatedAt).toISOString(),
        endsAt: endsAt.toISOString(),
      };
    });
}
