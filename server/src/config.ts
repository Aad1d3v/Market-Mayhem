import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    if (process.env.NODE_ENV === "production" && fallback === undefined) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return name === "SESSION_SECRET" ? "dev-insecure-session-secret" : (value as string);
  }
  return value;
}

export const config = {
  // PORT is supplied by the platform (Render injects it); 4000 is only a
  // local-development fallback. No port is hardcoded anywhere else.
  port: parseInt(process.env.PORT ?? "4000", 10) || 4000,
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",
  // In production the allowed browser origin is derived from the platform's
  // own external URL (RENDER_EXTERNAL_URL on Render) — nothing hardcoded.
  // Set CLIENT_URL only if you serve the client from a different origin.
  clientUrl:
    process.env.CLIENT_URL ??
    process.env.RENDER_EXTERNAL_URL?.replace(/\/$/, "") ??
    "http://localhost:5173",
  sessionSecret: required("SESSION_SECRET"),
  sessionDays: 30,
  adminEmail: (process.env.ADMIN_EMAIL ?? "admin@aadiinvest.local").toLowerCase(),
  marketDataProvider: process.env.MARKET_DATA_PROVIDER ?? "simulated",
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: parseInt(process.env.SMTP_PORT ?? "587", 10),
    user: process.env.SMTP_USER ?? "",
    password: process.env.SMTP_PASSWORD ?? "",
    from: process.env.EMAIL_FROM ?? "Market Mayhem <no-reply@marketmayhem.example>",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    get enabled(): boolean {
      return Boolean(this.clientId && this.clientSecret);
    },
  },
};
