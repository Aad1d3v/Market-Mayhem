import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { badRequest } from "../utils/errors.js";

/** Parse and validate req.body with zod; throws a field-error AppError. */
export function validate<T>(schema: ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    throw badRequest("Please check the highlighted fields.", fields);
  }
  return result.data;
}

export function asyncH(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
