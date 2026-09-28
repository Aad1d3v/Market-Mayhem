import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { levelFromXp } from "../services/gamification.js";
import { asyncH, validate } from "./validate.js";
import type { AuthUser, NotificationPrefs } from "@aadiinvest/shared";

const router = Router();

export function toAuthUser(u: {
  id: string;
  username: string;
  displayName: string | null;
  email: string;
  role: string;
  emailVerified: boolean;
  xp: number;
  avatarColor: string;
  tutorialCompleted: boolean;
  leaderboardVisible: boolean;
  notificationPrefs: unknown;
  createdAt: Date;
  achievementCount: number;
}): AuthUser {
  // notificationPrefs is stored as a JSON string in SQLite.
  let raw: Partial<NotificationPrefs> = {};
  if (typeof u.notificationPrefs === "string") {
    try {
      raw = JSON.parse(u.notificationPrefs) as Partial<NotificationPrefs>;
    } catch {
      raw = {};
    }
  } else if (u.notificationPrefs && typeof u.notificationPrefs === "object") {
    raw = u.notificationPrefs as Partial<NotificationPrefs>;
  }
  const prefs = raw;
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    email: u.email,
    role: u.role === "ADMIN" ? "ADMIN" : "USER",
    emailVerified: u.emailVerified,
    level: levelFromXp(u.xp),
    xp: u.xp,
    avatarColor: u.avatarColor,
    tutorialCompleted: u.tutorialCompleted,
    leaderboardVisible: u.leaderboardVisible,
    notificationPrefs: {
      orderFilled: prefs.orderFilled ?? true,
      achievements: prefs.achievements ?? true,
      learning: prefs.learning ?? true,
      marketEvents: prefs.marketEvents ?? true,
      support: prefs.support ?? true,
    },
    createdAt: u.createdAt.toISOString(),
    achievementCount: u.achievementCount,
  };
}

router.get(
  "/",
  requireAuth,
  asyncH(async (req, res) => {
    const user = req.user!;
    const achievementCount = await prisma.userAchievement.count({
      where: { userId: user.id },
    });
    const tutorial = await prisma.tutorialProgress.findUnique({
      where: { userId: user.id },
    });
    res.json(
      toAuthUser({
        ...user,
        achievementCount,
        tutorialCompleted: user.tutorialCompleted || Boolean(tutorial?.completed),
      }),
    );
  }),
);

const patchSchema = z.object({
  displayName: z.string().min(1).max(40).optional(),
  leaderboardVisible: z.boolean().optional(),
  notificationPrefs: z
    .object({
      orderFilled: z.boolean(),
      achievements: z.boolean(),
      learning: z.boolean(),
      marketEvents: z.boolean(),
      support: z.boolean(),
    })
    .optional(),
});

router.patch(
  "/",
  requireAuth,
  asyncH(async (req, res) => {
    const input = validate(patchSchema, req.body);
    const user = req.user!;
    const data: Record<string, unknown> = {};
    if (input.displayName !== undefined) data.displayName = input.displayName;
    if (input.leaderboardVisible !== undefined)
      data.leaderboardVisible = input.leaderboardVisible;
    if (input.notificationPrefs !== undefined)
      data.notificationPrefs = input.notificationPrefs;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
    });
    const achievementCount = await prisma.userAchievement.count({
      where: { userId: user.id },
    });
    res.json(
      toAuthUser({
        ...updated,
        achievementCount,
      }),
    );
  }),
);

export default router;
