import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { getWallet, transfer } from "../services/portfolio.js";
import { prisma } from "../db.js";
import { badRequest } from "../utils/errors.js";
import { centsToString } from "../utils/money.js";
import { asyncH, validate } from "./validate.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncH(async (req, res) => {
    const state = await getWallet(req.user!.id);
    res.json({ ...state, label: "SIMULATED" as const });
  }),
);

const transferSchema = z.object({
  direction: z.enum(["WALLET_TO_INVESTMENT", "INVESTMENT_TO_WALLET"]),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount."),
});

router.post(
  "/transfer",
  requireAuth,
  asyncH(async (req, res) => {
    const input = validate(transferSchema, req.body);
    const result = await transfer({ userId: req.user!.id, ...input });
    res.json({ ...result, label: "SIMULATED" as const });
  }),
);

router.get(
  "/transactions",
  requireAuth,
  asyncH(async (req, res) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 100);
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.transaction.count({ where: { userId: req.user!.id } }),
    ]);
    res.json({
      items: items.map((t) => ({
        id: t.id,
        kind: t.kind,
        amount: centsToString(t.amount),
        account: t.account,
        symbol: t.symbol,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
      })),
      total,
    });
  }),
);

export default router;
