/**
 * Production verification — exercises the deployed-style server end to end.
 * Usage: node server/tests/e2e-prod.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? "http://localhost:4000";
let cookie = "";
let pass = 0;
let fail = 0;

function check(name, ok, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`  ✗ FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function req(method, path, body, useAuth = true) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(useAuth && cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json };
}

const uniq = `e2e_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

// ---------------------------------------------------------------- health
console.log("1. Health & markets");
{
  const { status, json } = await req("GET", "/api/health", null, false);
  check("GET /api/health → 200 ok", status === 200 && json?.ok === true);
}
let quotes = [];
{
  const { status, json } = await req("GET", "/api/markets", null, false);
  quotes = json?.quotes ?? [];
  check(
    "GET /api/markets returns full universe",
    status === 200 && quotes.length >= 300,
    `${quotes.length} quotes, ${json?.sectors?.length ?? 0} sectors`,
  );
  check("market payload has events + upcoming", Array.isArray(json?.events) && "upcoming" in json);
  check("label is SIMULATED", json?.label === "SIMULATED");
}
{
  const sym = quotes[Math.floor(quotes.length / 2)]?.symbol;
  const { status, json } = await req("GET", `/api/stocks/${encodeURIComponent(sym)}`, null, false);
  check(
    `GET /api/stocks/${sym} → quote with price`,
    status === 200 && Number(json?.quote?.price) > 0,
    `$${json?.quote?.price}`,
  );
}

// ---------------------------------------------------------------- auth
console.log("2. Registration & welcome grant");
{
  const reg = await req("POST", "/api/auth/register", {
    username: uniq,
    email: `${uniq}@example.test`,
    password: "E2eTest!2026x",
  });
  check("POST /api/auth/register → 201 + session", reg.status === 201 || reg.status === 200, `status ${reg.status}`);

  const me = await req("GET", "/api/me");
  check("GET /api/me with cookie → profile", me.status === 200 && me.json?.id, me.json?.username);

  const wallet = await req("GET", "/api/wallet");
  check(
    "wallet starts at exactly $800.00",
    wallet.json?.walletBalance === "800.00",
    wallet.json?.walletBalance,
  );

  const pf = await req("GET", "/api/portfolio");
  const gift = (pf.json?.holdings ?? []).find((h) => h.symbol === "AADIDEV");
  check(
    "portfolio holds 1 gifted AADIDEV share",
    gift && Number(gift.shares) === 1,
    gift ? `${gift.shares} share(s)` : "missing",
  );
}

// ---------------------------------------------------------------- trading
console.log("3. Transfers & trading");
{
  const big = await req("POST", "/api/wallet/transfer", {
    direction: "WALLET_TO_INVESTMENT",
    amount: "200",
  });
  check("transfer $200 wallet → investment", big.status === 200 || big.status === 201);
  const w2 = await req("GET", "/api/wallet");
  check(
    "wallet $600 / investment $200 after transfer",
    w2.json?.walletBalance === "600.00" && w2.json?.investmentCash === "200.00",
    `wallet ${w2.json?.walletBalance}, inv ${w2.json?.investmentCash}`,
  );

  // Pick affordable listings dynamically — the simulated 50-day cycle moves
  // prices, so a hardcoded symbol can be briefly unaffordable with $200.
  const mk = await req("GET", "/api/markets", null, false);
  const allQuotes = (mk.json?.quotes ?? [])
    .map((q) => ({ ...q, price: Number(q.price) }))
    .filter((q) => q.price > 0);
  const cheap = [...allQuotes].sort((a, b) => a.price - b.price)[0];
  const pricey = [...allQuotes].sort((a, b) => b.price - a.price)[0];

  const buy = await req("POST", "/api/orders", {
    side: "BUY",
    symbol: cheap.symbol,
    quantity: "1",
    clientRequestId: `${uniq}-buy-1`,
  });
  check(`BUY 1 ${cheap.symbol} fills`, buy.status === 200 || buy.status === 201, `status ${buy.status}`);

  const replay = await req("POST", "/api/orders", {
    side: "BUY",
    symbol: cheap.symbol,
    quantity: "1",
    clientRequestId: `${uniq}-buy-1`,
  });
  check("duplicate clientRequestId rejected (409)", replay.status === 409, `status ${replay.status}`);

  const over = await req("POST", "/api/orders", {
    side: "SELL",
    symbol: cheap.symbol,
    quantity: "50",
    clientRequestId: `${uniq}-sell-50`,
  });
  check("over-sell rejected", over.status === 400, `status ${over.status}`);

  const broke = await req("POST", "/api/orders", {
    side: "BUY",
    symbol: pricey.symbol,
    quantity: "100",
    clientRequestId: `${uniq}-buy-rich`,
  });
  check("insufficient-cash BUY rejected", broke.status === 400, `status ${broke.status}`);

  const ghost = await req("POST", "/api/orders", {
    side: "BUY",
    symbol: "NOTREAL",
    quantity: "1",
    clientRequestId: `${uniq}-buy-ghost`,
  });
  check("unknown symbol rejected", ghost.status === 400, `status ${ghost.status}`);

  const pf2 = await req("GET", "/api/portfolio");
  const bought = (pf2.json?.holdings ?? []).find((h) => h.symbol === cheap.symbol);
  check(`${cheap.symbol} appears in portfolio after buy`, Boolean(bought), bought ? `${bought.shares} sh` : "");
}

// ---------------------------------------------------------------- chaos lab
console.log("4. Chaos Lab payout");
{
  const pf = await req("GET", "/api/portfolio");
  const cashBefore = Number(pf.json?.investmentCash ?? "0");

  // Profitable sandbox sale: 1 AAPL at 2x live price (within the 0.05x–3x band).
  const quote = await req("GET", "/api/stocks/AAPL", null, false);
  const live = Number(quote.json?.quote?.price ?? 190);
  const payout = await req("POST", "/api/simulation/payout", {
    symbol: "AAPL",
    quantity: "1",
    salePrice: (live * 2).toFixed(2),
    costBasis: live.toFixed(2),
  });
  check("profitable sandbox sale credits cash", payout.status === 200 && Number(payout.json?.credited) > 0, `credited $${payout.json?.credited}`);
  const w3 = await req("GET", "/api/wallet");
  check(
    "investment cash increased by the credited amount",
    Math.abs(Number(w3.json?.investmentCash) - (cashBefore + Number(payout.json?.credited))) < 0.01,
    `cash now ${w3.json?.investmentCash}`,
  );

  const outOfBand = await req("POST", "/api/simulation/payout", {
    symbol: "AAPL",
    quantity: "1",
    salePrice: (live * 10).toFixed(2), // beyond the 3x cap
    costBasis: live.toFixed(2),
  });
  check("sandbox sale outside price band rejected", outOfBand.status === 400, `status ${outOfBand.status}`);
}

// ---------------------------------------------------------------- guards
console.log("5. Security guards");
{
  const anon = await fetch(`${BASE}/api/portfolio`);
  check("portfolio requires auth (401)", anon.status === 401, `status ${anon.status}`);

  const adminPanel = await fetch(`${BASE}/api/admin/stats`, { headers: { cookie } });
  check("non-admin blocked from /api/admin (403)", adminPanel.status === 403, `status ${adminPanel.status}`);

  const landing = await fetch(`${BASE}/`);
  const html = await landing.text();
  check(
    "built client served with Market Mayhem title",
    landing.status === 200 && html.includes("Market Mayhem"),
  );
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
