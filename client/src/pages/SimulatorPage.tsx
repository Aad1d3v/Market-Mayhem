/**
 * Chaos Lab — build a fake future, trade it, keep the profit.
 *
 * The sandbox is a COPY of your real portfolio. Scenarios you invent only
 * change prices inside this tab: the shared simulated market never moves.
 * When a sandbox sale is profitable, the profit is paid into your real
 * Investment Account (validated and capped server-side).
 */

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiRequestError } from "../lib/api.js";
import { formatCad } from "@aadiinvest/shared";
import { useAuth } from "../lib/auth-context.js";
import { useMarkets, usePortfolio } from "../components/StockHooks.js";
import EventBanner from "../components/EventBanner.js";
import {
  Button,
  Card,
  Delta,
  Modal,
  QuantityStepper,
  SectionTitle,
  SimulatedBadge,
  Skeleton,
  useToast,
} from "../components/ui.js";
import { cn } from "../lib/utils.js";
import type { Quote } from "@aadiinvest/shared";
import {
  EMPTY_SIM,
  SCENARIO_REASONS,
  type SimPosition,
  type SimState,
  buy as simBuy,
  fromMicro,
  loadSim,
  newId,
  positionCostCents,
  positionValueCents,
  saveSim,
  sell as simSell,
  simEquityCents,
  simPriceCents,
  snapshotFromPortfolio,
  toMicro,
} from "../lib/simulator.js";

export default function SimulatorPage() {
  const { user } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const { data: portfolio, isLoading: portfolioLoading } = usePortfolio();
  const { data: markets } = useMarkets();

  const quotes = useMemo(() => markets?.quotes ?? [], [markets]);
  const realPriceCents = useMemo(() => {
    const map: Record<string, number> = {};
    for (const q of quotes) map[q.symbol] = Math.round(Number(q.price) * 100);
    return map;
  }, [quotes]);

  const [sim, setSim] = useState<SimState>(EMPTY_SIM);
  const [hydrated, setHydrated] = useState(false);
  const [tradeFor, setTradeFor] = useState<{ symbol: string; side: "BUY" | "SELL" } | null>(
    null,
  );
  const [newTarget, setNewTarget] = useState("AAPL");
  const [newPercent, setNewPercent] = useState(80);
  const [newReason, setNewReason] = useState(SCENARIO_REASONS[0]!.label);

  // Load the saved sandbox, or snapshot the live account once it is ready.
  useEffect(() => {
    if (!user || hydrated || !portfolio) return;
    const saved = loadSim(user.id);
    setSim(saved ?? EMPTY_SIM);
    setHydrated(true);
  }, [user, portfolio, hydrated]);

  useEffect(() => {
    if (hydrated && user) saveSim(user.id, sim);
  }, [sim, hydrated, user]);

  const snapshot = () =>
    snapshotFromPortfolio(
      Math.round(Number(portfolio?.investmentCash ?? 0) * 100),
      (portfolio?.holdings ?? []).map((h) => ({
        symbol: h.symbol,
        shares: h.shares,
        averageCost: h.averageCost,
      })),
      realPriceCents,
    );

  if (portfolioLoading || !hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const needsSnapshot = sim.positions.length === 0 && sim.cashCents === 0;

  const simPrice = (symbol: string) =>
    simPriceCents(realPriceCents[symbol] ?? 100, symbol, sim.scenarios);

  const priceMap: Record<string, number> = {};
  for (const pos of sim.positions) priceMap[pos.symbol] = simPrice(pos.symbol);
  const simEquity = simEquityCents(sim, priceMap);
  const realEquity =
    Math.round(Number(portfolio?.investmentCash ?? 0) * 100) +
    (portfolio?.holdings ?? []).reduce(
      (acc, h) =>
        acc + Math.round((realPriceCents[h.symbol] ?? 0) * toMicro(Number(h.shares)) / 1_000_000),
      0,
    );
  const scenarioDelta = simEquity - realEquity;
  const sinceStart =
    sim.snapshotEquityCents != null ? simEquity - sim.snapshotEquityCents : 0;

  const addScenario = () => {
    const target =
      newReason.includes("crash") || newReason.includes("Meme") ? "*" : newTarget;
    setSim((s) => ({
      ...s,
      scenarios: [
        ...s.scenarios,
        { id: newId(), target, percent: newPercent, reason: newReason },
      ],
    }));
    push(
      `Scenario added: ${target === "*" ? "every listing" : target} ${
        newPercent >= 0 ? "+" : ""
      }${newPercent}% (${newReason}).`,
      "success",
    );
  };

  const removeScenario = (id: string) =>
    setSim((s) => ({ ...s, scenarios: s.scenarios.filter((x) => x.id !== id) }));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">🔥 Chaos Lab</h1>
          <p className="text-sm text-ink-dim mt-0.5">
            Invent a fake future, trade it, and keep the profit. Nothing here changes the shared
            simulated market — only this sandbox.
          </p>
        </div>
        <SimulatedBadge />
      </header>

      <div className="rounded-2xl border border-brand/30 bg-brand/10 p-4 text-sm">
        <p className="font-semibold">How the Chaos Lab works</p>
        <ul className="mt-1.5 space-y-1 text-ink-dim list-disc pl-5">
          <li>Your sandbox starts as a copy of your real portfolio: same cash, same shares.</li>
          <li>
            Scenarios you create only move prices <span className="text-ink">inside this tab</span>.
          </li>
          <li>
            Sell at a gain and the <span className="text-ink font-semibold">profit is paid into
            your real Investment Account</span> (losses stay in the sandbox, capped at $25,000 per
            sale).
          </li>
        </ul>
      </div>

      <EventBanner events={markets?.events} upcoming={markets?.upcoming} limit={1} />

      {/* Live sandbox summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="!p-4">
          <p className="text-xs text-ink-dim uppercase tracking-wide">Sandbox value</p>
          <p className="text-2xl font-bold tabular-nums mt-1">
            {formatCad(simEquity / 100)}
          </p>
          <p className="text-xs text-ink-faint">sandbox cash + scenario prices</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-ink-dim uppercase tracking-wide">Real account</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{formatCad(realEquity / 100)}</p>
          <p className="text-xs text-ink-faint">untouched by this tab</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-ink-dim uppercase tracking-wide">What-if difference</p>
          <p className="text-2xl font-bold tabular-nums mt-1">
            {needsSnapshot ? (
              <span className="text-ink-faint">—</span>
            ) : (
              <Delta value={(scenarioDelta / 100).toFixed(2)} />
            )}
          </p>
          <p className="text-xs text-ink-faint">
            {needsSnapshot
              ? "clone your portfolio to begin"
              : sinceStart === 0
                ? "your scenarios vs today"
                : `since you started: ${sinceStart >= 0 ? "+" : "−"}$${Math.abs(sinceStart / 100).toFixed(2)}`}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-ink-dim uppercase tracking-wide">Paid to real account</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-up">
            {formatCad(sim.creditedCents / 100)}
          </p>
          <p className="text-xs text-ink-faint">profit from profitable sandbox sales</p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        {/* Scenario builder */}
        <Card>
          <SectionTitle title="Build a fake future" />
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Listing</label>
                <select
                  className="input"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                >
                  {quotes.map((q) => (
                    <option key={q.symbol} value={q.symbol}>
                      {q.symbol} — {q.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Story</label>
                <select
                  className="input"
                  value={newReason}
                  onChange={(e) => {
                    setNewReason(e.target.value);
                    const preset = SCENARIO_REASONS.find((r) => r.label === e.target.value);
                    if (preset) setNewPercent(preset.percent);
                  }}
                >
                  {SCENARIO_REASONS.map((r) => (
                    <option key={r.label} value={r.label}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">
                Price move: {newPercent >= 0 ? "+" : ""}
                {newPercent}%
              </label>
              <input
                type="range"
                min={-90}
                max={250}
                step={5}
                value={newPercent}
                onChange={(e) => setNewPercent(Number(e.target.value))}
                className="w-full accent-indigo-400 cursor-pointer"
                aria-label="Scenario price move percent"
              />
              <div className="mt-1.5 flex gap-1.5 flex-wrap">
                {[-70, -35, -20, 20, 50, 80, 150, 250].map((p) => (
                  <button
                    key={p}
                    onClick={() => setNewPercent(p)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs cursor-pointer",
                      newPercent === p
                        ? "border-brand bg-brand/15 text-brand-strong"
                        : "border-edge text-ink-dim hover:text-ink",
                    )}
                  >
                    {p >= 0 ? "+" : ""}
                    {p}%
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-ink-faint">
              Heads-up: “Whole-market crash” and “Meme frenzy” stories hit{" "}
              <span className="text-ink">every listing</span> in your sandbox, so they are applied
              market-wide.
            </p>

            <Button className="w-full" onClick={addScenario}>
              Add scenario
            </Button>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {sim.scenarios.length === 0 && (
                <p className="text-sm text-ink-dim">
                  No scenarios yet — add one and watch your sandbox portfolio react.
                </p>
              )}
              {sim.scenarios.map((s) => (
                <span
                  key={s.id}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
                    s.percent >= 0
                      ? "border-up/40 bg-up-soft text-up"
                      : "border-down/40 bg-down-soft text-down",
                  )}
                >
                  <span className="font-semibold">
                    {s.target === "*" ? "EVERYTHING" : s.target} {s.percent >= 0 ? "+" : ""}
                    {s.percent}%
                  </span>
                  <span className="text-ink-dim">{s.reason}</span>
                  <button
                    onClick={() => removeScenario(s.id)}
                    className="cursor-pointer text-ink-faint hover:text-ink"
                    aria-label={`Remove scenario ${s.reason}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  // Keep the lifetime payout counter — that money is already real.
                  setSim((s) => ({ ...snapshot(), creditedCents: s.creditedCents }));
                  push("Sandbox reset from your real portfolio.", "info");
                }}
              >
                {needsSnapshot ? "Start from my real portfolio" : "Reset sandbox"}
              </Button>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setSim((s) => ({
                    ...EMPTY_SIM,
                    scenarios: s.scenarios,
                    creditedCents: s.creditedCents,
                  }));
                  push("Sandbox cleared.", "info");
                }}
              >
                Clear everything
              </Button>
            </div>
          </div>
        </Card>

        {/* Sandbox positions */}
        <Card>
          <SectionTitle
            title="Chaos Lab portfolio"
            action={
              <span className="text-xs text-ink-faint">
                cash {formatCad(sim.cashCents / 100)}
              </span>
            }
          />
          {needsSnapshot ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-2" aria-hidden>
                🧪
              </p>
              <p className="font-semibold">Your sandbox is empty</p>
              <p className="text-sm text-ink-dim mt-1">
                Start from a copy of your real portfolio, then bend prices however you like.
              </p>
              <Button
                className="mt-4"
                onClick={() =>
                  setSim((s) => ({ ...snapshot(), creditedCents: s.creditedCents }))
                }
              >
                Clone my portfolio
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {sim.positions.length === 0 && (
                <p className="text-sm text-ink-dim py-4 text-center">
                  No positions in this sandbox yet.
                </p>
              )}
              {sim.positions.map((pos) => {
                const price = simPrice(pos.symbol);
                const value = positionValueCents(pos, price);
                const cost = positionCostCents(pos);
                const pl = value - cost;
                const factor = sim.scenarios.length
                  ? price / (realPriceCents[pos.symbol] || price)
                  : 1;
                return (
                  <PositionRow
                    key={pos.symbol}
                    pos={pos}
                    price={price}
                    realPrice={realPriceCents[pos.symbol] ?? price}
                    value={value}
                    pl={pl}
                    factor={factor}
                    onBuy={() => setTradeFor({ symbol: pos.symbol, side: "BUY" })}
                    onSell={() => setTradeFor({ symbol: pos.symbol, side: "SELL" })}
                  />
                );
              })}

              <div className="pt-2 flex flex-wrap gap-1.5">
                <QuickSandboxPick
                  quotes={quotes}
                  sim={sim}
                  onPick={(symbol) => setTradeFor({ symbol, side: "BUY" })}
                />
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Sandbox log */}
      <Card>
        <SectionTitle title="Chaos Lab activity" />
        {sim.log.length === 0 ? (
          <p className="text-sm text-ink-dim py-4 text-center">
            Sandbox trades will show up here — with the profit each one pays out.
          </p>
        ) : (
          <ul className="divide-y divide-edge-soft">
            {sim.log.map((entry) => (
              <li key={entry.id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm">{entry.text}</p>
                  <p className="text-xs text-ink-faint">
                    {new Date(entry.at).toLocaleString("en-CA")}
                  </p>
                </div>
                {entry.amountCents !== null && (
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      entry.amountCents >= 0 ? "text-up" : "text-ink",
                    )}
                  >
                    {entry.amountCents >= 0 ? "+" : "−"}
                    {formatCad(Math.abs(entry.amountCents) / 100)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {tradeFor && (
        <SimTradeModal
          symbol={tradeFor.symbol}
          side={tradeFor.side}
          priceCents={simPrice(tradeFor.symbol)}
          realPriceCents={realPriceCents[tradeFor.symbol] ?? simPrice(tradeFor.symbol)}
          sim={sim}
          onClose={() => setTradeFor(null)}
          onChange={(next) => setSim(next)}
          onCredited={(cents) =>
            setSim((s) => ({ ...s, creditedCents: s.creditedCents + cents }))
          }
          onQueryInvalidate={() => {
            queryClient.invalidateQueries({ queryKey: ["portfolio"] });
            queryClient.invalidateQueries({ queryKey: ["wallet"] });
            queryClient.invalidateQueries({ queryKey: ["activity"] });
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
          }}
        />
      )}
    </div>
  );
}

function PositionRow({
  pos,
  price,
  realPrice,
  value,
  pl,
  factor,
  onBuy,
  onSell,
}: {
  pos: SimPosition;
  price: number;
  realPrice: number;
  value: number;
  pl: number;
  factor: number;
  onBuy: () => void;
  onSell: () => void;
}) {
  return (
    <div className="rounded-xl border border-edge-soft p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-sm">{pos.symbol}</p>
          <p className="text-xs text-ink-faint">
            {fromMicro(pos.shares).toFixed(4).replace(/\.?0+$/, "")} shares · avg $
            {(pos.avgCostCents / 100).toFixed(2)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums">${(value / 100).toFixed(2)}</p>
          <Delta value={(pl / 100).toFixed(2)} className="text-xs" />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="text-ink-faint">
          sandbox ${(price / 100).toFixed(2)}
          {factor !== 1 && (
            <span className={factor > 1 ? "text-up" : "text-down"}>
              {" "}
              ({factor > 1 ? "+" : ""}
              {((factor - 1) * 100).toFixed(0)}% scenario)
            </span>
          )}{" "}
          · real ${(realPrice / 100).toFixed(2)}
        </span>
        <span className="flex gap-1.5">
          <Button size="sm" variant="secondary" onClick={onBuy}>
            Sim buy
          </Button>
          <Button size="sm" variant="danger" onClick={onSell}>
            Sim sell
          </Button>
        </span>
      </div>
    </div>
  );
}

function QuickSandboxPick({
  quotes,
  sim,
  onPick,
}: {
  quotes: Quote[];
  sim: SimState;
  onPick: (symbol: string) => void;
}) {
  const owned = new Set(sim.positions.map((p) => p.symbol));
  const picks = quotes
    .filter((q) => ["AAPL", "NVDA", "BTC", "SPY", "GOLD", "AADIDEV", "MAYHEM"].includes(q.symbol))
    .filter((q) => !owned.has(q.symbol))
    .slice(0, 7);
  if (picks.length === 0) return null;
  return (
    <>
      <span className="text-xs text-ink-faint self-center">Simulate a new position:</span>
      {picks.map((q) => (
        <button
          key={q.symbol}
          onClick={() => onPick(q.symbol)}
          className="rounded-full border border-edge px-3 py-1 text-xs cursor-pointer hover:bg-card-hover"
        >
          {q.symbol} ${q.price}
        </button>
      ))}
    </>
  );
}

function SimTradeModal({
  symbol,
  side,
  priceCents,
  realPriceCents,
  sim,
  onClose,
  onChange,
  onCredited,
  onQueryInvalidate,
}: {
  symbol: string;
  side: "BUY" | "SELL";
  priceCents: number;
  realPriceCents: number;
  sim: SimState;
  onClose: () => void;
  onChange: (next: SimState) => void;
  onCredited: (cents: number) => void;
  onQueryInvalidate: () => void;
}) {
  const { push } = useToast();
  const [qty, setQty] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const position = sim.positions.find((p) => p.symbol === symbol);
  const owned = position ? fromMicro(position.shares) : 0;
  const q = Number(qty) || 0;
  const total = Math.round((priceCents * toMicro(q)) / 1_000_000);

  const submit = async () => {
    setError(null);
    if (side === "BUY") {
      const { state, error: err } = simBuy(sim, symbol, q, priceCents);
      if (err) return setError(err);
      onChange(state);
      push(`Simulated buy: ${q} ${symbol} in your sandbox.`, "success");
      onClose();
      return;
    }

    const outcome = simSell(sim, symbol, q, priceCents);
    if (outcome.error) return setError(outcome.error);
    onChange(outcome.state);

    if (outcome.realizedCents <= 0) {
      push(
        "Sandbox sale done — no profit, so nothing is credited. Losses stay in the sandbox.",
        "info",
      );
      onClose();
      return;
    }

    setBusy(true);
    try {
      const res = await api.post<{ credited: string; note: string; capped: boolean }>(
        "/api/simulation/payout",
        {
          symbol,
          quantity: outcome.quantity,
          salePrice: outcome.salePrice,
          costBasis: outcome.costBasis,
        },
      );
      const cents = Math.round(Number(res.credited) * 100);
      onCredited(cents);
      onQueryInvalidate();
      push(
        cents > 0
          ? `💸 Sandbox profit paid out: ${formatCad(cents / 100)} added to your real Investment Account.`
          : res.note,
        cents > 0 ? "success" : "info",
      );
      onClose();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Payout failed.");
      // The sandbox trade itself already happened locally.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Sandbox ${side === "BUY" ? "buy" : "sell"} · ${symbol}`}>
      <div className="space-y-4">
        <div className="card !bg-bg-soft p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-ink-dim">Sandbox price</span>
            <span className="font-semibold tabular-nums">${(priceCents / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-dim">Real price right now</span>
            <span className="tabular-nums text-ink-faint">
              ${(realPriceCents / 100).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-dim">{side === "BUY" ? "Sandbox cash" : "Shares owned"}</span>
            <span className="tabular-nums">
              {side === "BUY" ? formatCad(sim.cashCents / 100) : owned}
            </span>
          </div>
        </div>

        <div>
          <label className="label">Quantity</label>
          <QuantityStepper value={qty} onChange={setQty} />
          {side === "SELL" && (
            <div className="mt-2 flex gap-1.5">
              {[
                ["25%", 0.25],
                ["50%", 0.5],
                ["All", 1],
              ].map(([label, frac]) => (
                <Button
                  key={label as string}
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setQty(String(Math.floor(owned * (frac as number) * 1e6) / 1e6))
                  }
                >
                  {label as string}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="card !bg-bg-soft p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-dim">
              {side === "BUY" ? "Sandbox cost" : "Sandbox proceeds"}
            </span>
            <span className="font-semibold tabular-nums">${(total / 100).toFixed(2)}</span>
          </div>
          {side === "SELL" && position && (
            <div className="flex justify-between mt-1">
              <span className="text-ink-dim">Profit paid to your real account</span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  total - Math.round((position.avgCostCents * toMicro(q)) / 1_000_000) >= 0
                    ? "text-up"
                    : "text-down",
                )}
              >
                $
                {(
                  (total - Math.round((position.avgCostCents * toMicro(q)) / 1_000_000)) /
                  100
                ).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-down">{error}</p>}

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            variant={side === "SELL" ? "danger" : "primary"}
            disabled={q <= 0 || busy || (side === "SELL" && q > owned)}
            onClick={submit}
          >
            {busy ? "Paying out…" : side === "BUY" ? "Simulate buy" : "Simulate sell"}
          </Button>
        </div>
        <p className="text-xs text-ink-faint">
          Sandbox trades never touch the shared market. Only profit from a profitable sale is
          credited to your real Investment Account.
        </p>
      </div>
    </Modal>
  );
}
