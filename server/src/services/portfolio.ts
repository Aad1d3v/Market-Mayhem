/**
 * Wallet transfers & portfolio calculations (integer-cents accounting).
 *
 * Accounting rules:
 *  - Transfers move money between Wallet and Investment Account; every leg is
 *    recorded in the ledger. Wallet balance is included in "total account
 *    value" but kept clearly separate in the UI.
 *  - Total Return = investment account value − net amount transferred in
 *    (ledger-based, transfer-safe; withdrawing your own money is not a loss).
 */

import { prisma } from "../db.js";
import { badRequest, notFound } from "../utils/errors.js";
import {
  MICRO_SHARES,
  centsToString,
  fromCents,
  fromMicro,
  toCents,
} from "../utils/money.js";
import { safeSimulationPrice } from "./market-data/index.js";
import { logActivity, notify, progressChallenge } from "./gamification.js";

export async function getWallet(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  const investment = await prisma.investmentAccount.findUnique({
    where: { userId },
  });
  if (!wallet || !investment) throw notFound("Accounts not initialized.");
  return {
    walletBalance: centsToString(wallet.balance),
    investmentCash: centsToString(investment.cash),
  };
}

export async function transfer(input: {
  userId: string;
  direction: "WALLET_TO_INVESTMENT" | "INVESTMENT_TO_WALLET";
  amount: string;
}) {
  const amountCents = toCents(input.amount);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw badRequest("Transfer amount must be greater than zero.");
  }
  if (amountCents > 1_000_000_000) {
    throw badRequest("Transfer amount too large.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
    const investment = await tx.investmentAccount.findUnique({
      where: { userId: input.userId },
    });
    if (!wallet || !investment) throw notFound("Accounts not initialized.");

    const source =
      input.direction === "WALLET_TO_INVESTMENT" ? wallet.balance : investment.cash;
    if (amountCents > source) {
      throw badRequest(
        `Insufficient funds. You cannot transfer more than ${centsToString(source)}.`,
      );
    }

    if (input.direction === "WALLET_TO_INVESTMENT") {
      await tx.wallet.update({
        where: { userId: input.userId },
        data: { balance: wallet.balance - amountCents },
      });
      await tx.investmentAccount.update({
        where: { userId: input.userId },
        data: { cash: investment.cash + amountCents },
      });
      await tx.transaction.create({
        data: {
          userId: input.userId,
          kind: "WALLET_TO_INVESTMENT",
          amount: -amountCents,
          account: "WALLET",
          description: `Transferred ${centsToString(amountCents)} to Investment Account`,
        },
      });
      await tx.transaction.create({
        data: {
          userId: input.userId,
          kind: "WALLET_TO_INVESTMENT",
          amount: amountCents,
          account: "INVESTMENT",
          description: `Received ${centsToString(amountCents)} from Wallet`,
        },
      });
    } else {
      await tx.investmentAccount.update({
        where: { userId: input.userId },
        data: { cash: investment.cash - amountCents },
      });
      await tx.wallet.update({
        where: { userId: input.userId },
        data: { balance: wallet.balance + amountCents },
      });
      await tx.transaction.create({
        data: {
          userId: input.userId,
          kind: "INVESTMENT_TO_WALLET",
          amount: -amountCents,
          account: "INVESTMENT",
          description: `Transferred ${centsToString(amountCents)} to Wallet`,
        },
      });
      await tx.transaction.create({
        data: {
          userId: input.userId,
          kind: "INVESTMENT_TO_WALLET",
          amount: amountCents,
          account: "WALLET",
          description: `Received ${centsToString(amountCents)} from Investment Account`,
        },
      });
    }

    const w2 = await tx.wallet.findUnique({ where: { userId: input.userId } });
    const i2 = await tx.investmentAccount.findUnique({
      where: { userId: input.userId },
    });
    return { wallet: w2!, investment: i2! };
  });

  // Post-commit activity logging (outside the tx — SQLite serializes writers;
  // global-client writes inside an interactive tx deadlock it).
  await logActivity(
    input.userId,
    input.direction,
    input.direction === "WALLET_TO_INVESTMENT"
      ? `Transferred ${centsToString(amountCents)} to Investment Account`
      : `Transferred ${centsToString(amountCents)} to Wallet`,
    undefined,
    amountCents,
  ).catch(() => {});
  await notify(
    input.userId,
    "ORDER_FILLED",
    "Transfer complete",
    `${centsToString(amountCents)} CAD moved ${
      input.direction === "WALLET_TO_INVESTMENT"
        ? "from Wallet to Investment Account"
        : "from Investment Account to Wallet"
    }.`,
  );

  return {
    walletBalance: centsToString(result.wallet.balance),
    investmentCash: centsToString(result.investment.cash),
  };
}

export interface PortfolioSummaryResult {
  holdings: Array<{
    id: string;
    symbol: string;
    company: string;
    shares: string;
    averageCost: string;
    currentPrice: string;
    marketValue: string;
    totalCost: string;
    unrealizedPL: string;
    unrealizedPLPercent: string;
    dayChangePercent: string;
  }>;
  investedMarketValue: string;
  investmentCash: string;
  investmentAccountValue: string;
  walletBalance: string;
  totalAccountValue: string;
  totalReturn: string;
  totalReturnPercent: string;
  todayChange: string;
  todayChangePercent: string;
}

export async function getPortfolioSummary(
  userId: string,
): Promise<PortfolioSummaryResult> {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  const investment = await prisma.investmentAccount.findUnique({
    where: { userId },
  });
  const holdings = await prisma.holding.findMany({ where: { userId } });

  let investedValueCents = 0;
  const views = holdings.map((h) => {
    // Retired symbols fall back to their cost basis instead of breaking the page.
    const priceCents = Math.round(
      safeSimulationPrice(h.symbol, h.averageCost) * 100,
    );
    const marketValueCents = Math.round((h.shares * priceCents) / MICRO_SHARES);
    const totalCostCents = Math.round((h.shares * h.averageCost) / MICRO_SHARES);
    const plCents = marketValueCents - totalCostCents;
    const plPercent =
      totalCostCents > 0
        ? ((plCents / totalCostCents) * 100).toFixed(2)
        : "0.00";
    investedValueCents += marketValueCents;
    return {
      id: h.id,
      symbol: h.symbol,
      company: h.symbol, // client joins the display name via stock meta
      shares: fromMicro(h.shares).toString(),
      averageCost: centsToString(h.averageCost),
      currentPrice: centsToString(priceCents),
      marketValue: centsToString(marketValueCents),
      totalCost: centsToString(totalCostCents),
      unrealizedPL: centsToString(plCents),
      unrealizedPLPercent: plPercent,
      dayChangePercent: "0.00",
    };
  });

  const investmentCashCents = investment?.cash ?? 0;
  const walletBalanceCents = wallet?.balance ?? 0;
  const investmentAccountValueCents = investedValueCents + investmentCashCents;

  // Ledger-based net inflow (transfers only) — transfer-safe return math.
  const transfers = await prisma.transaction.groupBy({
    by: ["kind"],
    where: {
      userId,
      kind: { in: ["WALLET_TO_INVESTMENT", "INVESTMENT_TO_WALLET"] },
      account: "INVESTMENT",
    },
    _sum: { amount: true },
  });
  let netInflowCents = 0;
  for (const t of transfers) {
    netInflowCents += t._sum.amount ?? 0;
  }

  const totalReturnCents = investmentAccountValueCents - netInflowCents;
  const totalReturnPercent =
    netInflowCents > 0
      ? ((totalReturnCents / netInflowCents) * 100).toFixed(2)
      : "0.00";

  return {
    holdings: views,
    investedMarketValue: centsToString(investedValueCents),
    investmentCash: centsToString(investmentCashCents),
    investmentAccountValue: centsToString(investmentAccountValueCents),
    walletBalance: centsToString(walletBalanceCents),
    totalAccountValue: centsToString(investmentAccountValueCents + walletBalanceCents),
    totalReturn: centsToString(totalReturnCents),
    totalReturnPercent,
    todayChange: "0.00",
    todayChangePercent: "0.00",
  };
}

export async function recordPortfolioSnapshot(userId: string) {
  const summary = await getPortfolioSummary(userId);
  const totalCents = toCents(summary.totalAccountValue);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  await prisma.portfolioSnapshot.upsert({
    where: { userId_date: { userId, date: today } },
    update: { value: totalCents },
    create: { userId, date: today, value: totalCents },
  });
}

export async function getPortfolioHistory(userId: string) {
  const snapshots = await prisma.portfolioSnapshot.findMany({
    where: { userId },
    orderBy: { date: "asc" },
    take: 400,
  });
  return snapshots.map((s) => ({
    date: s.date.toISOString(),
    value: centsToString(s.value),
  }));
}
