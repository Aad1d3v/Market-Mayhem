# 🚀 Launch Checklist — Market Mayhem on Render

Everything below reflects the verified state of the repo as of 2026-09-28.
Typecheck ✅ · 36/36 unit tests ✅ · 23/23 production e2e checks ✅ · client builds ✅

---

## What was broken (and is now fixed)

| # | Problem | Impact on Render | Fix |
|---|---------|------------------|-----|
| 1 | `prisma/` folder was **missing at the repo root** (only existed in the nested `market MMayham/` copy) | `COPY prisma prisma` fails → Docker build error on Render's first build | Copied `prisma/` (both schemas + seed) to the root; removed the stray local `dev.db` |
| 2 | Root Dockerfile/render.yaml/package.json/index.ts were **older** than the repo-connected copies (no `docker-start.sh`, `localhost` bind, `prisma db push` without `--skip-generate`, admin creds required by hand at deploy time) | Deploy would work but with weaker first-run behavior | Reconciled both directions — the best of each version is now in both copies |
| 3 | No wait for PostgreSQL readiness | On Render free tier the DB can take ~1 min to accept connections on first deploy → crash loop | `docker-start.sh` now retries the connection for up to 150s before `prisma db push` |
| 4 | Duplicated `ADMIN_EMAIL` key risk in render.yaml | Blueprint validation failure | Verified: 14 env keys, no duplicates (programmatically checked) |
| 5 | `.gitattributes` didn't pin `*.sh` to LF | A Windows checkout + commit could flip `docker-start.sh` to CRLF → container crash (`/bin/sh^M`) | `*.sh text eol=lf` added |
| 6 | Nested repo copy would be committed by `git add -A` | Repo bloat / confusing Blueprint context | `.gitignore` + `.dockerignore` now exclude `market MMayham/` and `Market mayham (official)/` |
| 7 | `server/src/index.ts` bound without explicit `0.0.0.0` | Risk of Render health-check failure if defaults change | Explicit `app.listen(config.port, "0.0.0.0", ...)` |
| 8 | Local `node_modules/@aadiinvest/shared` symlink was **dangling** (pointed at the project's old folder) | Broke 1 local test file (not a Render issue — Render reinstalls fresh) | Junction recreated; 36/36 tests pass again |
| 9 | `server/tests/e2e-prod.mjs` hardcoded AAPL/BRK.B | Test false-failures when the 50-day simulated cycle makes those temporarily unaffordable | Test now picks affordable listings dynamically from `/api/markets` |

> ⚠️ One honest note: while cleaning, the local dev database `prisma/dev.db` was deleted.
> For launch this doesn't matter (Render provisions a fresh Postgres and seeds it), and it
> has since been recreated + reseeded locally. The old file is recoverable for ~30 days from
> the OneDrive online Recycle Bin if you want your old local test data back.

---

## Verification results (all green)

- `npm run typecheck` — shared + server + client, 0 errors
- `npm test` (server) — **36/36** vitest tests
- `node server/tests/e2e-prod.mjs` against a production-style server (NODE_ENV=production, built client served, port 4100) — **23/23**:
  health · 319 quotes / 55 sectors · SIMULATED label · register → $800.00 + 1 gifted AADIDEV · $200 transfer → $600/$200 · BUY fills · duplicate `clientRequestId` → 409 · over-sell / insufficient-cash / unknown-symbol → 400 · Chaos Lab payout credited + out-of-band rejected · 401 unauth · 403 non-admin · built client served
- `render.yaml` — parses, no duplicate env keys, DB link name matches
- All Dockerfile COPY sources exist at the root, `client/dist` builds

---

## Your remaining manual steps (in order)

1. **Commit & push** — from `market MMayham/` (the folder connected to GitHub):
   ```
   git add -A
   git commit -m "Fix deploy blockers: prisma/ at root, DB-ready wait, hardened Dockerfile + render.yaml"
   git push
   ```
   ⚠️ `git fetch` currently says **"Repository not found"** for `Aad1d3v/market-MMayham` —
   the repo was deleted/renamed or you lost access. Fix this in the GitHub UI first:
   create the repo (or re-grant access), then `git remote set-url origin <new-url>` if the name changed.

2. **Deploy on Render** — pick ONE:
   - **Blueprint (recommended):** Render Dashboard → New → Blueprint → select the repo.
     Render reads `render.yaml`, provisions the free Postgres, and wires `DATABASE_URL` automatically.
   - **Manual Web Service:** New → Web Service → Docker runtime. Add env vars manually:
     `DATABASE_URL` (Render's Internal Connection String), `SESSION_SECRET` (any long random string),
     `NODE_ENV=production`, `CLIENT_URL=https://<your-service>.onrender.com`,
     `ADMIN_EMAIL` + `ADMIN_PASSWORD` (set these yourself — don't use the seed defaults in prod),
     `MARKET_DATA_PROVIDER=simulated`.

3. **First deploy notes**
   - The Docker build takes ~5–10 min (npm ci + Vite build + Prisma generate). That's normal.
   - On boot the container: waits for Postgres → `prisma db push` → seed (admin, 39 achievements, 14 lessons) → serves.
   - Health check is `/api/health` — the service shows Live once it responds.

4. **Post-deploy smoke test**
   - Open the site → register a fresh account → confirm Wallet $800.00 + 1 AADIDEV share.
   - Log in as your `ADMIN_EMAIL` → `/admin` loads.
   - Trade once; refresh; balances persist.

5. **Known free-tier behavior (not bugs)**
   - The service **spins down after ~15 min idle**; the first request afterwards takes ~30–60s to wake.
   - Free Postgres **expires after 30 days** — upgrade or migrate before then to keep user data.
   - Email verification/reset codes print to the server console unless SMTP is configured.

---

## Optional but recommended before sharing publicly

- [ ] Set a real `ADMIN_PASSWORD` (the blueprint's `generateValue` is random — retrieve it from the Render dashboard)
- [ ] Configure SMTP (`SMTP_HOST/USER/PASSWORD`) so verification emails actually send
- [ ] Update `EMAIL_FROM` to a domain you control (current default `no-reply@aadiinvest.example` is a placeholder)
- [ ] Consider Render's paid tier or a keep-alive ping if the cold-start hurts
- [ ] Delete the root-level throwaway copies of the two nested folders once you're confident (they're now gitignored)
