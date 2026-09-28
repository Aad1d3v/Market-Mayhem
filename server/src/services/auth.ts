/**
 * Authentication: register / login / logout / verify-email / forgot-password.
 *
 * The $800 starting balance is created EXACTLY ONCE, inside the same
 * transaction as the user row. There is no code path that grants it again.
 */

import { prisma } from "../db.js";
import { config } from "../config.js";
import { badRequest, conflict, unauthorized } from "../utils/errors.js";
import { hashPassword, verifyPassword, randomToken, generateCode, hashCode } from "../utils/password.js";
import { sendMail } from "../utils/mailer.js";
import { logActivity } from "./gamification.js";
import { MICRO_SHARES, fromCents, toCents } from "../utils/money.js";
import { HOUSE_STOCK, HOUSE_STOCK_NAME, simulationPrice } from "./market-data/index.js";

const SESSION_COOKIE = "aadi_session";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

const AVATAR_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#ef4444", "#84cc16"];

function pickAvatarColor(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

function validatePassword(password: string) {
  if (password.length < 8) {
    throw badRequest("Password must be at least 8 characters.", {
      password: "At least 8 characters required.",
    });
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw badRequest("Password must include letters and numbers.", {
      password: "Include at least one letter and one number.",
    });
  }
}

export async function register(input: {
  username: string;
  email: string;
  password: string;
}) {
  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();

  if (!USERNAME_RE.test(username)) {
    throw badRequest("Username must be 3–24 characters (letters, numbers, underscore).", {
      username: "3–24 characters; letters, numbers, underscore.",
    });
  }
  if (!EMAIL_RE.test(email)) {
    throw badRequest("Enter a valid email address.", { email: "Invalid email address." });
  }
  validatePassword(input.password);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { usernameLower: username.toLowerCase() }] },
    select: { email: true, usernameLower: true },
  });
  if (existing) {
    if (existing.email === email) {
      throw conflict("An account with this email already exists.");
    }
    throw conflict("This username is taken.");
  }

  const passwordHash = await hashPassword(input.password);

  // One transaction creates: user, wallet ($800), investment account ($0),
  // tutorial progress, watchlist, one welcome share of the house listing, the
  // ledger record and the activity entry.
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        username,
        usernameLower: username.toLowerCase(),
        email,
        passwordHash,
        avatarColor: pickAvatarColor(username),
      },
    });
    await tx.wallet.create({ data: { userId: created.id, balance: 80000 } }); // $800.00 in cents, once
    await tx.investmentAccount.create({ data: { userId: created.id, cash: 0 } });
    await tx.tutorialProgress.create({ data: { userId: created.id } });
    await tx.watchlist.create({ data: { userId: created.id } });
    await tx.transaction.create({
      data: {
        userId: created.id,
        kind: "STARTING_BALANCE",
        amount: 80000, // cents
        account: "WALLET",
        description: "Starting balance — welcome to Market Mayhem!",
      },
    });
    await tx.activityEvent.create({
      data: {
        userId: created.id,
        type: "STARTING_BALANCE",
        title: "Received starting balance",
        detail: "$800.00 CAD of virtual cash was added to your wallet.",
        amount: 80000, // cents
      },
    });

    // Welcome gift: every new player starts as a shareholder of Aadidev.co.
    // Priced at the current simulated quote so cost basis and P/L are honest.
    const giftPriceCents = Math.max(
      1,
      toCents(simulationPrice(HOUSE_STOCK) || 0.01),
    );
    await tx.holding.create({
      data: {
        userId: created.id,
        symbol: HOUSE_STOCK,
        shares: MICRO_SHARES, // exactly one share
        averageCost: giftPriceCents,
      },
    });
    await tx.activityEvent.create({
      data: {
        userId: created.id,
        type: "EVENT",
        title: `Welcome gift: 1 share of ${HOUSE_STOCK_NAME}`,
        detail: `The house listing — worth $${fromCents(giftPriceCents).toFixed(2)} CAD at today's simulated price.`,
        amount: giftPriceCents,
      },
    });
    await tx.notification.create({
      data: {
        userId: created.id,
        type: "WELCOME",
        title: `You own 1 share of ${HOUSE_STOCK_NAME}`,
        body: `It is already in your portfolio at $${fromCents(giftPriceCents).toFixed(2)} CAD. Aadidev.co is famous for wild swings — watch it closely.`,
      },
    });
    return created;
  });

  const code = await issueEmailVerification(user.id);
  await sendMail(
    email,
    "Verify your Market Mayhem account",
    `Welcome to Market Mayhem!\n\nYour $800 virtual wallet plus one free share of ${HOUSE_STOCK_NAME} are ready.\n\nYour verification code is: ${code}\n\nIf you did not create this account, you can ignore this email.`,
  );

  return user;
}

export async function login(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.disabled) {
    throw unauthorized("Invalid email or password.");
  }
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    throw unauthorized("Invalid email or password.");
  }
  return user;
}

export async function createSession(userId: string) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + config.sessionDays * 24 * 3600 * 1000);
  await prisma.session.create({
    data: { userId, token: hashCode(token), expiresAt },
  });
  return { token, expiresAt };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: config.sessionDays * 24 * 3600 * 1000,
  };
}

export { SESSION_COOKIE };

export async function destroySession(token: string | undefined) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { token: hashCode(token) } });
}

export async function getUserBySessionToken(token: string | undefined) {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token: hashCode(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (session.user.disabled) return null;
  return session.user;
}

export async function issueEmailVerification(userId: string) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);
  await prisma.verificationToken.deleteMany({ where: { identifier: `verify:${userId}` } });
  await prisma.verificationToken.create({
    data: { identifier: `verify:${userId}`, tokenHash: hashCode(code), expiresAt },
  });
  return code;
}

export async function verifyEmail(userId: string, code: string) {
  const record = await prisma.verificationToken.findFirst({
    where: { identifier: `verify:${userId}` },
  });
  if (!record || record.tokenHash !== hashCode(code) || record.expiresAt < new Date()) {
    throw badRequest("Invalid or expired verification code.");
  }
  await prisma.user.update({ where: { id: userId }, data: { emailVerified: true } });
  await prisma.verificationToken.delete({ where: { id: record.id } });
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  // Do not reveal whether the account exists.
  if (!user) return;
  const code = generateCode();
  await prisma.verificationToken.deleteMany({ where: { identifier: `reset:${user.id}` } });
  await prisma.verificationToken.create({
    data: {
      identifier: `reset:${user.id}`,
      tokenHash: hashCode(code),
      expiresAt: new Date(Date.now() + 3600 * 1000),
    },
  });
  await sendMail(
    user.email,
    "Reset your Market Mayhem password",
    `Your password reset code is: ${code}\n\nIt expires in 1 hour.`,
  );
}

export async function resetPassword(input: {
  email: string;
  code: string;
  newPassword: string;
}) {
  validatePassword(input.newPassword);
  const user = await prisma.user.findUnique({
    where: { email: input.email.trim().toLowerCase() },
  });
  if (!user) throw badRequest("Invalid or expired reset code.");
  const record = await prisma.verificationToken.findFirst({
    where: { identifier: `reset:${user.id}` },
  });
  if (!record || record.tokenHash !== hashCode(input.code) || record.expiresAt < new Date()) {
    throw badRequest("Invalid or expired reset code.");
  }
  const passwordHash = await hashPassword(input.newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await prisma.verificationToken.delete({ where: { id: record.id } });
  // Invalidate all sessions after a password reset.
  await prisma.session.deleteMany({ where: { userId: user.id } });
}

export { logActivity };
