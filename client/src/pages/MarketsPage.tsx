import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMarkets } from "../components/StockHooks.js";
import EventBanner from "../components/EventBanner.js";
import {
  Button,
  Card,
  Delta,
  ErrorState,
  SimulatedBadge,
  Skeleton,
  StatusDot,
} from "../components/ui.js";
import { cn } from "../lib/utils.js";
import type { Quote } from "@aadiinvest/shared";

type Tab =
  | "All"
  | "Stocks"
  | "ETFs"
  | "Crypto"
  | "Commodities"
  | "Bonds"
  | "AadiVerse"
  | "Top Gainers"
  | "Top Losers";

const TABS: Tab[] = [
  "All",
  "Stocks",
  "ETFs",
  "Crypto",
  "Commodities",
  "Bonds",
  "AadiVerse",
  "Top Gainers",
  "Top Losers",
];

const CLASS_PILL: Record<string, string> = {
  STOCK: "bg-brand/10 text-brand-strong border border-brand/20",
  ETF: "bg-card-hover text-ink border border-edge",
  CRYPTO: "bg-warn/10 text-warn border border-warn/20",
  COMMODITY: "bg-up-soft text-up border border-up/20",
  BOND: "bg-down-soft text-down border border-down/20",
};

function matchesTab(q: Quote, tab: Tab): boolean {
  switch (tab) {
    case "Stocks":
      return q.assetClass === "STOCK" && q.market !== "AADI";
    case "ETFs":
      return q.assetClass === "ETF";
    case "Crypto":
      return q.assetClass === "CRYPTO";
    case "Commodities":
      return q.assetClass === "COMMODITY";
    case "Bonds":
      return q.assetClass === "BOND";
    case "AadiVerse":
      return q.market === "AADI";
    default:
      return true;
  }
}

export default function MarketsPage() {
  const [tab, setTab] = useState<Tab>("All");
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("ALL");
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useMarkets();

  const quotes = useMemo(() => data?.quotes ?? [], [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = quotes.filter((r) => matchesTab(r, tab));
    if (sector !== "ALL") list = list.filter((r) => r.sector === sector);
    if (q) {
      list = list.filter(
        (r) =>
          r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
      );
    }
    if (tab === "Top Gainers") {
      list = [...list].sort((a, b) => Number(b.changePercent) - Number(a.changePercent));
    } else if (tab === "Top Losers") {
      list = [...list].sort((a, b) => Number(a.changePercent) - Number(b.changePercent));
    }
    return tab === "Top Gainers" || tab === "Top Losers" ? list.slice(0, 20) : list;
  }, [quotes, tab, query, sector]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <ErrorState
        message="Market data temporarily unavailable. Showing nothing right now — try again."
        onRetry={() => refetch()}
      />
    );
  }

  // Tapping a listing opens its own page — buy/sell buttons live there.
  const openDetail = (symbol: string) =>
    navigate(`/stocks/${encodeURIComponent(symbol)}`);
  const openTrade = (symbol: string) =>
    navigate(`/trade?symbol=${encodeURIComponent(symbol)}&side=BUY`);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Markets</h1>
          <p className="text-sm text-ink-dim mt-0.5">
            {quotes.length} simulated listings across stocks, funds, crypto, commodities and bonds ·
            all prices in CAD
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusDot open={data.status.isOpen} />
          <SimulatedBadge />
        </div>
      </header>

      {/* Scenario events: crashes, rallies, frenzies */}
      <EventBanner events={data.events} upcoming={data.upcoming} />

      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors",
              tab === t
                ? "bg-brand/15 text-brand-strong"
                : "text-ink-dim hover:text-ink hover:bg-card-hover",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name or symbol…"
          className="input max-w-xs"
          aria-label="Filter listings"
        />
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="input max-w-52"
          aria-label="Filter by category"
        >
          <option value="ALL">Every category</option>
          {data.sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-faint">
          Tap any listing to open its page — or hit Buy to go straight to the order ticket.
        </span>
      </div>

      {/* Table (desktop) / cards (mobile) */}
      <Card className="!p-0 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-faint border-b border-edge-soft">
                <th className="px-5 py-3">Symbol</th>
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3 text-right">Price</th>
                <th className="px-5 py-3 text-right">Change %</th>
                <th className="px-5 py-3 text-right">Order</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr
                  key={q.symbol}
                  onClick={() => openDetail(q.symbol)}
                  className="border-b border-edge-soft last:border-0 hover:bg-card-hover/60 cursor-pointer"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{q.symbol}</span>
                      <span className={cn("badge !text-[10px]", CLASS_PILL[q.assetClass])}>
                        {q.assetClass}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-ink-dim">
                    {q.name}
                    {q.event && (
                      <span className="ml-2 badge bg-down/10 text-down border border-down/20 !text-[10px]">
                        {q.event.severity === "crash" ? "💥" : "⚡"} {q.event.name}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-ink-faint">{q.sector}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums">${q.price}</td>
                  <td className="px-5 py-3.5 text-right">
                    <Delta value={q.changePercent} className="text-xs" />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/stocks/${encodeURIComponent(q.symbol)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-ink-faint hover:text-ink"
                      >
                        Details
                      </Link>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openTrade(q.symbol);
                        }}
                      >
                        Buy
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-ink-dim">
                    Nothing matches that filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="md:hidden divide-y divide-edge-soft">
          {rows.map((q) => (
            <button
              key={q.symbol}
              onClick={() => openDetail(q.symbol)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
            >
              <div className="min-w-0">
                <p className="font-bold text-sm">
                  {q.symbol}{" "}
                  <span className={cn("badge !text-[10px]", CLASS_PILL[q.assetClass])}>
                    {q.assetClass}
                  </span>
                </p>
                <p className="text-xs text-ink-faint truncate max-w-40">{q.name}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm tabular-nums">${q.price}</p>
                <Delta value={q.changePercent} className="text-xs" />
              </div>
            </button>
          ))}
          {rows.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-ink-dim">
              Nothing matches that filter.
            </p>
          )}
        </div>
      </Card>

      <p className="text-xs text-ink-faint">{data.disclosure}</p>
    </div>
  );
}
