import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { formatDateTime } from "../lib/format.js";
import { useAuth } from "../lib/auth-context.js";
import {
  Button,
  Card,
  Delta,
  ErrorState,
  SimulatedBadge,
  Skeleton,
  StatusDot,
  useToast,
} from "../components/ui.js";
import { PriceChart } from "../components/charts.js";
import {
  useHistory,
  useStock,
  TIMEFRAMES,
  TIMEFRAME_SPAN_DAYS,
  type Timeframe,
} from "../components/StockHooks.js";
import type { WatchlistItemView } from "@aadiinvest/shared";

export default function StockDetailPage() {
  const { symbol = "" } = useParams();
  const [timeframe, setTimeframe] = useState<Timeframe>("1M");
  const queryClient = useQueryClient();
  const { push } = useToast();
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useStock(symbol);
  const history = useHistory(symbol, timeframe);

  const { data: watchlist } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => api.get<{ items: WatchlistItemView[] }>("/api/watchlist"),
    enabled: Boolean(user),
  });
  const { data: portfolio } = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => api.get<import("@aadiinvest/shared").PortfolioSummary>("/api/portfolio"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <ErrorState
        message="We couldn't retrieve the latest market data for this stock."
        onRetry={() => refetch()}
      />
    );
  }

  const { quote, profile, status, news } = data;
  const inWatchlist = (watchlist?.items ?? []).some((w) => w.symbol === quote.symbol);
  const holding = (portfolio?.holdings ?? []).find((h) => h.symbol === quote.symbol);

  const toggleWatch = async () => {
    if (inWatchlist) {
      await api.delete(`/api/watchlist/${quote.symbol}`);
      push(`${quote.symbol} removed from watchlist.`, "info");
    } else {
      await api.post("/api/watchlist", { symbol: quote.symbol });
      push(`${quote.symbol} added to watchlist.`, "success");
    }
    queryClient.invalidateQueries({ queryKey: ["watchlist"] });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{quote.symbol}</h1>
            <SimulatedBadge />
          </div>
          <p className="text-sm text-ink-dim mt-0.5">
            {quote.name} · {quote.exchange}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold tabular-nums">${quote.price}</p>
          <p className="text-sm mt-0.5">
            <Delta value={quote.change} /> <span className="text-ink-faint">({quote.changePercent}%)</span>
          </p>
          <StatusDot open={status.isOpen} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Link to={`/trade?symbol=${encodeURIComponent(quote.symbol)}&side=BUY`}>
          <Button>Buy {quote.symbol}</Button>
        </Link>
        {holding ? (
          <Link to={`/trade?symbol=${encodeURIComponent(quote.symbol)}&side=SELL`}>
            <Button variant="secondary">Sell</Button>
          </Link>
        ) : (
          <Button variant="secondary" disabled>
            Sell
          </Button>
        )}
        <Link to="/simulator">
          <Button variant="secondary">🔮 Simulate this stock</Button>
        </Link>
        <Button variant="ghost" onClick={toggleWatch}>
          {inWatchlist ? "★ In Watchlist" : "☆ Add to Watchlist"}
        </Button>
      </div>

      {/* Chart */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold">Price history</h2>
          <div className="flex gap-1 flex-wrap">
            {TIMEFRAMES.map((tf) => (
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
        {history.isLoading ? (
          <Skeleton className="h-64" />
        ) : history.data && history.data.candles.length > 0 ? (
          <PriceChart
            data={history.data.candles.map((c) => ({ time: c.time, close: c.close }))}
            spanDays={TIMEFRAME_SPAN_DAYS[timeframe]}
            height={300}
          />
        ) : (
          <p className="text-sm text-ink-dim py-10 text-center">No chart data available.</p>
        )}
        <p className="text-xs text-ink-faint mt-2">{data.disclosure}</p>
      </Card>

      <div className="grid lg:grid-cols-2 gap-3">
        {/* About + stats */}
        <Card>
          <h2 className="font-semibold mb-2">About {quote.name}</h2>
          <p className="text-sm text-ink-dim mb-4">{profile.description}</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat
              label="Market Cap"
              value={profile.marketCap === "—" ? "—" : `$${profile.marketCap}`}
            />
            <Stat label="52W High" value={`$${profile.week52High}`} />
            <Stat label="52W Low" value={`$${profile.week52Low}`} />
            <Stat label="Volume" value={Number(quote.volume).toLocaleString("en-CA")} />
            <Stat label="Avg Volume" value={Number(profile.averageVolume).toLocaleString("en-CA")} />
            <Stat label="Category" value={`${profile.assetClass} · ${profile.sector}`} />
            <Stat label="P/E Ratio" value={profile.peRatio ?? "N/A"} />
            <Stat label={profile.yieldLabel} value={profile.dividendYield ?? "N/A"} />
          </div>
        </Card>

        {/* News */}
        <Card>
          <h2 className="font-semibold mb-3">Related stories</h2>
          <div className="space-y-3">
            {news.map((n) => (
              <div key={n.id} className="border-b border-edge-soft last:border-0 pb-3 last:pb-0">
                <p className="text-sm font-medium">{n.headline}</p>
                <p className="text-xs text-ink-dim mt-1">{n.summary}</p>
                <p className="text-[11px] text-ink-faint mt-1">
                  {n.source} · {formatDateTime(n.publishedAt)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card !bg-bg-soft px-3.5 py-2.5">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="font-semibold mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}
