import type { NextFunction, Request, Response } from "express";
import { getUserBySessionToken, SESSION_COOKIE } from "../services/auth.js";
import { forbidden, unauthorized } from "../utils/errors.js";
import type { User } from "@prisma/client";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      sessionToken?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  const user = await getUserBySessionToken(token);
  if (!user) {
    next(unauthorized("You must be signed in."));
    return;
  }
  req.user = user;
  req.sessionToken = token;
  next();
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    next(unauthorized());
    return;
  }
  if (req.user.role !== "ADMIN") {
    next(forbidden("Admin access required."));
    return;
  }
  next();
}
