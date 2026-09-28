import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncH } from "./validate.js";
import { centsToString, fromCents, MICRO_SHARES } from "../utils/money.js";
import { safeSimulationPrice } from "../services/market-data/index.js";
import { levelFromXp } from "../services/gamification.js";
import type { LeaderboardRow } from "@aadiinvest/shared";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncH(async (req, res) => {
    const users = await prisma.user.findMany({
      where: { disabled: false, leaderboardVisible: true },
      select: {
        id: true,
        username: true,
        xp: true,
        investmentAccount: { select: { cash: true } },
        holdings: { select: { shares: true, symbol: true, averageCost: true } },
      },
    });

    const userIds = users.map((u) => u.id);
    const transferSums = await prisma.transaction.groupBy({
      by: ["userId", "kind"],
      where: {
        userId: { in: userIds },
        kind: { in: ["WALLET_TO_INVESTMENT", "INVESTMENT_TO_WALLET"] },
        account: "INVESTMENT",
      },
      _sum: { amount: true },
    });
    const netInflowByUser = new Map<string, number>();
    for (const t of transferSums) {
      netInflowByUser.set(t.userId, t._sum.amount ?? 0); // cents (SQLite stores integers)
    }

    const scored = users.map((u) => {
      let holdingsValueCents = 0;
      for (const h of u.holdings) {
        const p = Math.round(safeSimulationPrice(h.symbol, h.averageCost) * 100);
        holdingsValueCents += Math.round((h.shares * p) / MICRO_SHARES);
      }
      const valueCents = holdingsValueCents + (u.investmentAccount?.cash ?? 0);
      const netInflowCents = netInflowByUser.get(u.id) ?? 80_000; // $800 default denominator
      const returnPct =
        netInflowCents > 0
          ? ((valueCents - netInflowCents) / netInflowCents) * 100
          : 0;
      return {
        id: u.id,
        username: u.username,
        level: levelFromXp(u.xp),
        portfolioValueCents: valueCents,
        returnPercent: returnPct.toFixed(2),
      };
    });

    scored.sort((a, b) => b.portfolioValueCents - a.portfolioValueCents);

    const rows: LeaderboardRow[] = scored.slice(0, 50).map((s, i) => ({
      rank: i + 1,
      username: s.username,
      level: s.level,
      portfolioValue: centsToString(s.portfolioValueCents),
      returnPercent: s.returnPercent,
      isSelf: s.id === req.user!.id,
    }));

    res.json({ items: rows, label: "SIMULATED" as const });
  }),
);

export default router;
