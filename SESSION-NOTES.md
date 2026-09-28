# Market Mayhem — Session Log (2026-09-27)

## Completed work

### 1. Universe expansion — 319 listings (was 158), 55 sectors
File: `server/src/services/market-data/universe.ts`

- US stocks: banks/insurers (WFC, C, MS, SCHW, AXP, BLK, COF, PGR, TRV, AIG, MET, ALL, UNM), airlines (UAL, AAL, LUV, AC), aerospace & defense (LMT, NOC, GD, TDG), industrials (FDX, UNP, CSX, NSC, MMM, HON, WM, PWR, URI, CMI, EMR, ROK, ITW, PH), utilities (AEP, EXC, XEL), cybersecurity (PANW, CRWD, FTNT), semis (SNPS, ARM, MU), software (SHOP, INTU, IBM, SAP, MDB, DDOG, SHOPX, AIQ), hardware (DELL, HPE, CSCO), REITs (AMT, EQIX, DLR, AVB, EQR, VICI, WELL), midstream (OKE, WMB, KMI, ET), travel/leisure (BKNG, MAR, CCL, DAL), communication/media (U, MTCH, PINS, SNAP, TME, WMG, LYV, CMCSA), consumer (TGT, LOW, EBAY, DHI, LEVI, KHC, MDLZ, STZ, TAP), telecom equipment (NOK, ERIC, NOKA).
- Canada (TSX): CP.TO, DOL.TO, GIL.TO, CJR.B.TO, BDT.TO.
- ETFs (12 → 47): SMH, IYW, IYT, ITB, XBI, ITA, JETS, ARKK, QQXS (inverse), SLV, UNG, USO, PDBC, EEM, FXI, EWJ, VGK, XLU, REZ, AGG, SHV, BIL.
- Crypto (8 → 18): DOT, MATIC, ATOM, LTC, BCH, UNI, AAVE, SHIB, PEPE, FARTCOIN (Meme Crypto sector).
- Commodities (8 → 27): CORN, SOYBEAN, COFFEE, COCOA, SUGAR, COTTON, ORANGE, PLATINUM, PALLADIUM, LITHIUM, COBALT, NICKEL, ALUMINUM, STEEL, HEATOIL, GASOLINE, ETHANOL, CATTLE, HOGS.
- Bonds (5 → 12): MUNI, TIPS, JUNK-3M, EMB, GIC-5Y, HISA, CASH.TO.
- AadiVerse (8 → 19): BAGHOLDER, TOTMOON (fixed from "TO THE MOON" — space broke the symbol regex), WAGMI, NGMI, APEX, STONKS, GIGACHAD, ZOOMER, BOOMER, MILK, COPING.

Verification: 319 unique symbols, no dupes, all prices positive and sane across the 50-day cycle (min 0.15).

### 2. Markets page: row click → detail page
File: `client/src/pages/MarketsPage.tsx`
- `openDetail(symbol)` navigates to `/stocks/:symbol` on row tap (desktop `<tr>` + mobile button).
- Buy button (with stopPropagation) → `/trade?symbol=...&side=BUY` via `openTrade`.
- Details link → `/stocks/:symbol` (was wrongly `/trade`).
- Hint text updated.

### 3. Buy page (TradePage): full searchable picker
File: `client/src/pages/TradePage.tsx`
- New `ListingPicker` component: search input + category chips (Everything/Stocks/ETFs/Crypto/Commodities/Bonds/AadiVerse) + scrollable results (60 shown) with price/delta; tapping a row loads it into the order ticket.
- `const quotes = useMemo(() => markets?.quotes ?? [], [markets])` added; `<ListingPicker quotes={quotes} .../>` replaces the old GlobalSearch in the "Find a listing" card. Quick picks + movers chips retained.

### 4. Rename: What-If Lab → "Chaos Lab" 🔥
- `client/src/layouts/AppLayout.tsx` (sidebar NAV + mobile MORE_MENU)
- `client/src/pages/SimulatorPage.tsx` (h1 "🔥 Chaos Lab", doc comment, "How the Chaos Lab works", section titles "Chaos Lab portfolio" / "Chaos Lab activity")
- `client/src/pages/DashboardPage.tsx` (button)
- `client/src/pages/HelpPage.tsx` (FAQ)
- `client/src/pages/LandingPage.tsx` (feature chip + card)
- `client/src/lib/simulator.ts` (comment)
- `server/src/services/simulation.ts` (comment + notification body)
- Kept route `/simulator` and file name `SimulatorPage.tsx` so no URLs break.

### 5. 13 new scheduled chaos events (33 total per 50-day cycle)
File: `server/src/services/market-data/events.ts`
- bank-run (Financials −24%), airline-squeeze (Airlines −20%), reit-rate-pinch (REITs −16%), meme-collapse (Meme −30%), coffee-crisis (Softs +32%), battery-boom (Battery Metals +24%), meme-coin-mania (Meme Crypto +45%), stablecoin-wobble (CRYPTO −22%), dividend-stampede (Dividend Fund +14%), defense-order (Aerospace & Defense +18%), aadiverse-mania (AADI market +28%), lightning-crash (ALL −12%, 2h).
- NEW `EventScope` value `"MARKET"`; `eventAppliesTo` now matches by market; signature widened to include `market`.
- `packages/shared/src/types.ts`: `MarketEventView` scope union now includes `"MARKET"`.

### 6. Welcome gift — verified already implemented
`server/src/services/auth.ts` `register()` creates user + $800 wallet + investment account + tutorial + watchlist + 1 HOUSE_STOCK (AADIDEV) share at the current simulated price + ledger + activity + notification, all in one transaction. No change needed.

### 7. Copy/count updates
- `client/index.html` meta description: 140+ → 300+ listings.
- `client/src/pages/LandingPage.tsx`: "Trade 300+ simulated listings", chips "300+ Listings", "Chaos Lab".
- `README.md`: 158 → 319 listings, AadiVerse wording.

## Verification
- `npm run typecheck` — all 3 workspaces clean.
- `npm test` — 36/36 server tests pass (shared workspace has no tests; its vitest exits 1 — pre-existing).
- `npm run build` — production build succeeds.
- Custom sanity script: all 33 events activate inside their windows; aadiverse-mania hits AADIDEV but spares AAPL; min price across the full cycle = 0.15 (sane).

## Notes / gotchas
- Several `str_replace` calls in this session returned garbled or phantom outputs; files were re-read and verified after each. Final state is consistent.
- `DAL` was briefly duplicated (consumer + industrials sections); removed the industrials copy.
- Duplicate `COST` row at the end of the consumer section removed.
- Dev DB is SQLite (`prisma/dev.db`, plus `.freebuff/desktop-v2.db`); the app runs via `npm start` (db push + seed + tsx server).

## Achievements & milestones expansion (2026-09-27)

- `prisma/seed.ts`: 17 → **39 achievements** (seeded OK, no dupes). New series:
  - Trades: FIFTY_TRADES, HUNDRED_TRADES. Wealth: PORTFOLIO_10000, PORTFOLIO_25000.
  - Asset-class explorers: CRYPTO_CURIOUS, GOLD_FINGER (Precious Metals sector), BOND_HOLDER, FUND_BELIEVER, COMMODITY_TRADER, AADIVERSE_LOCAL, CLASS_TOURIST (4+ classes held).
  - Watchlist: WATCHLIST_STARTER/FIVE/TEN/HOARDER (1/5/10/25 items).
  - Chaos Lab: CHAOS_APPRENTICE (first payout), CHAOS_JOURNEYMAN ($500 lifetime), CHAOS_LORD ($2,500 lifetime).
  - Streaks/habits: STREAK_3/7/30 (consecutive UTC login days via LOGIN activity events), NIGHT_OWL (trade 22:00–04:00).
- `server/src/services/gamification.ts`: extended `evaluateTradeAchievements` (new trade/wealth tiers, asset-class unlocks from `getStockDef`, CLASS_TOURIST via distinct asset classes of current holdings, NIGHT_OWL by trade hour); new `evaluateWatchlistAchievements`, `evaluateChaosLabAchievements(userId, creditedCents, lifetimeCents)`, `evaluateLoginStreak` (walks distinct LOGIN-activity UTC days, breaks at first gap).
- Hooks: `/api/auth/login` logs a LOGIN activity event + evaluates streak (best-effort, never blocks login); watchlist POST evaluates watchlist achievements; Chaos Lab `/api/simulation/payout` aggregates lifetime SIMULATION_PROFIT from the ledger and evaluates the chaos series.
- Verified live (fresh test users): watchlist 1/5 unlock at 1 and 5 adds (10/25 stay locked); CRYPTO_CURIOUS, GOLD_FINGER, FUND_BELIEVER, AADIVERSE_LOCAL, COMMODITY_TRADER, BOND_HOLDER, DIVERSIFIED, CLASS_TOURIST all unlock via buys; CHAOS_APPRENTICE unlocks on first profitable sandbox payout; TUTORIAL_COMPLETE unlocks; login works and streak correctly stays locked on day 1. 39/39 achievements returned by `/api/achievements`.
- Full sweep re-run green: typecheck 0 errors, vitest 36/36, e2e 23/23, client rebuilt.

## Production verification (2026-09-27, all green)

- `aadidevs723.doc` trimmed from a 238-line full reference (16 env vars, API tables) to a bare-essentials deploy cheat-sheet: only the 6 required vars (DATABASE_URL auto-wired, SESSION_SECRET, NODE_ENV, CLIENT_URL, ADMIN_EMAIL, ADMIN_PASSWORD); everything else documented as optional-with-safe-defaults. Kept deploy steps + file map.
- Ran a production-style server (`npx tsx server/src/index.ts` serving the built `client/dist` bundle on :4000). Killed a stale pre-change server first — it was returning the old 15-quote universe.
- New e2e script `server/tests/e2e-prod.mjs` — 23/23 checks pass: health, 319 quotes/55 sectors, SIMULATED label, stock detail, register → $800.00 wallet + 1 gifted AADIDEV share, $200 transfer → $600/$200, BUY fills, duplicate clientRequestId → 409, over-sell/insufficient-cash/unknown-symbol → 400, Chaos Lab payout credits profit (+$194.04) and rejects out-of-band prices (10x live), 401 unauth, 403 non-admin, built client served with correct title.
- Browser-verified in the built bundle: Markets page shows "319 simulated listings" + 55-category filter + live event banners (Battery Boom, Commodity Boom active; Hype Train upcoming); clicking a table row navigates to `/stocks/:symbol` detail page (fundamentals, news, Buy/Sell); Buy page ListingPicker works (search box, category chips — Commodities showed all 27 incl. new ones, picked URANIUM → order ticket filled, insufficient-cash guard shown correctly); `/simulator` shows "🔥 Chaos Lab" with zero "What-If" remnants, clone-from-real-portfolio works (5 AADIDEV + $109.42 cash), Sim sell of all 5 at a loss stayed in sandbox (activity logged "−$10.70 realised", no payout), and the REAL portfolio was untouched (still 5 AADIDEV, $109.42 investment cash).
- Server log clean (no errors); dev-mail printed verification code as expected (no SMTP).
- Final sweep: `npm run typecheck` exit 0, server vitest 36/36, e2e 23/23. Temp artifacts cleaned up. A server is still listening on :4000 (PID 31848) for the user to browse.
