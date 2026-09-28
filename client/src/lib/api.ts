import type { ApiError } from "@aadiinvest/shared";

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  fields?: Record<string, string>;

  constructor(status: number, body: ApiError) {
    super(body.error || "Request failed");
    this.status = status;
    this.code = body.code;
    this.fields = body.fields;
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, ...rest } = options;
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: "include",
  });

  if (!res.ok) {
    let body: ApiError = { error: `Request failed (${res.status})` };
    try {
      body = (await res.json()) as ApiError;
    } catch {
      // keep default
    }
    throw new ApiRequestError(res.status, body);
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, json?: unknown) =>
    request<T>(path, { method: "POST", json }),
  patch: <T>(path: string, json?: unknown) =>
    request<T>(path, { method: "PATCH", json }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
