import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { settleSimulationSale } from "../services/simulation.js";
import { asyncH, validate } from "./validate.js";

const router = Router();

const payoutSchema = z.object({
  symbol: z.string().min(1).max(12),
  quantity: z.string().regex(/^\d+(\.\d{1,6})?$/, "Enter a valid quantity."),
  salePrice: z.string().regex(/^\d+(\.\d{1,6})?$/, "Enter a valid price."),
  costBasis: z.string().regex(/^\d+(\.\d{1,6})?$/, "Enter a valid cost basis."),
});

/**
 * Credit the profit from a profitable sandbox sale into the real Investment
 * Account. Losses are never debited — the sandbox keeps them.
 */
router.post(
  "/payout",
  requireAuth,
  asyncH(async (req, res) => {
    const input = validate(payoutSchema, req.body);
    const result = await settleSimulationSale({ userId: req.user!.id, ...input });
    res.json(result);
  }),
);

export default router;
