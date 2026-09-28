import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { badRequest, notFound } from "../utils/errors.js";
import { getCandles } from "../services/market-data/engine.js";
import { getQuote, isKnownSymbol } from "../services/market-data/index.js";
import { evaluateWatchlistAchievements } from "../services/gamification.js";
import { asyncH, validate } from "./validate.js";

const router = Router();

function sparkFor(symbol: string): number[] {
  // 24 half-hour points from the simulated engine for the mini chart.
  const { candles } = getCandles(symbol, "1D", new Date());
  return candles.slice(-24).map((c) => c.close);
}

router.get(
  "/",
  requireAuth,
  asyncH(async (req, res) => {
    const watchlist = await prisma.watchlist.findUnique({
      where: { userId: req.user!.id },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    const items = (watchlist?.items ?? []).map((item) => {
      const q = getQuote(item.symbol);
      return {
        symbol: q.symbol,
        company: q.name,
        price: q.price,
        change: q.change,
        changePercent: q.changePercent,
        spark: sparkFor(item.symbol),
      };
    });
    res.json({ items });
  }),
);

const addSchema = z.object({ symbol: z.string().min(1).max(12) });

router.post(
  "/",
  requireAuth,
  asyncH(async (req, res) => {
    const { symbol } = validate(addSchema, req.body);
    const sym = symbol.trim().toUpperCase();
    if (!isKnownSymbol(sym)) throw badRequest(`Unknown symbol: ${sym}`);

    const watchlist = await prisma.watchlist.upsert({
      where: { userId: req.user!.id },
      update: {},
      create: { userId: req.user!.id },
    });
    const item = await prisma.watchlistItem.upsert({
      where: { watchlistId_symbol: { watchlistId: watchlist.id, symbol: sym } },
      update: {},
      create: { watchlistId: watchlist.id, symbol: sym },
    });
    // Best-effort watchlist achievements (window shopper, scout, …).
    try {
      await evaluateWatchlistAchievements(req.user!.id);
    } catch {
      /* never block the watchlist on gamification */
    }
    res.status(201).json({ ok: true, symbol: item.symbol });
  }),
);

router.delete(
  "/:symbol",
  requireAuth,
  asyncH(async (req, res) => {
    const sym = String(req.params.symbol ?? "").toUpperCase();
    const watchlist = await prisma.watchlist.findUnique({
      where: { userId: req.user!.id },
    });
    if (!watchlist) throw notFound("Watchlist not found.");
    await prisma.watchlistItem.deleteMany({
      where: { watchlistId: watchlist.id, symbol: sym },
    });
    res.json({ ok: true });
  }),
);

export default router;
