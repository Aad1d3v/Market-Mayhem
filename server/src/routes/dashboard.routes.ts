import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncH } from "./validate.js";
import { getPortfolioSummary } from "../services/portfolio.js";
import { topMovers, DATA_LABEL, SIMULATION_DISCLOSURE } from "../services/market-data/index.js";
import { getDailyChallenge, levelFromXp } from "../services/gamification.js";
import { centsToString } from "../utils/money.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncH(async (req, res) => {
    const userId = req.user!.id;
    const [summary, movers, challenge] = await Promise.all([
      getPortfolioSummary(userId),
      Promise.resolve(topMovers(5)),
      getDailyChallenge(userId),
    ]);

    const [watchlist, recentActivity, lessons, completedLessons, achievements] =
      await Promise.all([
        prisma.watchlist.findUnique({
          where: { userId },
          include: { items: { take: 5, orderBy: { createdAt: "asc" } } },
        }),
        prisma.activityEvent.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 6,
        }),
        prisma.lesson.count(),
        prisma.lessonProgress.count({ where: { userId } }),
        prisma.userAchievement.count({ where: { userId } }),
      ]);

    res.json({
      label: DATA_LABEL,
      disclosure: SIMULATION_DISCLOSURE,
      user: {
        username: req.user!.username,
        displayName: req.user!.displayName,
        level: levelFromXp(req.user!.xp),
        xp: req.user!.xp,
        avatarColor: req.user!.avatarColor,
      },
      summary,
      movers,
      watchlist: (watchlist?.items ?? []).map((i) => i.symbol),
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        detail: a.detail,
        amount: a.amount != null ? centsToString(a.amount) : null,
        createdAt: a.createdAt.toISOString(),
      })),
      learning: {
        lessonsTotal: lessons,
        lessonsCompleted: completedLessons,
        achievementsUnlocked: achievements,
      },
      dailyChallenge: challenge,
    });
  }),
);

export default router;
