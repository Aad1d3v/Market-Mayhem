import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth-context.js";
import { greetingFor, formatCad } from "@aadiinvest/shared";
import {
  Button,
  Card,
  Delta,
  EmptyState,
  ErrorState,
  SectionTitle,
  Skeleton,
} from "../components/ui.js";
import { PriceChart } from "../components/charts.js";
import EventBanner from "../components/EventBanner.js";
import { useMarketEvents } from "../components/StockHooks.js";
import type { ActivityItem, DailyChallenge, PortfolioSummary, Quote } from "@aadiinvest/shared";

interface DashboardData {
  user: { username: string; displayName: string | null; level: number; xp: number; avatarColor: string };
  summary: PortfolioSummary;
  movers: { gainers: Quote[]; losers: Quote[] };
  watchlist: string[];
  recentActivity: ActivityItem[];
  learning: { lessonsTotal: number; lessonsCompleted: number; achievementsUnlocked: number };
  dailyChallenge: DailyChallenge;
}

const RANGES = ["1W", "1M", "3M", "6M", "1Y", "ALL"] as const;

export default function DashboardPage() {
  const { user } = useAuth();
  const [range, setRange] = useState<(typeof RANGES)[number]>("1M");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/api/dashboard"),
    refetchInterval: 30_000,
  });

  const { data: marketEvents } = useMarketEvents();

  const { data: history } = useQuery({
    queryKey: ["portfolio-history", range],
    queryFn: () =>
      api.get<{ items: { date: string; value: string }[] }>("/api/portfolio/history"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState message="We couldn't load your dashboard." onRetry={() => refetch()} />;
  }

  const s = data.summary;
  const historyPoints = (history?.items ?? []).map((h) => ({
    time: h.date,
    close: h.value,
  }));
  const hasHistory = historyPoints.length >= 2;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {greetingFor()}, {user?.displayName ?? data.user.username}
          </h1>
          <p className="text-sm text-ink-dim mt-0.5">Here's how your portfolio is doing.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/simulator">
            <Button variant="secondary">🔥 Chaos Lab</Button>
          </Link>
          <Link to="/markets">
            <Button>Buy something</Button>
          </Link>
        </div>
      </header>

      {/* Live scenario events: crashes, rallies, frenzies */}
      <EventBanner events={marketEvents?.events} upcoming={marketEvents?.upcoming} />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="!p-4">
          <p className="text-xs text-ink-dim uppercase tracking-wide">Total Account Value</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{formatCad(Number(s.totalAccountValue))}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-ink-dim uppercase tracking-wide">Today's Change</p>
          <p className="text-xl font-bold tabular-nums mt-1">
            <Delta value={s.todayChange} />
          </p>
          <p className="text-xs text-ink-faint">{s.todayChangePercent}%</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-ink-dim uppercase tracking-wide">Total Return</p>
          <p className="text-xl font-bold tabular-nums mt-1">
            <Delta value={s.totalReturn} />
          </p>
          <p className="text-xs text-ink-faint">{s.totalReturnPercent}%</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-ink-dim uppercase tracking-wide">Available Cash</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{formatCad(Number(s.investmentCash))}</p>
          <p className="text-xs text-ink-faint">Investment account</p>
        </Card>
        <Card className="!p-4 col-span-2 lg:col-span-1">
          <p className="text-xs text-ink-dim uppercase tracking-wide">Wallet</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{formatCad(Number(s.walletBalance))}</p>
          <Link to="/wallet" className="text-xs text-brand-strong hover:underline">
            Manage →
          </Link>
        </Card>
      </div>

      {/* Portfolio chart */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Portfolio value</h2>
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={
                  r === range
                    ? "px-2.5 py-1 rounded-lg text-xs font-semibold bg-brand/15 text-brand-strong cursor-pointer"
                    : "px-2.5 py-1 rounded-lg text-xs font-semibold text-ink-faint hover:text-ink cursor-pointer"
                }
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        {hasHistory ? (
          <PriceChart
            data={historyPoints}
            spanDays={range === "ALL" ? 3650 : range === "1Y" ? 365 : range === "6M" ? 182 : range === "3M" ? 90 : range === "1M" ? 30 : 7}
            height={260}
          />
        ) : (
          <EmptyState
            icon="📈"
            title="Your portfolio history will appear after you start trading."
            hint="Snapshots are recorded daily — and your first trade starts the story."
            action={
              <Link to="/markets">
                <Button variant="secondary">Explore Markets</Button>
              </Link>
            }
          />
        )}
      </Card>

      <div className="grid lg:grid-cols-3 gap-3">
        {/* Market movers */}
        <Card>
          <SectionTitle title="Market Movers" />
          <div className="space-y-2">
            {data.movers.gainers.slice(0, 3).map((q) => (
              <MoverRow key={q.symbol} quote={q} />
            ))}
            {data.movers.losers.slice(0, 2).map((q) => (
              <MoverRow key={q.symbol} quote={q} />
            ))}
          </div>
        </Card>

        {/* Watchlist + activity */}
        <Card>
          <SectionTitle
            title="Watchlist"
            action={
              <Link to="/watchlist" className="text-xs text-brand-strong hover:underline">
                View all
              </Link>
            }
          />
          {data.watchlist.length === 0 ? (
            <p className="text-sm text-ink-dim">
              Add stocks to your watchlist to track them here.{" "}
              <Link to="/markets" className="text-brand-strong hover:underline">
                Find stocks →
              </Link>
            </p>
          ) : (
            <div className="space-y-2">
              {data.watchlist.map((sym) => (
                <Link
                  key={sym}
                  to={`/stocks/${sym}`}
                  className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-card-hover"
                >
                  <span className="font-semibold text-sm">{sym}</span>
                  <span className="text-xs text-ink-faint">View →</span>
                </Link>
              ))}
            </div>
          )}

          <SectionTitle title="Recent Activity" />
          {data.recentActivity.length === 0 ? (
            <p className="text-sm text-ink-dim">No activity yet — your story starts with a trade.</p>
          ) : (
            <ul className="space-y-2">
              {data.recentActivity.slice(0, 4).map((a) => (
                <li key={a.id} className="text-sm">
                  <span className="font-medium">{a.title}</span>
                  {a.amount && (
                    <span className="text-ink-faint"> · ${a.amount}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Learning + challenge */}
        <Card>
          <SectionTitle title="Learning Progress" />
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-ink-dim">Lessons</span>
                <span className="font-semibold">
                  {data.learning.lessonsCompleted}/{data.learning.lessonsTotal}
                </span>
              </div>
              <div className="h-2 rounded-full bg-card-hover overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all"
                  style={{
                    width: `${data.learning.lessonsTotal ? (data.learning.lessonsCompleted / data.learning.lessonsTotal) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <p className="text-sm text-ink-dim">
              🏅 {data.learning.achievementsUnlocked} achievements unlocked
            </p>
            <Link to="/learn">
              <Button variant="secondary" size="sm" className="w-full">
                Continue learning
              </Button>
            </Link>
          </div>

          <SectionTitle title="Daily Challenge" />
          <div className="card !bg-bg-soft p-3.5">
            <p className="text-sm font-semibold">{data.dailyChallenge.title}</p>
            <p className="text-xs text-ink-dim mt-0.5">{data.dailyChallenge.description}</p>
            <p className="text-xs text-brand-strong mt-1.5 font-semibold">
              {data.dailyChallenge.reward}
              {data.dailyChallenge.completed ? " · ✅ Complete" : ""}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function MoverRow({ quote }: { quote: Quote }) {
  return (
    <Link
      to={`/stocks/${quote.symbol}`}
      className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-card-hover"
    >
      <div>
        <p className="text-sm font-semibold">{quote.symbol}</p>
        <p className="text-xs text-ink-faint truncate max-w-28">{quote.name}</p>
      </div>
      <div className="text-right">
        <p className="text-sm tabular-nums">${quote.price}</p>
        <Delta value={quote.changePercent} className="text-xs" />
      </div>
    </Link>
  );
}
