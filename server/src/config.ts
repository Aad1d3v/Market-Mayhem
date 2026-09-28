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
  port: parseInt(process.env.PORT ?? "4000", 10) || 4000,
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
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
