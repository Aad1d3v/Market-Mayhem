import { Router } from "express";
import {
  DATA_LABEL,
  getCompanyProfile,
  getHistoricalPrices,
  getMarketNews,
  getQuote,
  getMarketStatus,
  SIMULATION_DISCLOSURE,
  TIMEFRAMES,
} from "../services/market-data/index.js";
import type { Timeframe } from "../services/market-data/engine.js";
import { isKnownSymbol, MarketDataError } from "../services/market-data/index.js";
import { getStockDef } from "../services/market-data/universe.js";
import { badRequest, notFound } from "../utils/errors.js";
import { asyncH } from "./validate.js";

const router = Router();

router.get(
  "/:symbol",
  asyncH(async (req, res) => {
    const symbol = String(req.params.symbol ?? "").toUpperCase();
    if (!symbol) throw badRequest("Symbol required.");
    if (!isKnownSymbol(symbol)) throw notFound(`Unknown symbol: ${symbol}`);

    const def = getStockDef(symbol);
    res.json({
      label: DATA_LABEL,
      disclosure: SIMULATION_DISCLOSURE,
      quote: getQuote(symbol),
      profile: getCompanyProfile(symbol),
      status: getMarketStatus(),
      news: getMarketNews(symbol, 5),
      assetClass: def?.assetClass ?? "STOCK",
    });
  }),
);

router.get(
  "/:symbol/history",
  asyncH(async (req, res) => {
    const symbol = String(req.params.symbol ?? "").toUpperCase();
    const tf = String(req.query.timeframe ?? "1M") as Timeframe;
    if (!TIMEFRAMES.includes(tf)) throw badRequest("Invalid timeframe.");
    if (!isKnownSymbol(symbol)) throw notFound(`Unknown symbol: ${symbol}`);

    const candles = getHistoricalPrices(symbol, tf);
    res.json({
      label: DATA_LABEL,
      disclosure: SIMULATION_DISCLOSURE,
      symbol,
      timeframe: tf,
      candles,
    });
  }),
);

export default router;
