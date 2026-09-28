import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { getOrder, listOrders, placeOrder } from "../services/trading.js";
import { centsToString, fromMicro } from "../utils/money.js";
import { asyncH, validate } from "./validate.js";

const router = Router();

const placeSchema = z.object({
  side: z.enum(["BUY", "SELL"]),
  symbol: z.string().min(1).max(12),
  quantity: z.string().regex(/^\d+(\.\d{1,6})?$/, "Enter a valid quantity."),
  clientRequestId: z.string().max(64).optional(),
});

router.post(
  "/",
  requireAuth,
  asyncH(async (req, res) => {
    const input = validate(placeSchema, req.body);
    const result = await placeOrder({ userId: req.user!.id, ...input });
    res.status(201).json(result);
  }),
);

router.get(
  "/",
  requireAuth,
  asyncH(async (req, res) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 100);
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);
    const orders = await listOrders(req.user!.id, limit + offset);
    const page = orders.slice(offset, offset + limit);
    res.json({
      items: page.map((o) => ({
        id: o.id,
        side: o.side,
        symbol: o.symbol,
        quantity: fromMicro(o.quantity).toString(),
        price: o.price != null ? centsToString(o.price) : null,
        total: o.total != null ? centsToString(o.total) : null,
        status: o.status,
        reason: o.reason,
        createdAt: o.createdAt.toISOString(),
      })),
    });
  }),
);

router.get(
  "/:id",
  requireAuth,
  asyncH(async (req, res) => {
    const order = await getOrder(req.user!.id, String(req.params.id));
    res.json({
      id: order.id,
      side: order.side,
      symbol: order.symbol,
      quantity: fromMicro(order.quantity).toString(),
      price: order.price != null ? centsToString(order.price) : null,
      total: order.total != null ? centsToString(order.total) : null,
      status: order.status,
      reason: order.reason,
      createdAt: order.createdAt.toISOString(),
    });
  }),
);

export default router;
