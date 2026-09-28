import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";
import { config } from "../config.js";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    res.status(400).json({
      error: "Please check the highlighted fields.",
      code: "VALIDATION",
      fields,
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: err.message,
      code: err.code,
      ...(err.fields ? { fields: err.fields } : {}),
    });
    return;
  }

  const isDbUnique = typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002";
  if (isDbUnique) {
    res.status(409).json({
      error: "That value is already taken.",
      code: "CONFLICT",
    });
    return;
  }

  console.error("[unhandled]", err);
  res.status(500).json({
    error: "Something went wrong on our side. Please try again.",
    code: "INTERNAL",
    ...(config.isProd ? {} : { detail: String((err as Error)?.message ?? err) }),
  });
}
