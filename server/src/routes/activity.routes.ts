import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { centsToString } from "../utils/money.js";
import { asyncH } from "./validate.js";
import type { ActivityItem } from "@aadiinvest/shared";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncH(async (req, res) => {
    const filter = String(req.query.filter ?? "ALL").toUpperCase();
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 100);
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

    const where: Record<string, unknown> = { userId: req.user!.id };
    if (filter === "BUYS") where.type = "BUY";
    else if (filter === "SELLS") where.type = "SELL";
    else if (filter === "TRANSFERS")
      where.type = { in: ["WALLET_TO_INVESTMENT", "INVESTMENT_TO_WALLET"] };
    else if (filter === "ACHIEVEMENTS") where.type = "ACHIEVEMENT";
    else if (filter === "REWARDS") where.type = { in: ["XP", "ACHIEVEMENT"] };

    const [items, total] = await Promise.all([
      prisma.activityEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.activityEvent.count({ where }),
    ]);

    const mapped: ActivityItem[] = items.map((a) => ({
      id: a.id,
      type: a.type as ActivityItem["type"],
      title: a.title,
      detail: a.detail,
      amount: a.amount != null ? centsToString(a.amount) : null,
      createdAt: a.createdAt.toISOString(),
    }));
    res.json({ items: mapped, total });
  }),
);

export default router;
