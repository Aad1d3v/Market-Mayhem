import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { notFound } from "../utils/errors.js";
import { notify } from "../services/gamification.js";
import { asyncH, validate } from "./validate.js";
import { TICKET_CATEGORIES } from "@aadiinvest/shared";
import type { Role, TicketView } from "@aadiinvest/shared";

const router = Router();

function ticketNumber(): string {
  // #ADI-10482 style
  const n = Math.floor(10000 + Math.random() * 89999);
  return `ADI-${n}`;
}

router.get(
  "/",
  requireAuth,
  asyncH(async (req, res) => {
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    const items: TicketView[] = tickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      subject: t.subject,
      category: t.category,
      status: t.status as TicketView["status"],
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      messages: t.messages.map((m) => ({
        id: m.id,
        authorName: m.authorRole === "ADMIN" ? "Market Mayhem Support" : "You",
        authorRole: m.authorRole as Role,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    }));
    res.json({ items });
  }),
);

const createSchema = z.object({
  subject: z.string().min(3).max(120),
  category: z.enum(TICKET_CATEGORIES),
  description: z.string().min(10).max(4000),
});

router.post(
  "/",
  requireAuth,
  asyncH(async (req, res) => {
    const input = validate(createSchema, req.body);
    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber: ticketNumber(),
        userId: req.user!.id,
        subject: input.subject,
        category: input.category,
        status: "OPEN",
        messages: {
          create: {
            authorId: req.user!.id,
            authorRole: "USER",
            body: input.description,
          },
        },
      },
    });
    res.status(201).json({ id: ticket.id, ticketNumber: ticket.ticketNumber });
  }),
);

router.get(
  "/:id",
  requireAuth,
  asyncH(async (req, res) => {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: String(req.params.id), userId: req.user!.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!ticket) throw notFound("Ticket not found.");
    res.json({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      category: ticket.category,
      status: ticket.status,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      messages: ticket.messages.map((m) => ({
        id: m.id,
        authorName: m.authorRole === "ADMIN" ? "Market Mayhem Support" : "You",
        authorRole: m.authorRole as Role,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  }),
);

const messageSchema = z.object({ body: z.string().min(1).max(4000) });

router.post(
  "/:id/messages",
  requireAuth,
  asyncH(async (req, res) => {
    const input = validate(messageSchema, req.body);
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: String(req.params.id), userId: req.user!.id },
    });
    if (!ticket) throw notFound("Ticket not found.");
    await prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: req.user!.id,
        authorRole: "USER",
        body: input.body,
      },
    });
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: ticket.status === "RESOLVED" ? "IN_PROGRESS" : ticket.status },
    });
    res.json({ ok: true });
  }),
);

export default router;
