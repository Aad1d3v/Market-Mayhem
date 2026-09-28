import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { formatDateTime } from "../lib/format.js";
import { cn } from "../lib/utils.js";
import { Card, ErrorState, SimulatedBadge, Skeleton } from "../components/ui.js";
import type { MarketStateView, NewsView, SectorHeatRow } from "@aadiinvest/shared";

const CATEGORIES = [
  { key: "ALL", label: "All news" },
  { key: "MACRO", label: "Economy" },
  { key: "EARNINGS", label: "Earnings" },
  { key: "SECTOR", label: "Sectors" },
  { key: "ANALYST", label: "Analysts" },
  { key: "PRODUCT", label: "Products" },
  { key: "MANAGEMENT", label: "Management" },
  { key: "LEGAL", label: "Legal" },
  { key: "DIVIDEND", label: "Dividends" },
  { key: "CRISIS", label: "Breaking" },
] as const;

function sentimentClass(s: NewsView["sentiment"]): string {
  return s === "POSITIVE"
    ? "bg-up-soft text-up border border-up/25"
    : s === "NEGATIVE"
      ? "bg-down-soft text-down border border-down/25"
      : "bg-card-hover text-ink-dim border border-edge";
}

function severityBadge(severity: number) {
  const abs = Math.abs(severity);
  if (abs >= 3) return { text: "MAJOR", cls: "bg-down text-white" };
  if (abs >= 2) return { text: "HIGH", cls: "bg-warn/20 text-warn border border-warn/30" };
  if (abs >= 1) return { text: "NOTE", cls: "bg-card-hover text-ink-dim border border-edge" };
  return null;
}

function NewsCard({ item }: { item: NewsView }) {
  const badge = severityBadge(item.severity);
  return (
    <Card className="!p-4 hover:border-edge transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className={cn("badge !text-[10px]", sentimentClass(item.sentiment))}>
              {item.sentiment}
            </span>
            <span className="badge !text-[10px] bg-brand/10 text-brand-strong border border-brand/20">
              {item.category}
            </span>
            {badge && (
              <span className={cn("badge !text-[10px] font-bold", badge.cls)}>{badge.text}</span>
            )}
          </div>
          <h3 className="font-semibold text-[15px] leading-snug">{item.headline}</h3>
          <p className="text-sm text-ink-dim mt-1.5 leading-relaxed">{item.summary}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2.5 text-xs text-ink-faint">
            <span>{item.source}</span>
            <span>·</span>
            <span>{formatDateTime(item.publishedAt)}</span>
            {item.symbols.map((s) => (
              <Link
                key={s}
                to={`/stocks/${s}`}
                className="font-semibold text-brand-strong hover:underline"
              >
                ${s}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function MarketStateBanner({ state }: { state: MarketStateView }) {
  const mood = state.sentiment >= 0 ? "text-up" : "text-down";
  const pct = Math.round(state.sentiment * 100);
  return (
    <Card className="!p-4 flex flex-wrap items-center gap-4">
      <span className="text-3xl" aria-hidden>{state.regimeEmoji}</span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">
          {state.regimeLabel}
          <span className="ml-2 text-xs font-normal text-ink-dim">{state.regimeBlurb}</span>
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-2 w-40 rounded-full bg-bg-soft border border-edge-soft overflow-hidden">
            <div
              className={cn("h-full rounded-full", pct >= 0 ? "bg-up" : "bg-down")}
              style={{ width: `${Math.abs(pct)}%`, marginLeft: pct >= 0 ? "50%" : `${50 - Math.abs(pct)}%` }}
            />
          </div>
          <span className={cn("text-xs font-semibold tabular-nums", mood)}>
            Sentiment {pct >= 0 ? "+" : ""}{pct}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center text-xs">
        <div>
          <p className="text-ink-faint">Index</p>
          <p className={cn("font-bold tabular-nums", state.indexChangePercent >= 0 ? "text-up" : "text-down")}>
            {state.indexChangePercent >= 0 ? "+" : ""}{state.indexChangePercent}%
          </p>
        </div>
        <div>
          <p className="text-ink-faint">Breadth</p>
          <p className="font-bold tabular-nums">{Math.round(state.breadth * 100)}% up</p>
        </div>
        <div>
          <p className="text-ink-faint">Sectors</p>
          <p className="font-bold tabular-nums">
            <span className="text-up">{state.sectorsUp}</span>
            {" / "}
            <span className="text-down">{state.sectorsDown}</span>
          </p>
        </div>
      </div>
    </Card>
  );
}

function Heatmap({ rows }: { rows: SectorHeatRow[] }) {
  const top = rows.slice(0, 8);
  return (
    <Card className="!p-4">
      <h2 className="font-semibold mb-2.5">Sector heat — today</h2>
      <div className="space-y-1.5">
        {top.map((r) => (
          <div key={r.sector} className="flex items-center gap-2 text-sm">
            <span className="w-44 shrink-0 truncate text-ink-dim">{r.sector}</span>
            <div className="flex-1 h-2 rounded-full bg-bg-soft border border-edge-soft relative overflow-hidden">
              <div
                className={cn("absolute top-0 h-full", r.changePercent >= 0 ? "bg-up/70" : "bg-down/70")}
                style={{
                  width: `${Math.min(50, Math.abs(r.changePercent) * 10)}%`,
                  left: r.changePercent >= 0 ? "50%" : undefined,
                  right: r.changePercent < 0 ? "50%" : undefined,
                }}
              />
            </div>
            <span className={cn("w-16 text-right tabular-nums font-semibold", r.changePercent >= 0 ? "text-up" : "text-down")}>
              {r.changePercent >= 0 ? "+" : ""}{r.changePercent}%
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function NewsPage() {
  const [category, setCategory] = useState<string>("ALL");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["news-feed", category],
    queryFn: () =>
      api.get<{ items: NewsView[]; label: string }>(
        `/api/markets/news?category=${encodeURIComponent(category)}`,
      ),
    refetchInterval: 60_000,
  });

  const { data: stateData } = useQuery({
    queryKey: ["market-state"],
    queryFn: () =>
      api.get<{ state: MarketStateView; heatmap: SectorHeatRow[] }>("/api/markets/state"),
    refetchInterval: 60_000,
  });

  const items = useMemo(() => data?.items ?? [], [data]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <ErrorState
        message="The news wire is temporarily unavailable — try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">📰 Market News</h1>
          <p className="text-sm text-ink-dim mt-0.5">
            The simulated wire — read it, then decide. Stories react to what is actually moving.
          </p>
        </div>
        <SimulatedBadge />
      </header>

      {stateData?.state && <MarketStateBanner state={stateData.state} />}

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors",
              category === c.key
                ? "bg-brand/15 text-brand-strong"
                : "text-ink-dim hover:text-ink hover:bg-card-hover",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-3">
          {items.length === 0 && (
            <Card className="!p-10 text-center text-ink-dim">
              No stories in this category right now.
            </Card>
          )}
          {items.map((n) => (
            <NewsCard key={n.id} item={n} />
          ))}
        </div>
        <div className="space-y-4 lg:sticky lg:top-20">
          {stateData?.heatmap && <Heatmap rows={stateData.heatmap} />}
          <Card className="!p-4 text-xs text-ink-faint leading-relaxed">
            Every story on this wire is fictional and generated for education. Headlines describe
            moves that the simulation is actually producing — but no real company said or did any
            of this.
          </Card>
        </div>
      </div>
    </div>
  );
}
