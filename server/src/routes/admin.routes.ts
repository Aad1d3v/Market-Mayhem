import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { badRequest, notFound } from "../utils/errors.js";
import { centsToString } from "../utils/money.js";
import { asyncH, validate } from "./validate.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get(
  "/stats",
  asyncH(async (_req, res) => {
    const [totalUsers, activeUsers, trades, openTickets, disabledUsers] =
      await Promise.all([
        prisma.user.count(),
        prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
        prisma.order.count({ where: { status: "FILLED" } }),
        prisma.supportTicket.count({ where: { status: { not: "RESOLVED" } } }),
        prisma.user.count({ where: { disabled: true } }),
      ]);
    res.json({
      totalUsers,
      activeUsers,
      trades,
      openTickets,
      disabledUsers,
      apiStatus: "SIMULATED_ENGINE",
      label: "SIMULATED" as const,
    });
  }),
);

router.get(
  "/users",
  asyncH(async (req, res) => {
    const q = String(req.query.q ?? "").toLowerCase();
    const limit = Math.min(parseInt(String(req.query.limit ?? "25"), 10) || 25, 100);
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);
    const where: Record<string, unknown> = q
      ? {
          OR: [
            { usernameLower: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : {};
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          disabled: true,
          emailVerified: true,
          xp: true,
          createdAt: true,
          wallet: { select: { balance: true } },
          investmentAccount: { select: { cash: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);
    res.json({
      items: users.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        disabled: u.disabled,
        emailVerified: u.emailVerified,
        xp: u.xp,
        createdAt: u.createdAt.toISOString(),
        walletBalance: centsToString(u.wallet?.balance ?? 0),
        investmentCash: centsToString(u.investmentAccount?.cash ?? 0),
      })),
      total,
    });
  }),
);

router.patch(
  "/users/:id",
  asyncH(async (req, res) => {
    const schema = z.object({ disabled: z.boolean() });
    const input = validate(schema, req.body);
    const user = await prisma.user.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!user) throw notFound("User not found.");
    if (user.role === "ADMIN") {
      throw badRequest("Admin accounts cannot be disabled from the dashboard.");
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { disabled: input.disabled },
    });
    if (input.disabled) {
      // Kill sessions when disabling.
      await prisma.session.deleteMany({ where: { userId: user.id } });
    }
    res.json({ id: updated.id, disabled: updated.disabled });
  }),
);

router.get(
  "/tickets",
  asyncH(async (_req, res) => {
    const tickets = await prisma.supportTicket.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        user: { select: { username: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    res.json({
      items: tickets.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        category: t.category,
        status: t.status,
        username: t.user.username,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        messages: t.messages.map((m) => ({
          id: m.id,
          authorName: m.authorRole === "ADMIN" ? "Support" : t.user.username,
          authorRole: m.authorRole,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
        })),
      })),
    });
  }),
);

router.patch(
  "/tickets/:id",
  asyncH(async (req, res) => {
    const schema = z.object({
      status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]).optional(),
      reply: z.string().min(1).max(4000).optional(),
    });
    const input = validate(schema, req.body);
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!ticket) throw notFound("Ticket not found.");

    if (input.reply) {
      await prisma.supportMessage.create({
        data: {
          ticketId: ticket.id,
          authorRole: "ADMIN",
          body: input.reply,
        },
      });
      await notifySupportReply(ticket.userId, ticket.ticketNumber);
    }
    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: input.status ?? ticket.status },
    });
    res.json({ id: updated.id, status: updated.status });
  }),
);

async function notifySupportReply(userId: string, ticketNumber: string) {
  const { notify } = await import("../services/gamification.js");
  await notify(
    userId,
    "SUPPORT",
    `Support replied to ticket #${ticketNumber}`,
    "Your support ticket has a new reply.",
  );
}

// ---- Market events (admin-managed simulated scenarios) ----

router.get(
  "/market-events",
  asyncH(async (_req, res) => {
    const events = await prisma.marketEvent.findMany({ orderBy: { createdAt: "asc" } });
    res.json({ items: events });
  }),
);

router.patch(
  "/market-events/:id",
  asyncH(async (req, res) => {
    const schema = z.object({ active: z.boolean() });
    const input = validate(schema, req.body);
    const event = await prisma.marketEvent.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!event) throw notFound("Market event not found.");
    // Only one event active at a time keeps the narrative clean.
    if (input.active) {
      await prisma.marketEvent.updateMany({ data: { active: false } });
    }
    const updated = await prisma.marketEvent.update({
      where: { id: event.id },
      data: { active: input.active },
    });
    if (input.active) {
      // Announce to all users with the preference enabled.
      const users = await prisma.user.findMany({
        where: { disabled: false },
        select: { id: true },
      });
      for (const u of users) {
        await notifyMarketEvent(u.id, updated.name, updated.description);
      }
    }
    // Push the new state into the price overlay immediately, so an activated
    // "Market Crash" really does crash the simulated market.
    const { primeMarketEventOverlay } = await import(
      "../services/market-data/index.js"
    );
    primeMarketEventOverlay();
    res.json({ id: updated.id, active: updated.active });
  }),
);

async function notifyMarketEvent(userId: string, name: string, description: string) {
  const { notify } = await import("../services/gamification.js");
  await notify(
    userId,
    "MARKET_EVENT",
    `SIMULATED MARKET EVENT: ${name}`,
    `${description} This is a game scenario, not real market activity.`,
  );
}

export default router;
