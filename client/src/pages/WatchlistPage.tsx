import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import {
  Button,
  Card,
  Delta,
  EmptyState,
  ErrorState,
  SectionTitle,
  Skeleton,
  useToast,
} from "../components/ui.js";
import { Sparkline } from "../components/charts.js";
import GlobalSearch from "../components/GlobalSearch.js";
import type { WatchlistItemView } from "@aadiinvest/shared";

export default function WatchlistPage() {
  const queryClient = useQueryClient();
  const { push } = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => api.get<{ items: WatchlistItemView[] }>("/api/watchlist"),
    refetchInterval: 30_000,
  });

  const remove = async (symbol: string) => {
    await api.delete(`/api/watchlist/${symbol}`);
    push(`${symbol} removed from watchlist.`, "info");
    queryClient.invalidateQueries({ queryKey: ["watchlist"] });
  };

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState message="Couldn't load your watchlist." onRetry={() => refetch()} />;

  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Watchlist</h1>
        <p className="text-sm text-ink-dim mt-0.5">Track simulated stocks you care about.</p>
      </header>

      <Card>
        <label className="label">Add a stock</label>
        <GlobalSearch
          autoFocus={false}
        />
        <p className="text-xs text-ink-faint mt-2">
          Tip: open any stock page and use “Add to Watchlist”.
        </p>
      </Card>

      <Card>
        <SectionTitle title={`Your list (${items.length})`} />
        {items.length === 0 ? (
          <EmptyState
            icon="⭐"
            title="No watchlist items yet"
            hint="Add stocks to your watchlist to track them here."
            action={
              <Link to="/markets">
                <Button variant="secondary">Explore Markets</Button>
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-edge-soft">
            {items.map((w) => (
              <div key={w.symbol} className="flex items-center justify-between py-3 gap-3">
                <Link to={`/stocks/${w.symbol}`} className="flex items-center gap-3 min-w-0 flex-1">
                  <Sparkline values={w.spark} up={Number(w.change) >= 0} />
                  <div className="min-w-0">
                    <p className="font-bold text-sm">{w.symbol}</p>
                    <p className="text-xs text-ink-faint truncate max-w-44">{w.company}</p>
                  </div>
                </Link>
                <div className="text-right shrink-0">
                  <p className="text-sm tabular-nums">${w.price}</p>
                  <Delta value={w.changePercent} className="text-xs" />
                </div>
                <button
                  onClick={() => remove(w.symbol)}
                  className="btn-ghost rounded-lg p-1.5 text-xs cursor-pointer shrink-0"
                  aria-label={`Remove ${w.symbol} from watchlist`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
