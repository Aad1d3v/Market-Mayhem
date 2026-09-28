import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { notFound } from "../utils/errors.js";
import { asyncH, validate } from "./validate.js";
import type { NotificationView } from "@aadiinvest/shared";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncH(async (req, res) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 50);
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({ where: { userId: req.user!.id, read: false } }),
    ]);
    const mapped: NotificationView[] = items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    }));
    res.json({ items: mapped, unread });
  }),
);

router.post(
  "/:id/read",
  requireAuth,
  asyncH(async (req, res) => {
    const id = String(req.params.id);
    const n = await prisma.notification.findFirst({
      where: { id, userId: req.user!.id },
    });
    if (!n) throw notFound("Notification not found.");
    await prisma.notification.update({ where: { id: n.id }, data: { read: true } });
    res.json({ ok: true });
  }),
);

router.post(
  "/read-all",
  requireAuth,
  asyncH(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true },
    });
    res.json({ ok: true });
  }),
);

export default router;
