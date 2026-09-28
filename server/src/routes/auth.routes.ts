import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { badRequest, unauthorized } from "../utils/errors.js";
import {
  createSession,
  destroySession,
  issueEmailVerification,
  login,
  register,
  requestPasswordReset,
  resetPassword,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyEmail,
} from "../services/auth.js";
import { evaluateLoginStreak, logActivity } from "../services/gamification.js";
import { asyncH, validate } from "./validate.js";

const router = Router();

const registerSchema = z.object({
  username: z.string().min(3).max(24),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
const forgotSchema = z.object({ email: z.string().email() });
const resetSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(12),
  newPassword: z.string().min(8).max(128),
});

router.post(
  "/register",
  asyncH(async (req, res) => {
    const input = validate(registerSchema, req.body);
    const user = await register(input);
    const session = await createSession(user.id);
    res.cookie(SESSION_COOKIE, session.token, sessionCookieOptions());
    res.status(201).json({ id: user.id, username: user.username, email: user.email });
  }),
);

router.post(
  "/login",
  asyncH(async (req, res) => {
    const input = validate(loginSchema, req.body);
    const user = await login(input);
    const session = await createSession(user.id);
    res.cookie(SESSION_COOKIE, session.token, sessionCookieOptions());
    // Best-effort: record the login for streak tracking + streak achievements.
    try {
      await logActivity(user.id, "LOGIN", "Signed in", "Streak check-in recorded.");
      await evaluateLoginStreak(user.id);
    } catch {
      /* gamification must never block a login */
    }
    res.json({ id: user.id, username: user.username });
  }),
);

router.post(
  "/logout",
  asyncH(async (req, res) => {
    await destroySession(req.cookies?.[SESSION_COOKIE] as string | undefined);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ ok: true });
  }),
);

router.post(
  "/forgot-password",
  asyncH(async (req, res) => {
    const { email } = validate(forgotSchema, req.body);
    await requestPasswordReset(email);
    res.json({
      ok: true,
      message:
        "If an account exists for that email, a reset code has been sent. (In development, codes appear in the server console.)",
    });
  }),
);

router.post(
  "/reset-password",
  asyncH(async (req, res) => {
    const input = validate(resetSchema, req.body);
    await resetPassword(input);
    res.json({ ok: true });
  }),
);

router.post(
  "/verify-email",
  requireAuth,
  asyncH(async (req, res) => {
    const schema = z.object({ code: z.string().min(4).max(12) });
    const { code } = validate(schema, req.body);
    if (!req.user) throw unauthorized();
    await verifyEmail(req.user.id, code);
    res.json({ ok: true });
  }),
);

router.post(
  "/resend-verification",
  requireAuth,
  asyncH(async (req, res) => {
    if (!req.user) throw unauthorized();
    if (req.user.emailVerified) {
      throw badRequest("Email is already verified.");
    }
    // Re-issue via the same service path used at registration.
    const code = await issueEmailVerification(req.user.id);
    const { sendMail } = await import("../utils/mailer.js");
    await sendMail(
      req.user.email,
      "Verify your Market Mayhem account",
      `Your verification code is: ${code}`,
    );
    res.json({ ok: true });
  }),
);

export default router;
