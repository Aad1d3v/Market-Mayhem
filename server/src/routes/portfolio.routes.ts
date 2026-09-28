import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getPortfolioHistory,
  getPortfolioSummary,
} from "../services/portfolio.js";
import { asyncH } from "./validate.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncH(async (req, res) => {
    const summary = await getPortfolioSummary(req.user!.id);
    res.json({ ...summary, label: "SIMULATED" as const });
  }),
);

router.get(
  "/history",
  requireAuth,
  asyncH(async (req, res) => {
    const history = await getPortfolioHistory(req.user!.id);
    res.json({ items: history });
  }),
);

export default router;
