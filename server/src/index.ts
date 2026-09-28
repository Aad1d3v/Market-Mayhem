import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { prisma } from "./db.js";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import portfolioRoutes from "./routes/portfolio.routes.js";
import marketsRoutes from "./routes/markets.routes.js";
import stocksRoutes from "./routes/stocks.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import watchlistRoutes from "./routes/watchlist.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import learningRoutes from "./routes/learning.routes.js";
import achievementsRoutes from "./routes/achievements.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import supportRoutes from "./routes/support.routes.js";
import leaderboardRoutes from "./routes/leaderboard.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import tutorialRoutes from "./routes/tutorial.routes.js";
import simulationRoutes from "./routes/simulation.routes.js";
import { primeMarketEventOverlay } from "./services/market-data/index.js";

const app = express();

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json({ limit: "256kb" }));
app.use(cookieParser());

app.use(
  cors({
    origin: [config.clientUrl],
    credentials: true,
  }),
);

// Global API rate limiting — generous for normal use, hostile to scripts.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down.", code: "RATE_LIMITED" },
});
app.use("/api", apiLimiter);

// Stricter limiter for auth endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many authentication attempts. Try again in a few minutes.",
    code: "RATE_LIMITED",
  },
});
app.use("/api/auth", authLimiter);

// ---------- Health ----------
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "aadiinvest-server",
    marketData: config.marketDataProvider,
    time: new Date().toISOString(),
  });
});

// ---------- Routes ----------
app.use("/api/auth", authRoutes);
app.use("/api/me", userRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/markets", marketsRoutes);
app.use("/api/stocks", stocksRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/lessons", learningRoutes);
app.use("/api/achievements", achievementsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/tickets", supportRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/tutorial", tutorialRoutes);
app.use("/api/simulation", simulationRoutes);
// Spec alias: quizzes live inside lessons; expose the documented path too.
app.use("/api/quizzes", (req, _res, next) => {
  req.url = req.url.replace(/\/attempt$/, "/quiz");
  next();
}, learningRoutes);

// ---------- Static client (production: serve the built Vite app) ----------
import path from "node:path";
import fs from "node:fs";
const clientDist = path.resolve(process.cwd(), "client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback: everything that is not /api/* serves index.html
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
  console.log(`🗂️  Serving built client from ${clientDist}`);
}

app.use(notFoundHandler);
app.use(errorHandler);

// ---------- Nightly portfolio snapshot job ----------
function scheduleSnapshotJob() {
  const run = async () => {
    try {
      const users = await prisma.user.findMany({ select: { id: true } });
      const { recordPortfolioSnapshot } = await import("./services/portfolio.js");
      for (const u of users) {
        await recordPortfolioSnapshot(u.id).catch(() => {});
      }
      console.log(`📸 Portfolio snapshots recorded for ${users.length} users`);
    } catch (err) {
      console.error("[snapshot-job]", err);
    }
  };

  const msUntilNextUtcMidnight = () => {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(24, 0, 5, 0);
    return next.getTime() - now.getTime();
  };

  setTimeout(function tick() {
    run();
    setTimeout(tick, 24 * 3600 * 1000);
  }, msUntilNextUtcMidnight());

  // Also capture one on boot so charts have data from day one.
  setTimeout(run, 15_000);
}

scheduleSnapshotJob();

app.listen(config.port, "0.0.0.0", () => {
  console.log(`🚀 Market Mayhem server listening on http://0.0.0.0:${config.port}`);
  console.log(`   Market data: ${config.marketDataProvider.toUpperCase()} (simulated, 50-day cycle)`);
  console.log(`   Scenario events: flash crashes, rallies and frenzies are active in the timeline`);
});

// Warm the admin event overlay so market-wide scenarios apply from boot.
primeMarketEventOverlay();
