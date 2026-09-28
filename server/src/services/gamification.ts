/**
 * Gamification: XP, achievements, activity feed, notifications.
 * All XP/achievement logic is server-side only — clients cannot award XP.
 */

import { prisma } from "../db.js";
import { toCents } from "../utils/money.js";
import { getStockDef, type AssetClass } from "./market-data/universe.js";

/** Notification types (SQLite schema stores them as strings). */
type NotificationType =
  | "ORDER_FILLED"
  | "ORDER_FAILED"
  | "ACHIEVEMENT"
  | "LEARNING"
  | "MARKET_EVENT"
  | "SUPPORT";

export async function addXp(userId: string, amount: number, reason: string) {
  if (amount <= 0) return;
  await prisma.user.update({
    where: { id: userId },
    data: { xp: { increment: amount } },
  });
}

export function levelFromXp(xp: number): number {
  // Level thresholds: 0, 250, 600, 1050, 1600, ... (growing by 100 each level)
  let level = 1;
  let need = 250;
  let acc = 0;
  while (xp >= acc + need) {
    acc += need;
    level += 1;
    need += 100;
  }
  return level;
}

export async function logActivity(
  userId: string,
  type: string,
  title: string,
  detail?: string,
  amountCents?: number | null,
) {
  await prisma.activityEvent.create({
    data: {
      userId,
      type,
      title,
      detail: detail ?? null,
      amount: amountCents ?? null,
    },
  });
}

export async function notify(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
) {
  const prefs = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPrefs: true },
  });
  if (!prefs) return;
  // notificationPrefs is stored as a JSON string (SQLite).
  let parsed: Partial<Record<string, boolean>> = {};
  if (typeof prefs.notificationPrefs === "string") {
    try {
      parsed = JSON.parse(prefs.notificationPrefs);
    } catch {
      parsed = {};
    }
  } else if (prefs.notificationPrefs && typeof prefs.notificationPrefs === "object") {
    parsed = prefs.notificationPrefs as Partial<Record<string, boolean>>;
  }
  const prefKey: Record<NotificationType, boolean> = {
    ORDER_FILLED: parsed.orderFilled ?? true,
    ORDER_FAILED: true,
    ACHIEVEMENT: parsed.achievements ?? true,
    LEARNING: parsed.learning ?? true,
    MARKET_EVENT: parsed.marketEvents ?? true,
    SUPPORT: parsed.support ?? true,
  };
  if (!prefKey[type]) return;

  await prisma.notification.create({
    data: { userId, type, title, body },
  });
}

/** Unlock an achievement if not already unlocked; returns it when newly unlocked. */
async function unlock(userId: string, code: string) {
  const achievement = await prisma.achievement.findUnique({ where: { code } });
  if (!achievement) return null;
  const existing = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId: achievement.id } },
  });
  if (existing) return null;

  await prisma.userAchievement.create({
    data: { userId, achievementId: achievement.id },
  });
  await addXp(userId, achievement.xpReward, `Achievement: ${achievement.name}`);
  await notify(
    userId,
    "ACHIEVEMENT",
    `Achievement unlocked: ${achievement.name}`,
    `${achievement.description} (+${achievement.xpReward} XP)`,
  );
  await logActivity(
    userId,
    "ACHIEVEMENT",
    `Achievement unlocked: ${achievement.name}`,
    achievement.description,
  );
  return achievement;
}

export interface TradeContext {
  side: "BUY" | "SELL";
  symbol: string;
  quantity: string;
  total: number; // cents
  realizedPL: number | null; // cents, for sells
  investmentAccountValue: number; // cents
  tradeCount: number;
  holdingsCount: number;
}

/** Evaluate trade-related achievements after an executed trade. */
export async function evaluateTradeAchievements(
  userId: string,
  ctx: TradeContext,
): Promise<string[]> {
  const unlocked: string[] = [];

  const first = await unlock(userId, "FIRST_TRADE");
  if (first) unlocked.push(first.code);
  if (ctx.side === "BUY") {
    const a = await unlock(userId, "FIRST_BUY");
    if (a) unlocked.push(a.code);
  } else {
    const a = await unlock(userId, "FIRST_SELL");
    if (a) unlocked.push(a.code);
    const pl = ctx.realizedPL ?? 0;
    if (pl > 0) {
      const p = await unlock(userId, "FIRST_PROFIT");
      if (p) unlocked.push(p.code);
    } else if (pl < 0) {
      const l = await unlock(userId, "FIRST_LOSS");
      if (l) unlocked.push(l.code);
      const s = await unlock(userId, "MARKET_SURVIVOR");
      if (s) unlocked.push(s.code);
    }
  }

  if (ctx.tradeCount >= 5) {
    const a = await unlock(userId, "FIVE_TRADES");
    if (a) unlocked.push(a.code);
  }
  if (ctx.tradeCount >= 10) {
    const a = await unlock(userId, "TEN_TRADES");
    if (a) unlocked.push(a.code);
  }
  if (ctx.tradeCount >= 25) {
    const a = await unlock(userId, "TWENTY_FIVE_TRADES");
    if (a) unlocked.push(a.code);
  }
  if (ctx.tradeCount >= 50) {
    const a = await unlock(userId, "FIFTY_TRADES");
    if (a) unlocked.push(a.code);
  }
  if (ctx.tradeCount >= 100) {
    const a = await unlock(userId, "HUNDRED_TRADES");
    if (a) unlocked.push(a.code);
  }
  if (ctx.holdingsCount >= 4) {
    const a = await unlock(userId, "DIVERSIFIED");
    if (a) unlocked.push(a.code);
  }

  const value = ctx.investmentAccountValue; // cents
  if (value >= 100_000) {
    const a = await unlock(userId, "PORTFOLIO_1000");
    if (a) unlocked.push(a.code);
  }
  if (value >= 500_000) {
    const a = await unlock(userId, "PORTFOLIO_5000");
    if (a) unlocked.push(a.code);
  }
  if (value >= 1_000_000) {
    const a = await unlock(userId, "PORTFOLIO_10000");
    if (a) unlocked.push(a.code);
  }
  if (value >= 2_500_000) {
    const a = await unlock(userId, "PORTFOLIO_25000");
    if (a) unlocked.push(a.code);
  }

  // Asset-class explorer achievements, evaluated on the traded listing.
  const def = getStockDef(ctx.symbol);
  if (def) {
    const cls: AssetClass = def.assetClass;
    const classCode: Partial<Record<AssetClass, string>> = {
      CRYPTO: "CRYPTO_CURIOUS",
      COMMODITY: "COMMODITY_TRADER",
      BOND: "BOND_HOLDER",
      ETF: "FUND_BELIEVER",
    };
    const code = classCode[cls];
    if (code && ctx.side === "BUY") {
      const a = await unlock(userId, code);
      if (a) unlocked.push(a.code);
    }
    if (cls === "COMMODITY" && def.sector === "Precious Metals" && ctx.side === "BUY") {
      const a = await unlock(userId, "GOLD_FINGER");
      if (a) unlocked.push(a.code);
    }
    if (def.market === "AADI" && ctx.side === "BUY") {
      const a = await unlock(userId, "AADIVERSE_LOCAL");
      if (a) unlocked.push(a.code);
    }
  }

  // Asset-Class Tourist: 4+ distinct asset classes held at once.
  if (ctx.holdingsCount >= 4) {
    const classes = new Set<AssetClass>();
    const holdings = await prisma.holding.findMany({
      where: { userId },
      select: { symbol: true },
    });
    for (const h of holdings) {
      const hd = getStockDef(h.symbol);
      if (hd) classes.add(hd.assetClass);
    }
    if (classes.size >= 4) {
      const a = await unlock(userId, "CLASS_TOURIST");
      if (a) unlocked.push(a.code);
    }
  }

  // Night Owl: trade between 22:00 and 04:00 local server time (crypto hours).
  const hour = new Date().getHours();
  if (hour >= 22 || hour < 4) {
    const a = await unlock(userId, "NIGHT_OWL");
    if (a) unlocked.push(a.code);
  }

  return unlocked;
}

/** Market swing achievements: hold while simulated market moves ±5% in a day. */
export async function evaluateMarketSwing(
  userId: string,
  hasHoldings: boolean,
  marketChangePercent: number,
) {
  if (!hasHoldings) return;
  if (marketChangePercent >= 5) await unlock(userId, "BULL_MARKET");
  if (marketChangePercent <= -5) await unlock(userId, "BEAR_MARKET");
}

export async function evaluateLearningAchievements(
  userId: string,
  lessonsCompleted: number,
  quizzesPassed: number,
) {
  const unlocked: string[] = [];
  if (lessonsCompleted >= 1) {
    const a = await unlock(userId, "LEARNER");
    if (a) unlocked.push(a.code);
  }
  if (quizzesPassed >= 3) {
    const a = await unlock(userId, "QUIZ_MASTER");
    if (a) unlocked.push(a.code);
  }
  return unlocked;
}

/** Watchlist achievements after a watchlist add/remove. */
export async function evaluateWatchlistAchievements(userId: string) {
  const count = await prisma.watchlistItem.count({
    where: { watchlist: { userId } },
  });
  const unlocked: string[] = [];
  if (count >= 1) {
    const a = await unlock(userId, "WATCHLIST_STARTER");
    if (a) unlocked.push(a.code);
  }
  if (count >= 5) {
    const a = await unlock(userId, "WATCHLIST_FIVE");
    if (a) unlocked.push(a.code);
  }
  if (count >= 10) {
    const a = await unlock(userId, "WATCHLIST_TEN");
    if (a) unlocked.push(a.code);
  }
  if (count >= 25) {
    const a = await unlock(userId, "WATCHLIST_HOARDER");
    if (a) unlocked.push(a.code);
  }
  return unlocked;
}

/**
 * Chaos Lab achievements after a profitable sandbox payout.
 * `creditedCents` is the amount just credited; `totalCents` is the
 * lifetime credited total (tracked by the caller from the ledger).
 */
export async function evaluateChaosLabAchievements(
  userId: string,
  creditedCents: number,
  totalCents: number,
) {
  const unlocked: string[] = [];
  if (creditedCents > 0) {
    const a = await unlock(userId, "CHAOS_APPRENTICE");
    if (a) unlocked.push(a.code);
  }
  if (totalCents >= 50_000) {
    const a = await unlock(userId, "CHAOS_JOURNEYMAN");
    if (a) unlocked.push(a.code);
  }
  if (totalCents >= 250_000) {
    const a = await unlock(userId, "CHAOS_LORD");
    if (a) unlocked.push(a.code);
  }
  return unlocked;
}

/**
 * Login-streak achievements, evaluated once per UTC day (on session create).
 * A streak counts consecutive UTC calendar days with a login.
 */
export async function evaluateLoginStreak(userId: string) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const existing = await prisma.userAchievement.findFirst({
    where: { userId, achievement: { code: "STREAK_3" } },
  });
  // Track streak days in the activity feed: count distinct recent login days.
  const since = new Date(today.getTime() - 30 * 24 * 3600 * 1000);
  const events = await prisma.activityEvent.findMany({
    where: {
      userId,
      type: "LOGIN",
      createdAt: { gte: since },
    },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 400,
  });
  // Include today implicitly — the caller logs the LOGIN event before this.
  const days = new Set<string>();
  for (const e of events) {
    const d = new Date(e.createdAt);
    d.setUTCHours(0, 0, 0, 0);
    days.add(d.toISOString());
  }

  // Walk back from today; the streak breaks at the first missing day.
  let streak = 0;
  const cursor = new Date(today);
  while (days.has(cursor.toISOString())) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  void existing;
  if (streak >= 3) await unlock(userId, "STREAK_3");
  if (streak >= 7) await unlock(userId, "STREAK_7");
  if (streak >= 30) await unlock(userId, "STREAK_30");
}

export async function evaluateTutorialAchievement(userId: string) {
  const a = await unlock(userId, "TUTORIAL_COMPLETE");
  return a ? [a.code] : [];
}

// ---------- Daily challenge ----------

const CHALLENGES = [
  {
    key: "visit-learn",
    title: "Daily learner",
    description: "Read any lesson in the Learning Center today.",
    reward: "+10 XP",
    target: 1,
  },
  {
    key: "make-trade",
    title: "Daily trader",
    description: "Execute one simulated trade today.",
    reward: "+15 XP",
    target: 1,
  },
  {
    key: "check-portfolio",
    title: "Daily check-in",
    description: "Visit your portfolio page today.",
    reward: "+5 XP",
    target: 1,
  },
];

export function todayKey(): string {
  const d = new Date();
  const idx = (d.getUTCFullYear() + d.getUTCMonth() * 31 + d.getUTCDate()) % CHALLENGES.length;
  return CHALLENGES[idx]!.key;
}

export function challengeDefinition(key: string) {
  return CHALLENGES.find((c) => c.key === key) ?? CHALLENGES[0]!;
}

export async function getDailyChallenge(userId: string) {
  const key = todayKey();
  const def = challengeDefinition(key);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let row = await prisma.dailyChallenge.findUnique({
    where: { userId_key_date: { userId, key, date: today } },
  });
  if (!row) {
    row = await prisma.dailyChallenge.create({
      data: { userId, key, date: today, progress: 0, target: def.target, completed: false },
    });
  }

  return {
    key,
    title: def.title,
    description: def.description,
    reward: def.reward,
    progress: row.progress,
    target: row.target,
    completed: row.completed,
  };
}

const CHALLENGE_XP: Record<string, number> = {
  "visit-learn": 10,
  "make-trade": 15,
  "check-portfolio": 5,
};

/** Bump a challenge by one unit; award XP on first completion. */
export async function progressChallenge(userId: string, key: string) {
  const def = challengeDefinition(key);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const row = await prisma.dailyChallenge.findUnique({
    where: { userId_key_date: { userId, key, date: today } },
  });
  if (!row || row.completed) return null;

  const progress = Math.min(row.progress + 1, row.target);
  const completed = progress >= row.target;
  await prisma.dailyChallenge.update({
    where: { id: row.id },
    data: { progress, completed },
  });
  if (completed) {
    await addXp(userId, CHALLENGE_XP[key] ?? 5, `Daily challenge: ${def.title}`);
    await logActivity(userId, "XP", `Daily challenge complete: ${def.title}`, def.reward);
  }
  return { completed };
}

export async function recordTutorialCompletion(userId: string) {
  await addXp(userId, 100, "Completed the tutorial");
  await logActivity(userId, "XP", "Completed the interactive tutorial", "+100 XP");
  await evaluateTutorialAchievement(userId);
}
