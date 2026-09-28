# Market Mayhem

**Learn the market. Risk nothing.**

Market Mayhem is a free, production-quality **educational stock-market simulation** web app.
Every user starts with **exactly $800.00 CAD of virtual money — granted once** plus
**1 free share of Aadidev.co** (`AADIDEV`), the house listing. No real money is ever deposited,
invested, or withdrawn, and no real trades are executed.

> ⚠️ **Simulation Disclaimer** — Market Mayhem is an educational simulation. It does not provide
> investment advice and does not execute real trades. **All market data is simulated**: a
> deterministic engine generates every price, and the pattern **repeats every 50 days**.
> Nothing you see here is real market data.

---

## Features

- **Two-account money model** — Wallet (bank) + Investment Account (trading cash), with a
  full double-entry-style **ledger** (`STARTING_BALANCE`, `WALLET_TO_INVESTMENT`,
  `INVESTMENT_TO_WALLET`, `BUY`, `SELL`).
- **Server-authoritative trading engine** — orders are validated, priced and settled
  atomically on the server (order + holding + cash + ledger in one DB transaction).
  Fractional shares, average-cost accounting, realized P/L on sells.
- **Deterministic simulated market data** — `price(symbol, time)` is a pure function with a
  **50-day repeating cycle**; quotes, charts, movers, news and portfolio marks all derive
  from the same engine, so nothing can disagree. **319 listings** in five categories —
  stocks (US + Canadian), ETFs & funds, crypto, commodities (gold, oil, uranium…) and bonds —
  plus a growing AadiVerse of fictional tickers. Volatility scales with the asset class, so crypto
  swings hard while bonds barely move. All prices in **CAD**.
- **Scenario events baked into the timeline** — flash crashes, Dead-Cat Bounces, meme
  frenzies, crypto winters, oil shocks, multi-day melt-ups and a Black Swan Friday. They are
  deterministic (they repeat with the 50-day cycle), they really move every price the trading
  and portfolio engines see, and the UI shows a live banner, a countdown and a rumour-mill
  teaser for the next one. Admin-activated events (Bull Run, Market Crash…) stack on top.
- **What-If Lab (sandbox simulator)** — clone your portfolio, invent scenarios
  (“AAPL +80% because of a new phone”), and buy/sell inside that made-up world. The shared
  market never moves because of your scenario, but **profit from a profitable sandbox sale is
  credited to your real Investment Account** (server-validated, capped at $25,000 per sale).
- **Interactive 10-step tutorial** that drives the *real* UI and performs *real* simulated
  actions (a $200 transfer and a 5-share demo buy).
- **Learning center** — 14 lessons with quizzes, XP, explanations on right and wrong answers.
- **Gamification** — XP curve, 17 achievements, daily challenge, leaderboard (opt-out,
  usernames only), activity feed.
- **Market events** — admin-activated game scenarios (Bull Run, Market Crash…) applied to live
  prices with a 6-hour full-strength, 42-hour fade window. Clearly badged, never mixed with
  anything presented as real.
- **Helpdesk** — FAQ + support tickets with threads (`#ADI-XXXXX` ticket numbers).
- **Admin dashboard** — server-authorized; stats, user management, ticket replies, events.
- **Polish** — dark-first design, loading skeletons, toasts, confirmation flows, empty/error
  states, mobile bottom nav, responsive charts, a11y (arrows + signs on every P/L, not color
  alone), rate limiting, security headers.

## Tech Stack

| Layer     | Tech                                                              |
| --------- | ----------------------------------------------------------------- |
| Frontend  | React 18, TypeScript, Vite, Tailwind CSS v4, Recharts, TanStack Query, React Router |
| Backend   | Node.js 20+, TypeScript, Express                                  |
| Database  | PostgreSQL 16, Prisma ORM (Decimal money columns, atomic transactions) |
| Auth      | Email/password (scrypt hashing), secure httpOnly session cookies, email verification + password reset codes, optional Google OAuth hooks |

## Project Structure

```
├── client/                React app (Vite)
│   └── src/{components,pages,layouts,tutorial,lib}
├── server/                Express API
│   └── src/{routes,services,middleware,utils}
├── packages/shared/       Shared types & formatters (single source of API truth)
├── prisma/                schema.prisma + seed.ts
├── docker-compose.yml     Local PostgreSQL
└── .env.example           All configuration, no secrets
```

## Quick Start (Development)

Prerequisites: **Node 20+**, **Docker** (for Postgres).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   → set SESSION_SECRET (openssl rand -base64 48)

# 3. Start PostgreSQL
npm run db:up

# 4. Create schema + seed data (admin, lessons, achievements, dev user)
npm run db:migrate      # then confirm the dev URL when prompted
npm run db:seed

# 5. Run both dev servers
npm run dev
#    client → http://localhost:5173
#    server → http://localhost:4000
```

Register a fresh account in the UI — you'll land in the tutorial with $800 in the wallet.

### Test accounts (development only)

- **Dev user:** `dev@aadiinvest.local` / `DevTrader!2026` — created by seed, $800 wallet.
- **Admin:** value of `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`
  (default `admin@aadiinvest.local` / `ChangeMe!Admin2026` — change it before sharing).

Do **not** commit real credentials; these are documented development conveniences only.

## Environment Variables

See `.env.example`. Highlights:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Session cookie signing secret (long random string) |
| `CLIENT_URL` | Frontend origin (CORS + email links) |
| `MARKET_DATA_PROVIDER` | `simulated` (default). The abstraction in `server/src/services/market-data/` lets you implement a real provider without touching the rest of the app |
| `GOOGLE_CLIENT_ID/SECRET` | Optional Google sign-in (button hides when unset) |
| `SMTP_*` / `EMAIL_FROM` | Optional real email; otherwise verification/reset codes print to the **server console** in dev |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seed-time admin credentials |

## Database

```bash
npm run db:up        # docker compose up -d (Postgres 16)
npm run db:migrate   # prisma migrate dev
npm run db:seed      # achievements, lessons, quizzes, events, test users
npm run db:studio    # browse data
npm run db:reset     # nuclear option (dev only)
```

For a managed provider (Neon/Supabase/RDS), point `DATABASE_URL` there and run
`npm run db:deploy` (applies migrations without prompts) + `npm run db:seed`.

## Authentication & Security Notes

- Passwords hashed with **scrypt** (memory-hard, Node core); never stored or logged in plaintext.
- Sessions are opaque random tokens, **hashed at rest**, delivered as `httpOnly`, `SameSite=Lax`
  cookies (`Secure` in production); 30-day expiry; server-side revocation (password reset and
  admin disable kill all sessions).
- Every list endpoint paginates; every write validates via **zod**; all money math is
  **Decimal** server-side — price/cash/quantity values from the client are never trusted.
- Anti-cheat: negative quantities/transfers rejected, over-sell rejected, insufficient cash
  rejected, duplicate orders rejected via `clientRequestId` unique index, balances only ever
  change inside atomic transactions with a ledger row.
- Rate limiting on all APIs (stricter on auth), Helmet security headers, CORS locked to `CLIENT_URL`.

## Market Data Configuration

Out of the box, `MARKET_DATA_PROVIDER=simulated` and the app needs **no API key**. The
`MarketDataService` (`server/src/services/market-data/`) is the only module allowed to
produce prices — to integrate a real provider (e.g. Finnhub), add an adapter next to
`engine.ts` implementing `getQuote / getHistoricalPrices / searchStocks / getCompanyProfile /
getMarketStatus / getMarketNews` and switch the env var. Labeling (`SIMULATED` vs
delayed/real-time) is enforced in the UI layer.

## Production Deployment

1. Provision managed PostgreSQL; set `DATABASE_URL`.
2. Set strong `SESSION_SECRET`, `NODE_ENV=production`, correct `CLIENT_URL`.
3. Build & run:
   ```bash
   npm ci
   npm run build          # typechecks + builds client (Vite) — server runs via tsx or your process manager
   npm run db:deploy && npm run db:seed
   node server/dist/index.js   # or: npx tsx server/src/index.ts behind a reverse proxy
   ```
4. Serve the built `client/dist` from any static host/CDN, or from the API server behind
   nginx — API base path is `/api/*`.
5. Complete the pre-flight checklist below before launch.

### Pre-flight QA checklist (abridged from the product spec)

Register → confirm Wallet **$800** / Investment **$0** → tutorial → transfer $200 → Wallet
$600 / Investment $200 → markets → open AAPL → chart works → buy → cash decreases, holding
appears → sell part → cash increases → activity log → watchlist persists after refresh →
log out/in → balances **do not reset to $800** → insufficient-cash buy rejected →
over-sell rejected → mobile layout → lesson + quiz + achievement → helpdesk ticket →
non-admin blocked from `/admin` → admin dashboard works → data labeled SIMULATED everywhere.

## License / Use

Educational project. Company names appear as fictional simulated listings for familiarity;
no affiliation, no real prices, no advice.
