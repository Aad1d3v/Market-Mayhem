/**
 * Server-authoritative trading engine (integer-cents accounting).
 *
 * Every order is validated, priced and settled HERE — never on the client.
 * All balance changes happen inside a single Prisma transaction with the
 * ledger written in the same commit, so money can never appear from nowhere.
 * All arithmetic is on integers (cents / micro-shares) — no float drift.
 */

import { prisma } from "../db.js";
import { badRequest, conflict, notFound, unauthorized } from "../utils/errors.js";
import { MICRO_SHARES, dec, fromMicro, toCents, toMicro, fromCents, money } from "../utils/money.js";
import { safeSimulationPrice, simulationPrice } from "./market-data/index.js";
import {
  addXp,
  evaluateTradeAchievements,
  logActivity,
  notify,
  progressChallenge,
} from "./gamification.js";

const MAX_QUANTITY = 100; // shares per order — keeps micro-share integers inside Int4 range

export interface PlaceOrderInput {
  userId: string;
  side: "BUY" | "SELL";
  symbol: string;
  quantity: string; // decimal string, fractional allowed
  clientRequestId?: string;
}

export interface PlaceOrderResult {
  orderId: string;
  side: "BUY" | "SELL";
  symbol: string;
  quantity: string;
  price: string;
  total: string;
  cashAfter: string;
  unlockedAchievements: string[];
}

export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  // --- Normalize & validate (never trust the client) ---
  const symbol = input.symbol.trim().toUpperCase();
  const side = input.side;
  const qtyDec = dec(input.quantity);

  if (!qtyDec.isFinite() || qtyDec.isNaN()) {
    throw badRequest("Invalid quantity.");
  }
  if (qtyDec.lessThanOrEqualTo(0)) {
    throw badRequest("Quantity must be greater than zero.");
  }
  if (qtyDec.greaterThan(MAX_QUANTITY)) {
    throw badRequest("Quantity too large.");
  }

  const qtyMicro = toMicro(qtyDec);
  if (qtyMicro <= 0) {
    throw badRequest("Quantity is too small to trade.");
  }

  if (input.clientRequestId) {
    if (input.clientRequestId.length > 64) {
      throw badRequest("Invalid request id.");
    }
    // Replay protection: unique index on clientRequestId makes duplicates fail.
    const dupe = await prisma.order.findUnique({
      where: { clientRequestId: input.clientRequestId },
    });
    if (dupe) {
      throw conflict("Duplicate order request — this order was already submitted.");
    }
  }

  // --- Price from the market-data service (simulated engine) ---
  let priceNum: number;
  try {
    priceNum = simulationPrice(symbol);
  } catch {
    throw badRequest(`Unknown symbol: ${symbol}`);
  }
  if (!priceNum || priceNum <= 0) {
    throw badRequest("Price temporarily unavailable. Try again shortly.");
  }

  const priceCents = Math.round(priceNum * 100); // integer cents per share
  // Total cost in cents = price_cents × micro / 1_000_000, computed as integer
  // with cent rounding on the fractional part.
  const totalCents = Math.round((priceCents * qtyMicro) / MICRO_SHARES);

  // --- Settle atomically ---
  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
    const investment = await tx.investmentAccount.findUnique({
      where: { userId: input.userId },
    });
    if (!wallet || !investment) {
      throw unauthorized("Account is not initialized.");
    }

    if (side === "BUY") {
      if (totalCents > investment.cash) {
        const short = investment.cash - totalCents; // negative
        throw badRequest(
          `Insufficient investment cash. You need $${fromCents(-short).toFixed(2)} more virtual cash to place this order.`,
        );
      }
    } else {
      const holding = await tx.holding.findUnique({
        where: { userId_symbol: { userId: input.userId, symbol } },
      });
      if (!holding || holding.shares < qtyMicro) {
        throw badRequest("You cannot sell more shares than you own.");
      }
    }

    const order = await tx.order.create({
      data: {
        clientRequestId: input.clientRequestId ?? null,
        userId: input.userId,
        side,
        symbol,
        quantity: qtyMicro,
        price: priceCents,
        total: totalCents,
        status: "FILLED",
      },
    });

    let realizedPLCents: number | null = null;
    let activityTitle = "";
    let activityDetail = "";
    let activityAmount = 0;

    if (side === "BUY") {
      const newCash = investment.cash - totalCents;
      const holding = await tx.holding.findUnique({
        where: { userId_symbol: { userId: input.userId, symbol } },
      });
      const oldMicro = holding?.shares ?? 0;
      const oldCostCents = holding ? Math.round((holding.averageCost * oldMicro) / MICRO_SHARES) : 0;
      const newMicro = oldMicro + qtyMicro;
      const newCostCents = oldCostCents + totalCents;
      const newAvg = Math.round((newCostCents * MICRO_SHARES) / newMicro);

      await tx.investmentAccount.update({
        where: { userId: input.userId },
        data: { cash: newCash },
      });
      await tx.holding.upsert({
        where: { userId_symbol: { userId: input.userId, symbol } },
        update: { shares: newMicro, averageCost: newAvg },
        create: {
          userId: input.userId,
          symbol,
          shares: newMicro,
          averageCost: newAvg,
        },
      });
      await tx.transaction.create({
        data: {
          userId: input.userId,
          kind: "BUY",
          amount: -totalCents,
          account: "INVESTMENT",
          symbol,
          description: `Bought ${fromMicro(qtyMicro).toString()} ${symbol}`,
        },
      });
      // NOTE: activity logging happens AFTER the transaction commits (SQLite
      // serializes writers — global-client writes inside the tx would deadlock).
      activityTitle = `Bought ${fromMicro(qtyMicro).toString()} ${symbol}`;
      activityDetail = `at $${(priceCents / 100).toFixed(2)} per share`;
      activityAmount = -totalCents;
    } else {
      const holding = (await tx.holding.findUnique({
        where: { userId_symbol: { userId: input.userId, symbol } },
      }))!;
      const costCents = Math.round((holding.averageCost * qtyMicro) / MICRO_SHARES);
      realizedPLCents = totalCents - costCents;

      const newMicro = holding.shares - qtyMicro;
      const newCash = investment.cash + totalCents;

      await tx.investmentAccount.update({
        where: { userId: input.userId },
        data: { cash: newCash },
      });
      if (newMicro === 0) {
        await tx.holding.delete({ where: { id: holding.id } });
      } else {
        await tx.holding.update({
          where: { id: holding.id },
          data: { shares: newMicro },
        });
      }
      await tx.transaction.create({
        data: {
          userId: input.userId,
          kind: "SELL",
          amount: totalCents,
          account: "INVESTMENT",
          symbol,
          description: `Sold ${fromMicro(qtyMicro).toString()} ${symbol}`,
        },
      });
      activityTitle = `Sold ${fromMicro(qtyMicro).toString()} ${symbol}`;
      activityDetail = `at $${(priceCents / 100).toFixed(2)} per share`;
      activityAmount = totalCents;
    }

    return { order, realizedPLCents, activityTitle, activityDetail, activityAmount };
  });

  // Post-commit activity logging (outside the tx — see note above).
  await logActivity(
    input.userId,
    side,
    result.activityTitle,
    result.activityDetail,
    result.activityAmount,
  ).catch(() => {});

  // --- Post-settlement: notifications, XP, achievements (best-effort) ---
  try {
    const fresh = await prisma.investmentAccount.findUnique({
      where: { userId: input.userId },
    });
    const holdings = await prisma.holding.findMany({
      where: { userId: input.userId },
    });
    const tradeCount = await prisma.order.count({
      where: { userId: input.userId, status: "FILLED" },
    });

    await notify(
      input.userId,
      "ORDER_FILLED",
      `Order filled: ${side === "BUY" ? "Bought" : "Sold"} ${fromMicro(qtyMicro).toString()} ${symbol}`,
      `${side === "BUY" ? "Paid" : "Received"} $${fromCents(totalCents).toFixed(2)} CAD (simulated) at $${(priceCents / 100).toFixed(2)} per share.`,
    );

    await addXp(input.userId, 10, "Executed a trade");

    let holdingsValueCents = 0;
    for (const h of holdings) {
      const p = Math.round(safeSimulationPrice(h.symbol, h.averageCost) * 100);
      holdingsValueCents += Math.round((h.shares * p) / MICRO_SHARES);
    }
    const investmentAccountValueCents = (fresh?.cash ?? 0) + holdingsValueCents;

    const unlocked = await evaluateTradeAchievements(input.userId, {
      side,
      symbol,
      quantity: fromMicro(qtyMicro).toString(),
      total: totalCents,
      realizedPL: result.realizedPLCents,
      investmentAccountValue: investmentAccountValueCents,
      tradeCount,
      holdingsCount: holdings.length,
    });

    await progressChallenge(input.userId, "make-trade");

    return {
      orderId: result.order.id,
      side,
      symbol,
      quantity: fromMicro(qtyMicro).toString(),
      price: (priceCents / 100).toFixed(2),
      total: fromCents(totalCents).toFixed(2),
      cashAfter: fromCents(fresh?.cash ?? 0).toFixed(2),
      unlockedAchievements: unlocked,
    };
  } catch {
    // Gamification must never fail a settled trade.
    return {
      orderId: result.order.id,
      side,
      symbol,
      quantity: fromMicro(qtyMicro).toString(),
      price: (priceCents / 100).toFixed(2),
      total: fromCents(totalCents).toFixed(2),
      cashAfter: "0",
      unlockedAchievements: [],
    };
  }
}

export async function listOrders(userId: string, limit = 50) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getOrder(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
  });
  if (!order) throw notFound("Order not found.");
  return order;
}

// keep `money` imported for future display helpers
void money;
