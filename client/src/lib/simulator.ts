/**
 * The Chaos Lab model (client-side, integer cents).
 *
 * A simulation is a COPY of the player's portfolio plus a set of made-up
 * scenarios ("AAPL +80% because of a new phone"). Real simulated market prices
 * are never changed by anything in here — only this sandbox reacts.
 *
 * The single exception is profit: when a sandbox sale is profitable, the gain
 * is sent to the server (`/api/simulation/payout`) and credited to the real
 * Investment Account.
 */

export const MICRO_SHARES = 1_000_000;

export interface SimScenario {
  id: string;
  /** Listing symbol, or "*" to shock every listing at once. */
  target: string;
  percent: number;
  reason: string;
}

export interface SimPosition {
  symbol: string;
  shares: number; // micro-shares
  avgCostCents: number; // per share
}

export interface SimLogEntry {
  id: string;
  at: string;
  text: string;
  amountCents: number | null;
}

export interface SimState {
  cashCents: number;
  positions: SimPosition[];
  scenarios: SimScenario[];
  log: SimLogEntry[];
  creditedCents: number;
  snapshotEquityCents: number | null;
}

export const EMPTY_SIM: SimState = {
  cashCents: 0,
  positions: [],
  scenarios: [],
  log: [],
  creditedCents: 0,
  snapshotEquityCents: null,
};

/** Story prompts so scenarios feel like real market gossip. */
export const SCENARIO_REASONS = [
  { label: "New product launch", percent: 80 },
  { label: "Earnings blowout", percent: 35 },
  { label: "Short squeeze", percent: 150 },
  { label: "Bought by a rival", percent: 45 },
  { label: "CEO scandal", percent: -45 },
  { label: "Regulator probe", percent: -30 },
  { label: "Earnings miss", percent: -22 },
  { label: "Whole-market crash", percent: -35 },
  { label: "Meme frenzy", percent: 60 },
];

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function toMicro(shares: number): number {
  return Math.round(shares * MICRO_SHARES);
}

export function fromMicro(micro: number): number {
  return micro / MICRO_SHARES;
}

/** Combined scenario multiplier for one listing. */
export function scenarioFactor(symbol: string, scenarios: SimScenario[]): number {
  return scenarios.reduce((acc, s) => {
    if (s.target !== "*" && s.target !== symbol) return acc;
    return acc * (1 + s.percent / 100);
  }, 1);
}

/** Scenario price in cents — never below one cent. */
export function simPriceCents(
  realPriceCents: number,
  symbol: string,
  scenarios: SimScenario[],
): number {
  const factor = scenarioFactor(symbol, scenarios);
  return Math.max(1, Math.round(realPriceCents * factor));
}

export function positionCostCents(pos: SimPosition): number {
  return Math.round((pos.avgCostCents * pos.shares) / MICRO_SHARES);
}

export function positionValueCents(pos: SimPosition, priceCents: number): number {
  return Math.round((priceCents * pos.shares) / MICRO_SHARES);
}

/** Total sandbox equity (positions at scenario prices + sandbox cash). */
export function simEquityCents(
  state: SimState,
  priceBySymbol: Record<string, number>,
): number {
  let total = state.cashCents;
  for (const pos of state.positions) {
    const price = priceBySymbol[pos.symbol];
    if (price) total += positionValueCents(pos, price);
  }
  return total;
}

export function log(
  state: SimState,
  text: string,
  amountCents: number | null = null,
): SimState {
  const entry: SimLogEntry = {
    id: newId(),
    at: new Date().toISOString(),
    text,
    amountCents,
  };
  return { ...state, log: [entry, ...state.log].slice(0, 40) };
}

export function buy(
  state: SimState,
  symbol: string,
  qtyShares: number,
  priceCents: number,
): { state: SimState; error?: string } {
  const micro = toMicro(qtyShares);
  if (micro <= 0) return { state, error: "Enter a quantity greater than zero." };
  const cost = Math.round((priceCents * micro) / MICRO_SHARES);
  if (cost <= 0) return { state, error: "That quantity is too small to trade." };
  if (cost > state.cashCents) {
    return { state, error: "Not enough sandbox cash for that order." };
  }
  const positions = [...state.positions];
  const idx = positions.findIndex((p) => p.symbol === symbol);
  if (idx >= 0) {
    const pos = positions[idx]!;
    const totalMicro = pos.shares + micro;
    const totalCost = positionCostCents(pos) + cost;
    positions[idx] = {
      symbol,
      shares: totalMicro,
      avgCostCents: Math.round((totalCost * MICRO_SHARES) / totalMicro),
    };
  } else {
    positions.push({
      symbol,
      shares: micro,
      avgCostCents: Math.round((cost * MICRO_SHARES) / micro),
    });
  }
  const next = log(
    { ...state, cashCents: state.cashCents - cost, positions },
    `Sandbox buy: ${qtyShares} ${symbol} at $${(priceCents / 100).toFixed(2)}`,
    -cost,
  );
  return { state: next };
}

export interface SellOutcome {
  state: SimState;
  error?: string;
  realizedCents: number;
  salePrice: string;
  costBasis: string;
  quantity: string;
}

export function sell(
  state: SimState,
  symbol: string,
  qtyShares: number,
  priceCents: number,
): SellOutcome {
  const micro = toMicro(qtyShares);
  const empty: SellOutcome = {
    state,
    realizedCents: 0,
    salePrice: "0",
    costBasis: "0",
    quantity: "0",
  };
  if (micro <= 0) return { ...empty, error: "Enter a quantity greater than zero." };
  const idx = state.positions.findIndex((p) => p.symbol === symbol);
  if (idx < 0) return { ...empty, error: `You don't own ${symbol} in this simulation.` };
  const pos = state.positions[idx]!;
  if (micro > pos.shares) {
    return { ...empty, error: "You cannot sell more shares than the sandbox holds." };
  }
  const proceeds = Math.round((priceCents * micro) / MICRO_SHARES);
  const basis = Math.round((pos.avgCostCents * micro) / MICRO_SHARES);
  const realized = proceeds - basis;

  const positions = [...state.positions];
  if (micro === pos.shares) {
    positions.splice(idx, 1);
  } else {
    positions[idx] = { ...pos, shares: pos.shares - micro };
  }

  const next = log(
    {
      ...state,
      cashCents: state.cashCents + proceeds,
      positions,
    },
    `Sandbox sell: ${qtyShares} ${symbol} at $${(priceCents / 100).toFixed(2)} (${realized >= 0 ? "+" : "−"}$${Math.abs(realized / 100).toFixed(2)} realised)`,
    proceeds,
  );

  return {
    state: next,
    realizedCents: realized,
    salePrice: (priceCents / 100).toFixed(6),
    costBasis: (pos.avgCostCents / 100).toFixed(6),
    quantity: fromMicro(micro).toString(),
  };
}

/** Build a fresh sandbox from the live account. */
export function snapshotFromPortfolio(
  cashCents: number,
  holdings: { symbol: string; shares: string; averageCost: string }[],
  priceBySymbol: Record<string, number>,
): SimState {
  const positions: SimPosition[] = holdings.map((h) => ({
    symbol: h.symbol,
    shares: toMicro(Number(h.shares)),
    avgCostCents: Math.round(Number(h.averageCost) * 100),
  }));
  const base: SimState = {
    cashCents,
    positions,
    scenarios: [],
    log: [],
    creditedCents: 0,
    snapshotEquityCents: null,
  };
  return { ...base, snapshotEquityCents: simEquityCents(base, priceBySymbol) };
}

const STORAGE_PREFIX = "mm_sim_v1_";

export function loadSim(userId: string): SimState | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SimState;
    if (!Array.isArray(parsed.positions) || !Array.isArray(parsed.scenarios)) return null;
    return { ...EMPTY_SIM, ...parsed };
  } catch {
    return null;
  }
}

export function saveSim(userId: string, state: SimState): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(state));
  } catch {
    /* storage full or unavailable — the sandbox still works in memory */
  }
}
