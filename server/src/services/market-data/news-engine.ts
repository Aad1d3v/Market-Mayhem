/**
 * Dynamic news engine — the "market wire".
 *
 * Every story is a DETERMINISTIC function of the simulated timeline: the same
 * instant always produces the same feed (no randomness at runtime, nothing
 * stored). Stories react to the real market state — regime, active scenario
 * events, sector heatmap — so the news explains what is actually moving and
 * the player can read the feed and act on it.
 *
 * Categories: EARNINGS, MANAGEMENT, PRODUCT, LEGAL, ANALYST, MACRO, SECTOR,
 * CRISIS, DIVIDEND. Each story carries severity (−3..+3), sentiment and the
 * exact symbols/sectors it concerns.
 */

import { getSectorHeatmap, getMarketState } from "./market-state.js";
import { activeScheduledEvents } from "./events.js";
import { listStockDefs, type StockDef } from "./universe.js";
import { hash, rand } from "./news-rng.js";
import type { MarketRegime, NewsCategory, NewsSentiment, NewsView, SectorHeatRow } from "@aadiinvest/shared";

const HOUR_MS = 3600 * 1000;

/** One story template: builds a headline + body for a target listing. */
interface StoryTemplate {
  category: NewsCategory;
  /** +3 .. −3, used for both sentiment and severity. */
  impact: number;
  minAssetClass?: "STOCK";
  headline: (name: string, sector: string) => string;
  body: (name: string, sector: string, regime: MarketRegime) => string;
}

const STOCK_TEMPLATES: StoryTemplate[] = [
  {
    category: "EARNINGS",
    impact: 2,
    minAssetClass: "STOCK",
    headline: (n) => `${n} beats quarterly earnings expectations (simulated)`,
    body: (n, s) => `In this fictional quarter, ${n} reported results above what simulated analysts expected. Revenue in the simulated ${s.toLowerCase()} segment carried the beat. Markets tend to reward clean beats — the question is always whether the next quarter can repeat it.`,
  },
  {
    category: "EARNINGS",
    impact: -2,
    minAssetClass: "STOCK",
    headline: (n) => `${n} misses earnings as costs climb (simulated)`,
    body: (n, s) => `A fictional earnings miss: ${n} reported results below expectations, with rising costs squeezed through the simulated ${s.toLowerCase()} business. Misses rarely end trends by themselves, but they give the bears something to point at.`,
  },
  {
    category: "MANAGEMENT",
    impact: -2,
    minAssetClass: "STOCK",
    headline: (n) => `${n} CEO steps down unexpectedly (simulated)`,
    body: (n) => `Fictional board drama: ${n}'s chief executive is out, effective immediately in this simulated storyline. Leadership surprises create uncertainty, and markets generally price uncertainty as risk until a successor is named.`,
  },
  {
    category: "MANAGEMENT",
    impact: 1,
    minAssetClass: "STOCK",
    headline: (n) => `${n} appoints a widely respected new CEO (simulated)`,
    body: (n, s) => `In this fictional scenario, ${n} named a new chief executive with a strong track record across the simulated ${s.toLowerCase()} industry. Investors often give new leadership the benefit of the doubt — for a while.`,
  },
  {
    category: "PRODUCT",
    impact: 2,
    minAssetClass: "STOCK",
    headline: (n) => `${n} unveils a surprise product line (simulated)`,
    body: (n, s) => `A fictional launch event: ${n} revealed an unexpected addition to its ${s.toLowerCase()} lineup. Hype and reality often diverge — the tape will decide which one this is.`,
  },
  {
    category: "PRODUCT",
    impact: -2,
    minAssetClass: "STOCK",
    headline: (n) => `${n}'s flagship product faces a recall (simulated)`,
    body: (n) => `Fictional quality trouble: ${n} is recalling part of its flagship line in this simulated scenario. Recalls cost money today and trust tomorrow.`,
  },
  {
    category: "LEGAL",
    impact: -2,
    minAssetClass: "STOCK",
    headline: (n) => `Regulators open an investigation into ${n} (simulated)`,
    body: (n) => `A fictional probe: simulated regulators are examining parts of ${n}'s business. Investigations can drag on for quarters, and headlines tend to arrive faster than resolutions.`,
  },
  {
    category: "LEGAL",
    impact: 2,
    minAssetClass: "STOCK",
    headline: (n) => `${n} wins its landmark court case (simulated)`,
    body: (n) => `Fictional courtroom win: ${n} prevailed in a case that had hung over the stock in this simulated storyline. Overhangs lifting is one of the cleaner catalysts in markets.`,
  },
  {
    category: "ANALYST",
    impact: 1,
    minAssetClass: "STOCK",
    headline: (n) => `Analysts upgrade ${n}, citing momentum (simulated)`,
    body: (n) => `A fictional research note raises its rating on ${n}. Upgrades tend to follow price rather than lead it — worth remembering.`,
  },
  {
    category: "ANALYST",
    impact: -1,
    minAssetClass: "STOCK",
    headline: (n) => `Analysts downgrade ${n} on valuation (simulated)`,
    body: (n) => `Fictional research desk cuts ${n} to neutral in this simulated storyline, arguing the easy money has been made.`,
  },
  {
    category: "DIVIDEND",
    impact: 1,
    minAssetClass: "STOCK",
    headline: (n) => `${n} raises its dividend (simulated)`,
    body: (n) => `Fictional capital-return news: ${n} lifted its payout to shareholders in this simulated scenario. Dividend growth is usually a management confidence signal.`,
  },
  {
    category: "DIVIDEND",
    impact: -2,
    minAssetClass: "STOCK",
    headline: (n) => `${n} cuts its dividend to preserve cash (simulated)`,
    body: (n) => `A fictional dividend cut: ${n} is keeping the cash in this simulated storyline. Income investors often treat cuts as a five-alarm fire.`,
  },
];

/** Macro / sector stories driven by the market state itself. */
function macroStories(state: ReturnType<typeof getMarketState>, heat: SectorHeatRow[], now: Date): NewsView[] {
  const out: NewsView[] = [];
  const meta = { source: "Market Mayhem Macro Desk", label: "SIMULATED" as const };

  const regimeStory: Record<MarketRegime, { headline: string; body: string; severity: number; sentiment: NewsSentiment; category: NewsCategory }> = {
    NORMAL: {
      headline: "Markets trade in a calm range as investors wait for a catalyst",
      body: "A quiet session in the simulated tape: no dominant theme, sectors mixed. Calm regimes are when disciplined plans are easiest to follow — and easiest to forget.",
      severity: 0, sentiment: "NEUTRAL", category: "MACRO",
    },
    BULL: {
      headline: "Breadth surge: most listings climb as risk appetite returns",
      body: "The simulated market is broadly higher with strong participation across sectors. Rising tides are pleasant, but this is precisely when players stop checking what they own.",
      severity: 2, sentiment: "POSITIVE", category: "MACRO",
    },
    BEAR: {
      headline: "Sustained selling pressure drags major averages lower",
      body: "Another down session in the simulated market as sellers keep control. Bear phases are historically where long-term plans are actually tested.",
      severity: -2, sentiment: "NEGATIVE", category: "MACRO",
    },
    CRASH: {
      headline: "PANIC: simulated market in freefall as sellers hit every bid",
      body: "A violent, broad sell-off is underway in the simulated tape. Everything is correlated when liquidity leaves. Investors who survive crashes usually do it with position sizing, not predictions.",
      severity: -3, sentiment: "NEGATIVE", category: "CRISIS",
    },
    RECOVERY: {
      headline: "Bargain hunters return: beaten-down listings bounce",
      body: "After the damage, buyers are stepping back into the simulated market. Recoveries are real but rarely straight lines — bounces can fail.",
      severity: 1, sentiment: "POSITIVE", category: "MACRO",
    },
    VOLATILE: {
      headline: "Volatility spike: whipsaw session sees big moves in both directions",
      body: "The simulated market cannot decide what it wants. Large intraday swings punish oversizing and reward patience.",
      severity: -1, sentiment: "NEUTRAL", category: "MACRO",
    },
  };
  const rs = regimeStory[state.regime];
  out.push({
    id: `macro-${state.regime}-${Math.floor(now.getTime() / HOUR_MS)}`,
    headline: rs.headline,
    summary: rs.body,
    source: meta.source,
    publishedAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
    symbols: [],
    sectors: [],
    label: meta.label,
    category: rs.category,
    sentiment: rs.sentiment,
    severity: rs.severity,
  });

  // Best and worst sector stories from the real heatmap.
  const best = heat[0];
  const worst = heat[heat.length - 1];
  if (best && best.changePercent > 1) {
    out.push({
      id: `sector-boom-${best.sector}-${Math.floor(now.getTime() / HOUR_MS)}`,
      headline: `${best.sector} leads the market higher (simulated sector boom)`,
      summary: `Every simulated story has a leader. Today it is ${best.sector}, up ${best.changePercent.toFixed(1)}% on average across ${best.listings} listings. Sector momentum can run further than anyone expects — in both directions.`,
      source: meta.source,
      publishedAt: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
      symbols: [], sectors: [best.sector], label: meta.label,
      category: "SECTOR", sentiment: "POSITIVE", severity: 1,
    });
  }
  if (worst && worst.changePercent < -1) {
    out.push({
      id: `sector-drop-${worst.sector}-${Math.floor(now.getTime() / HOUR_MS)}`,
      headline: `${worst.sector} sold off hard (simulated sector stress)`,
      summary: `${worst.sector} is the weakest corner of the simulated market today at ${worst.changePercent.toFixed(1)}% on average across ${worst.listings} listings. Concentration in a falling sector is how single-stock risk becomes portfolio risk.`,
      source: meta.source,
      publishedAt: new Date(now.getTime() - 50 * 60 * 1000).toISOString(),
      symbols: [], sectors: [worst.sector], label: meta.label,
      category: "SECTOR", sentiment: "NEGATIVE", severity: -1,
    });
  }

  // Active scenario events become CRISIS/SECTOR headlines with symbols.
  for (const ev of activeScheduledEvents(now).map((e) => ({
    key: e.def.key,
    headline: e.def.headline,
    description: e.def.description,
    percentChange: (e.def.modifier - 1) * 100,
    scope: e.def.scope,
    target: e.def.target,
    startedAt: e.startedAt.toISOString(),
    severity: e.def.severity,
  }))) {
    out.push({
      id: `event-${ev.key}-${ev.startedAt}`,
      headline: `⚡ ${ev.headline}`,
      summary: `${ev.description} Move: ${ev.percentChange >= 0 ? "+" : ""}${ev.percentChange.toFixed(1)}% while active.`,
      source: "Market Mayhem Scenario Desk",
      publishedAt: ev.startedAt,
      symbols: ev.target ? [ev.target] : [],
      sectors: ev.scope === "SECTOR" && ev.target ? [ev.target] : [],
      label: meta.label,
      category: ev.severity === "crash" ? "CRISIS" : "SECTOR",
      sentiment: ev.percentChange >= 0 ? "POSITIVE" : "NEGATIVE",
      severity: ev.percentChange >= 0 ? 2 : -2,
    });
  }
  return out;
}

function sentimentOf(impact: number): NewsSentiment {
  return impact > 0 ? "POSITIVE" : impact < 0 ? "NEGATIVE" : "NEUTRAL";
}

/**
 * Build the feed at `now`. Deterministic: same instant → same stories.
 * Roughly 14 company stories + macro/sector/scenario items, newest first.
 */
export function getNewsFeed(now: Date = new Date()): NewsView[] {
  const state = getMarketState(now);
  const heat = getSectorHeatmap(now);
  const defs = listStockDefs().filter((d) => d.assetClass === "STOCK" || d.assetClass === "ETF");

  // Rotate which listings get the spotlight this hour, deterministically.
  const hourSlot = Math.floor(now.getTime() / HOUR_MS);
  const items: NewsView[] = [...macroStories(state, heat, now)];

  const spotlightCount = Math.min(14, defs.length);
  for (let i = 0; i < spotlightCount; i += 1) {
    const def: StockDef = defs[(hourSlot * 7 + i * 11) % defs.length]!;
    const tpl = STOCK_TEMPLATES[(hash(def.symbol) + hourSlot + i) % STOCK_TEMPLATES.length]!;
    const jitter = rand(hash(`${def.symbol}:${hourSlot}:${i}`)) * 50 * 60 * 1000;
    items.push({
      id: `story-${def.symbol}-${tpl.category}-${hourSlot}`,
      headline: tpl.headline(def.name, def.sector),
      summary: tpl.body(def.name, def.sector, state.regime),
      source: "Market Mayhem Simulated Wire",
      publishedAt: new Date(now.getTime() - (i + 1) * 40 * 60 * 1000 - jitter).toISOString(),
      symbols: [def.symbol],
      sectors: [def.sector],
      label: "SIMULATED",
      category: tpl.category,
      sentiment: sentimentOf(tpl.impact),
      severity: tpl.impact,
    });
  }

  return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
