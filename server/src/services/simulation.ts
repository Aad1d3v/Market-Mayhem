/**
 * Simulation payouts.
 *
 * The Chaos Lab runs entirely in the player's browser: a copy of their
 * portfolio, their made-up scenarios, their fake trades. Real simulated market
 * prices are never touched.
 *
 * The one thing that crosses the line is PROFIT: when a player sells at a gain
 * inside their sandbox, that gain is credited to their real Investment Account.
 * This service is the only door for that credit, so it validates everything:
 * the symbol must exist, the fake sale price must stay within a sane band of
 * the live simulated price, and the payout is capped per sale.
 */

import { prisma } from "../db.js";
import { badRequest } from "../utils/errors.js";
import {
  dec,
  fromCents,
  toCents,
} from "../utils/money.js";
import { isKnownSymbol, simulationPrice } from "./market-data/index.js";
import { evaluateChaosLabAchievements, logActivity, notify } from "./gamification.js";

/** A scenario price may not exceed 3× (or fall below 0.05×) the live price. */
export const SIM_MAX_MULTIPLE = 3;
export const SIM_MIN_MULTIPLE = 0.05;
/** Hard ceiling on a single simulated sale payout: $25,000. */
export const SIM_MAX_PROFIT_CENTS = 25_000 * 100;

export interface PayoutInput {
  userId: string;
  symbol: string;
  quantity: string;
  salePrice: string;
  costBasis: string;
}

export interface PayoutResult {
  credited: string;
  cashAfter: string;
  capped: boolean;
  note: string;
}

export async function settleSimulationSale(
  input: PayoutInput,
): Promise<PayoutResult> {
  const symbol = input.symbol.trim().toUpperCase();
  if (!isKnownSymbol(symbol)) {
    throw badRequest(`Unknown symbol: ${symbol}`);
  }

  const qty = dec(input.quantity);
  const sale = dec(input.salePrice);
  const basis = dec(input.costBasis);

  if (!qty.isFinite() || qty.lessThanOrEqualTo(0) || qty.greaterThan(10_000)) {
    throw badRequest("Invalid simulated quantity.");
  }
  if (!sale.isFinite() || sale.lessThanOrEqualTo(0)) {
    throw badRequest("Invalid simulated sale price.");
  }
  if (!basis.isFinite() || basis.lessThan(0)) {
    throw badRequest("Invalid simulated cost basis.");
  }

  const realPrice = dec(simulationPrice(symbol));
  if (realPrice.lessThanOrEqualTo(0)) {
    throw badRequest("Live simulated price is unavailable right now.");
  }
  const upper = realPrice.times(SIM_MAX_MULTIPLE);
  const lower = realPrice.times(SIM_MIN_MULTIPLE);
  if (sale.greaterThan(upper) || sale.lessThan(lower)) {
    throw badRequest(
      `A sandbox sale must stay between ${SIM_MIN_MULTIPLE * 100}% and ${SIM_MAX_MULTIPLE * 100}% of the live simulated price of ${symbol}.`,
    );
  }

  const profitPerShare = sale.minus(basis);
  const investment = await prisma.investmentAccount.findUnique({
    where: { userId: input.userId },
  });
  if (!investment) throw badRequest("Account is not initialized.");

  // Selling at a loss is allowed — it just pays nothing. Losses stay in the sandbox.
  if (profitPerShare.lessThanOrEqualTo(0)) {
    return {
      credited: "0.00",
      cashAfter: fromCents(investment.cash).toFixed(2),
      capped: false,
      note: "The sandbox took the loss — nothing is credited when a simulated sale is not profitable.",
    };
  }

  const rawCents = toCents(profitPerShare.times(qty));
  if (rawCents <= 0) {
    return {
      credited: "0.00",
      cashAfter: fromCents(investment.cash).toFixed(2),
      capped: false,
      note: "That gain rounds to less than a cent, so there is nothing to credit.",
    };
  }
  const capped = rawCents > SIM_MAX_PROFIT_CENTS;
  const profitCents = capped ? SIM_MAX_PROFIT_CENTS : rawCents;

  const updated = await prisma.investmentAccount.update({
    where: { userId: input.userId },
    data: { cash: { increment: profitCents } },
  });
  await prisma.transaction.create({
    data: {
      userId: input.userId,
      kind: "SIMULATION_PROFIT",
      amount: profitCents,
      account: "INVESTMENT",
      symbol,
      description: `Sandbox profit paid out — simulated sale of ${qty.toString()} ${symbol} at $${sale.toFixed(2)}`,
    },
  });

  // Lifetime credited total (from the ledger) drives the Chaos Lab milestones.
  const chaosAgg = await prisma.transaction.aggregate({
    where: { userId: input.userId, kind: "SIMULATION_PROFIT" },
    _sum: { amount: true },
  });
  await evaluateChaosLabAchievements(
    input.userId,
    profitCents,
    chaosAgg._sum.amount ?? 0,
  ).catch(() => {});

  await logActivity(
    input.userId,
    "SELL",
    `Sandbox profit credited: ${fromCents(profitCents).toFixed(2)}`,
    `Simulated ${symbol} scenario paid out to your Investment Account.`,
    profitCents,
  ).catch(() => {});

  await notify(
    input.userId,
    "ORDER_FILLED",
    `Sandbox profit credited: $${fromCents(profitCents).toFixed(2)}`,
    `Your Chaos Lab sale of ${symbol} was profitable, so the gain was paid into your real Investment Account.${
      capped ? ` (Capped at $${fromCents(SIM_MAX_PROFIT_CENTS).toFixed(2)} per sale.)` : ""
    }`,
  ).catch(() => {});

  return {
    credited: fromCents(profitCents).toFixed(2),
    cashAfter: fromCents(updated.cash).toFixed(2),
    capped,
    note: capped
      ? `Payout capped at $${fromCents(SIM_MAX_PROFIT_CENTS).toFixed(2)} for a single simulated sale.`
      : "Simulated profit credited to your real Investment Account.",
  };
}
