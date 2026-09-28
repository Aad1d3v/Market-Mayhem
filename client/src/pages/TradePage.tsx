import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import {
  useHistory,
  useMarkets,
  usePortfolio,
  useStock,
  TIMEFRAMES,
  TIMEFRAME_SPAN_DAYS,
  type Timeframe,
} from "../components/StockHooks.js";
import {
  Button,
  Card,
  Delta,
  EmptyState,
  SimulatedBadge,
  Skeleton,
  useToast,
} from "../components/ui.js";
import { PriceChart } from "../components/charts.js";
import TradeModal from "../components/TradeModal.js";
import { cn } from "../lib/utils.js";
import type { Quote, WatchlistItemView } from "@aadiinvest/shared";

const QUICK_PICKS = [
  "AAPL",
  "NVDA",
  "TSLA",
  "BTC",
  "SPY",
  "GOLD",
  "AADIDEV",
  "MAYHEM",
];

/** Category filter for the full listing picker. */
const PICKER_FILTERS = [
  { key: "ALL", label: "Everything" },
  { key: "STOCK", label: "Stocks" },
  { key: "ETF", label: "ETFs & Funds" },
  { key: "CRYPTO", label: "Crypto" },
  { key: "COMMODITY", label: "Commodities" },
  { key: "BOND", label: "Bonds" },
  { key: "AADI", label: "AadiVerse" },
] as const;
type PickerFilter = (typeof PICKER_FILTERS)[number]["key"];

/**
 * Searchable picker over every tradable listing. Stays on this page so the
 * user can browse the whole catalogue and drop any of it into the ticket.
 */
function ListingPicker({
  quotes,
  selected,
  onPick,
}: {
  quotes: Quote[];
  selected: string;
  onPick: (symbol: string) => void;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<PickerFilter>("ALL");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = quotes;
    if (filter === "AADI") list = list.filter((r) => r.market === "AADI");
    else if (filter !== "ALL") list = list.filter((r) => r.assetClass === filter);
    if (needle) {
      list = list.filter(
        (r) =>
          r.symbol.toLowerCase().includes(needle) ||
          r.name.toLowerCase().includes(needle) ||
          r.sector.toLowerCase().includes(needle),
      );
    }
    return list.slice(0, 60);
  }, [quotes, q, filter]);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search all 300+ listings — name, symbol or category…"
        className="input"
        aria-label="Search listings"
      />
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {PICKER_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap cursor-pointer transition-colors",
              filter === f.key
                ? "border-brand bg-brand/15 text-brand-strong"
                : "border-edge text-ink-dim hover:text-ink hover:bg-card-hover",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-edge-soft divide-y divide-edge-soft">
        {rows.map((r) => (
          <button
            key={r.symbol}
            onClick={() => onPick(r.symbol)}
            className={cn(
              "w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left cursor-pointer transition-colors",
              r.symbol === selected ? "bg-brand/10" : "hover:bg-card-hover",
            )}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {r.symbol}
                <span className="ml-2 text-xs font-normal text-ink-faint truncate">{r.name}</span>
              </p>
              <p className="text-[11px] text-ink-faint">{r.sector}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm tabular-nums">${r.price}</p>
              <Delta value={r.changePercent} className="text-xs" />
            </div>
          </button>
        ))}
        {rows.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-ink-dim">
            Nothing matches that search.
          </p>
        )}
      </div>
    </div>
  );
}

export default function TradePage() {
  const [params, setParams] = useSearchParams();
  const symbol = (params.get("symbol") ?? "").toUpperCase();
  const urlSide = params.get("side")?.toUpperCase() === "SELL" ? "SELL" : "BUY";

  const [side, setSide] = useState<"BUY" | "SELL">(urlSide);
  const [qty, setQty] = useState("1");
  const [modalOpen, setModalOpen] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>("1M");
  const { push } = useToast();
  const queryClient = useQueryClient();

  // Keep the ticket in sync when a link (markets row, watchlist…) picks a side.
  useEffect(() => setSide(urlSide), [urlSide, symbol]);
  useEffect(() => setQty("1"), [symbol]);

  const { data: stock, isLoading } = useStock(symbol || undefined);
  const history = useHistory(symbol || undefined, timeframe);
  const { data: portfolio } = usePortfolio();
  const { data: markets } = useMarkets();

  const holding = (portfolio?.holdings ?? []).find((h) => h.symbol === symbol);
  const quote = stock?.quote;
  const price = quote ? Number(quote.price) : 0;
  const q = Number(qty) || 0;
  const estimated = q * price;
  const cash = Number(portfolio?.investmentCash ?? 0);
  const owned = Number(holding?.shares ?? 0);
  const maxBuy = price > 0 ? Math.floor((cash / price) * 1e6) / 1e6 : 0;
  const cashAfter = side === "BUY" ? cash - estimated : cash + estimated;
  const asMoney = (n: number) =>
    n < 0 ? `-$${Math.abs(n).toFixed(2)}` : `$${n.toFixed(2)}`;

  const quotes = useMemo(() => markets?.quotes ?? [], [markets]);

  const quickQuotes = useMemo(
    () =>
      QUICK_PICKS.map((s) => markets?.quotes.find((x) => x.symbol === s)).filter(
        (x): x is NonNullable<typeof x> => Boolean(x),
      ),
    [markets],
  );

  const movers = useMemo(
    () => [
      ...(markets?.movers.gainers ?? []).slice(0, 3),
      ...(markets?.movers.losers ?? []).slice(0, 2),
    ],
    [markets],
  );

  const pick = (s: string, nextSide: "BUY" | "SELL" = "BUY") => {
    setParams({ symbol: s, side: nextSide });
  };

  const setPercent = (pct: number) => {
    if (side === "BUY") {
      setQty(String(Math.max(0, Math.floor(maxBuy * pct * 1e6) / 1e6)));
    } else {
      setQty(String(Math.max(0, Math.floor(owned * pct * 1e6) / 1e6)));
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Buy &amp; Sell</h1>
          <p className="text-sm text-ink-dim mt-0.5">
            Pick anything the game lets you own — stocks, funds, crypto, commodities, bonds — then
            choose your side, size and order.
          </p>
        </div>
        <SimulatedBadge />
      </header>

      <div className="grid lg:grid-cols-3 gap-3">
        {/* Left: picker + chart */}
        <div className="lg:col-span-2 space-y-3">
          <Card>
            <label className="label">Find a listing</label>
            <ListingPicker quotes={quotes} selected={symbol} onPick={(s) => pick(s)} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {quickQuotes.map((qp) => (
                <button
                  key={qp.symbol}
                  onClick={() => pick(qp.symbol)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold cursor-pointer transition-colors",
                    qp.symbol === symbol
                      ? "border-brand bg-brand/15 text-brand-strong"
                      : "border-edge text-ink-dim hover:text-ink hover:bg-card-hover",
                  )}
                >
                  {qp.symbol} ${qp.price}
                </button>
              ))}
            </div>
            {movers.length > 0 && (
              <>
                <p className="label mt-4 mb-1.5">What's moving right now</p>
                <div className="flex flex-wrap gap-1.5">
                  {movers.map((m) => (
                    <button
                      key={m.symbol}
                      onClick={() => pick(m.symbol)}
                      className="rounded-full border border-edge px-3 py-1 text-xs cursor-pointer hover:bg-card-hover"
                    >
                      <span className="font-semibold">{m.symbol}</span>{" "}
                      <Delta value={m.changePercent} className="text-[11px]" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </Card>

          {symbol && isLoading && <Skeleton className="h-24" />}

          {symbol && quote && (
            <Card>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold">{quote.symbol}</p>
                    <span className="badge bg-card-hover text-ink border border-edge">
                      {quote.assetClass}
                    </span>
                  </div>
                  <p className="text-xs text-ink-dim">
                    {quote.name} · {quote.exchange}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tabular-nums">${quote.price}</p>
                  <Delta value={quote.changePercent} className="text-sm" />
                </div>
              </div>

              {quote.event && (
                <div
                  className={cn(
                    "mt-3 rounded-xl border px-3.5 py-2.5 text-xs",
                    quote.event.severity === "crash"
                      ? "border-down/40 bg-down-soft"
                      : "border-up/40 bg-up-soft",
                  )}
                >
                  <span className="font-semibold">
                    {quote.event.severity === "crash" ? "💥" : "⚡"} {quote.event.name}
                  </span>{" "}
                  is moving {quote.symbol} right now (
                  {quote.event.percentChange >= 0 ? "+" : ""}
                  {quote.event.percentChange.toFixed(1)}%): {quote.event.headline}
                </div>
              )}

              <Link
                to={`/stocks/${quote.symbol}`}
                className="inline-block mt-3 text-xs text-brand-strong hover:underline"
              >
                Full company page, news and fundamentals →
              </Link>
            </Card>
          )}

          <Card>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Chart</h2>
              <div className="flex gap-1">
                {TIMEFRAMES.slice(0, 5).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={
                      tf === timeframe
                        ? "px-2.5 py-1 rounded-lg text-xs font-semibold bg-brand/15 text-brand-strong cursor-pointer"
                        : "px-2.5 py-1 rounded-lg text-xs font-semibold text-ink-faint hover:text-ink cursor-pointer"
                    }
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            {symbol && history.data && history.data.candles.length > 0 ? (
              <PriceChart
                data={history.data.candles.map((c) => ({ time: c.time, close: c.close }))}
                spanDays={TIMEFRAME_SPAN_DAYS[timeframe]}
                height={240}
              />
            ) : (
              <p className="text-sm text-ink-dim py-12 text-center">
                {symbol ? "Loading chart…" : "Pick a listing to see its simulated chart."}
              </p>
            )}
          </Card>
        </div>

        {/* Right: order ticket */}
        <div className="space-y-3">
          <Card className="h-fit">
            <h2 className="font-semibold mb-3">Order ticket</h2>
            {!symbol ? (
              <EmptyState
                icon="🧾"
                title="No listing selected"
                hint="Choose anything above — from a company to a crypto coin — and this ticket fills itself in."
              />
            ) : !quote ? (
              <p className="text-sm text-ink-dim py-6 text-center">
                {isLoading ? "Loading listing…" : "That listing could not be found."}
              </p>
            ) : (
              <div className="space-y-4">
                {/* Side toggle */}
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-bg-soft border border-edge-soft">
                  {(["BUY", "SELL"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSide(s)}
                      className={
                        side === s
                          ? s === "BUY"
                            ? "rounded-lg py-2 text-sm font-bold bg-up/15 text-up cursor-pointer"
                            : "rounded-lg py-2 text-sm font-bold bg-down/15 text-down cursor-pointer"
                          : "rounded-lg py-2 text-sm font-medium text-ink-faint hover:text-ink cursor-pointer"
                      }
                    >
                      {s === "BUY" ? "Buy" : "Sell"}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="label">Quantity (shares)</label>
                  <input
                    className="input text-center text-lg"
                    inputMode="decimal"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    aria-label="Quantity"
                  />
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {[1, 5, 10].map((n) => (
                      <Button
                        key={n}
                        size="sm"
                        variant="secondary"
                        onClick={() => setQty(String(n))}
                      >
                        {n}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setQty(side === "BUY" ? String(maxBuy) : String(owned))}
                    >
                      Max
                    </Button>
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    {[
                      ["25%", 0.25],
                      ["50%", 0.5],
                      ["100%", 1],
                    ].map(([label, frac]) => (
                      <Button
                        key={label as string}
                        size="sm"
                        variant="ghost"
                        onClick={() => setPercent(frac as number)}
                      >
                        {label as string} {side === "BUY" ? "of cash" : "of holdings"}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="card !bg-bg-soft p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-dim">Order type</span>
                    <span className="font-semibold">Market ({quote.assetClass})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-dim">Price per share</span>
                    <span className="tabular-nums">${quote.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-dim">Estimated total</span>
                    <span className="font-semibold tabular-nums">${estimated.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-edge-soft pt-1.5">
                    <span className="text-ink-dim">
                      {side === "BUY" ? "Cash after order" : "Cash after sale"}
                    </span>
                    <span className={cn("tabular-nums", cashAfter < 0 && "text-down")}>
                      {asMoney(cashAfter)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-dim">
                      {side === "BUY" ? "Available cash" : "Shares owned"}
                    </span>
                    <span className="tabular-nums">
                      {side === "BUY" ? `$${cash.toFixed(2)}` : owned}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  variant={side === "SELL" ? "danger" : "primary"}
                  onClick={() => setModalOpen(true)}
                  disabled={
                    q <= 0 ||
                    (side === "SELL" && (!holding || q > owned)) ||
                    (side === "BUY" && estimated > cash)
                  }
                >
                  Review {side === "BUY" ? "Buy" : "Sell"} Order
                </Button>

                {side === "SELL" && !holding && (
                  <p className="text-xs text-ink-faint text-center">
                    You don't own {symbol} yet — switch to Buy first.
                  </p>
                )}
                {side === "BUY" && estimated > cash && (
                  <p className="text-xs text-down text-center">
                    That costs ${(estimated - cash).toFixed(2)} more than your investment cash.
                    Move money over from your Wallet first.
                  </p>
                )}
                <WatchButton symbol={quote.symbol} onDone={() => queryClient.invalidateQueries({ queryKey: ["watchlist"] })} />
              </div>
            )}
          </Card>

          {holding && (
            <Card className="h-fit">
              <h2 className="font-semibold mb-3">Your position</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Stat label="Shares" value={holding.shares} />
                <Stat label="Avg cost" value={`$${holding.averageCost}`} />
                <Stat label="Market value" value={`$${holding.marketValue}`} />
                <Stat label="Unrealized" value={`$${holding.unrealizedPL}`} />
              </div>
            </Card>
          )}
        </div>
      </div>

      {symbol && quote && modalOpen && (
        <TradeModal
          open
          onClose={() => setModalOpen(false)}
          side={side}
          symbol={quote.symbol}
          company={quote.name}
          price={quote.price}
          availableCash={portfolio?.investmentCash}
          ownedShares={holding?.shares}
          averageCost={holding?.averageCost}
          unrealizedPL={holding?.unrealizedPL}
          onDone={() => push("Order submitted.", "success")}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card !bg-bg-soft px-3 py-2">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function WatchButton({ symbol, onDone }: { symbol: string; onDone: () => void }) {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => api.get<{ items: WatchlistItemView[] }>("/api/watchlist"),
  });
  const inList = (data?.items ?? []).some((w) => w.symbol === symbol);

  return (
    <Button
      variant="ghost"
      className="w-full"
      onClick={async () => {
        if (inList) {
          await api.delete(`/api/watchlist/${symbol}`);
          push(`${symbol} removed from watchlist.`, "info");
        } else {
          await api.post("/api/watchlist", { symbol });
          push(`${symbol} added to watchlist.`, "success");
        }
        queryClient.invalidateQueries({ queryKey: ["watchlist"] });
        onDone();
      }}
    >
      {inList ? "★ In watchlist — tap to remove" : "☆ Add to watchlist"}
    </Button>
  );
}
