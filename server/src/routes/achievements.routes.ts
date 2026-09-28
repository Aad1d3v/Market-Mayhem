import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncH } from "./validate.js";
import type { AchievementView } from "@aadiinvest/shared";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncH(async (req, res) => {
    const all = await prisma.achievement.findMany({ orderBy: { order: "asc" } });
    const mine = await prisma.userAchievement.findMany({
      where: { userId: req.user!.id },
      include: { achievement: true },
    });
    const unlockedAt = new Map(
      mine.map((ua) => [ua.achievementId, ua.unlockedAt.toISOString()]),
    );

    const items: AchievementView[] = all.map((a) => ({
      code: a.code,
      name: a.name,
      description: a.description,
      icon: a.icon,
      xpReward: a.xpReward,
      unlocked: unlockedAt.has(a.id),
      unlockedAt: unlockedAt.get(a.id) ?? null,
    }));
    res.json({ items });
  }),
);

export default router;
