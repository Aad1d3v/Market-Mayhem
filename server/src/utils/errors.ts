/**
 * Application error with an HTTP status and stable code.
 * Controllers throw these; the error handler formats the JSON body.
 */

export class AppError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;

  constructor(
    status: number,
    message: string,
    code = "ERROR",
    fields?: Record<string, string>,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function badRequest(message: string, fields?: Record<string, string>) {
  return new AppError(400, message, "BAD_REQUEST", fields);
}

export function unauthorized(message = "Authentication required") {
  return new AppError(401, message, "UNAUTHORIZED");
}

export function forbidden(message = "You do not have access to this resource") {
  return new AppError(403, message, "FORBIDDEN");
}

export function notFound(message = "Not found") {
  return new AppError(404, message, "NOT_FOUND");
}

export function tooMany(message = "Too many requests. Please slow down.") {
  return new AppError(429, message, "RATE_LIMITED");
}

export function conflict(message: string) {
  return new AppError(409, message, "CONFLICT");
}
