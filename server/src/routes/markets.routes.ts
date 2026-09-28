import { Router } from "express";
import {
  DATA_LABEL,
  getActiveEvents,
  getMarketNews,
  getMarketStatus,
  getUpcomingEvent,
  listQuotes,
  listSectors,
  searchStocks,
  SIMULATION_DISCLOSURE,
  topMovers,
} from "../services/market-data/index.js";
import { getNewsFeed } from "../services/market-data/news-engine.js";
import { getMarketState, getSectorHeatmap, REGIME_META, type MarketState } from "../services/market-data/market-state.js";
import type { MarketStateView } from "@aadiinvest/shared";

function marketStateView(state?: MarketState): MarketStateView {
  const s = state ?? getMarketState();
  const meta = REGIME_META[s.regime];
  return {
    regime: s.regime,
    regimeLabel: meta.label,
    regimeEmoji: meta.emoji,
    regimeBlurb: meta.blurb,
    sentiment: s.sentiment,
    indexChangePercent: s.indexChangePercent,
    breadth: s.breadth,
    volatility: s.volatility,
    sectorsUp: s.sectorsUp,
    sectorsDown: s.sectorsDown,
  };
}

export { marketStateView };
import { ASSET_CLASSES, type AssetClass, type Market } from "@aadiinvest/shared";
import { badRequest } from "../utils/errors.js";
import { asyncH } from "./validate.js";

const router = Router();

const baseMeta = {
  label: DATA_LABEL,
  disclosure: SIMULATION_DISCLOSURE,
};

/** Simple TTL cache so polling clients don't recompute identical payloads. */
const TTL = 10_000;
const cache = new Map<string, { at: number; body: unknown }>();
function cached(key: string, fn: () => unknown): unknown {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.body;
  const body = fn();
  cache.set(key, { at: Date.now(), body });
  return body;
}

router.get(
  "/",
  asyncH(async (req, res) => {
    const market = String(req.query.market ?? "ALL").toUpperCase();
    if (!["ALL", "US", "CA", "AADI"].includes(market)) {
      throw badRequest("Invalid market filter.");
    }
    const assetClass = String(req.query.assetClass ?? "ALL").toUpperCase();
    if (assetClass !== "ALL" && !ASSET_CLASSES.includes(assetClass as AssetClass)) {
      throw badRequest("Invalid asset class filter.");
    }
    const body = cached(`markets:${market}:${assetClass}`, () => ({
      ...baseMeta,
      status: getMarketStatus(),
      events: getActiveEvents(),
      upcoming: getUpcomingEvent(),
      movers: topMovers(5),
      sectors: listSectors(),
      quotes: listQuotes({
        market: market as Market | "ALL",
        assetClass: assetClass as AssetClass | "ALL",
      }),
    }));
    res.json(body);
  }),
);

router.get(
  "/search",
  asyncH(async (req, res) => {
    const q = String(req.query.q ?? "");
    const body = cached(`search:${q.toLowerCase()}`, () => ({
      ...baseMeta,
      results: searchStocks(q, 15),
    }));
    res.json(body);
  }),
);

router.get(
  "/status",
  asyncH(async (_req, res) => {
    res.json(getMarketStatus());
  }),
);

router.get(
  "/events",
  asyncH(async (_req, res) => {
    res.json(cached("events", () => ({
      ...baseMeta,
      events: getActiveEvents(),
      upcoming: getUpcomingEvent(),
    })));
  }),
);

router.get(
  "/news",
  asyncH(async (req, res) => {
    const symbol = req.query.symbol ? String(req.query.symbol).toUpperCase() : undefined;
    const sector = req.query.sector ? String(req.query.sector) : undefined;
    const category = req.query.category ? String(req.query.category).toUpperCase() : undefined;
    const body = cached(`news2:${symbol ?? "all"}:${sector ?? "all"}:${category ?? "all"}`, () => {
      let items = getNewsFeed();
      if (symbol) items = items.filter((n) => n.symbols.includes(symbol));
      if (sector) items = items.filter((n) => n.sectors.includes(sector));
      if (category && category !== "ALL") items = items.filter((n) => n.category === category);
      return { ...baseMeta, items };
    });
    res.json(body);
  }),
);

router.get(
  "/state",
  asyncH(async (_req, res) => {
    res.json(cached("state", () => ({
      ...baseMeta,
      state: marketStateView(),
      heatmap: getSectorHeatmap(),
    })));
  }),
);

router.get(
  "/movers",
  asyncH(async (_req, res) => {
    const body = cached("movers", () => ({ ...baseMeta, ...topMovers(5) }));
    res.json(body);
  }),
);

export default router;
