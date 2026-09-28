import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { formatCad } from "@aadiinvest/shared";
import { Card, Delta, ErrorState, Skeleton } from "../components/ui.js";
import { cn } from "../lib/utils.js";
import type { LeaderboardRow } from "@aadiinvest/shared";

export default function LeaderboardPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => api.get<{ items: LeaderboardRow[] }>("/api/leaderboard"),
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <ErrorState message="Couldn't load the leaderboard." onRetry={() => refetch()} />;

  const rows = data?.items ?? [];

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-sm text-ink-dim mt-0.5">
          Game rankings by simulated investment account value. Usernames only — never emails or
          personal details.
        </p>
      </header>

      <Card className="!p-0 overflow-hidden">
        {rows.length === 0 ? (
          <p className="text-sm text-ink-dim text-center py-10">
            No ranked players yet — make a transfer and a trade to appear here.
          </p>
        ) : (
          <div className="divide-y divide-edge-soft">
            {rows.map((r) => (
              <div
                key={r.rank}
                className={cn(
                  "flex items-center gap-4 px-5 py-3.5",
                  r.isSelf && "bg-brand/10",
                )}
              >
                <span
                  className={cn(
                    "w-8 text-center font-bold tabular-nums",
                    r.rank === 1 && "text-warn text-lg",
                    r.rank <= 3 && r.rank !== 1 && "text-ink",
                  )}
                >
                  {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : r.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {r.username}
                    {r.isSelf && (
                      <span className="ml-2 text-[10px] font-bold text-brand-strong">YOU</span>
                    )}
                  </p>
                  <p className="text-xs text-ink-faint">Level {r.level}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCad(Number(r.portfolioValue))}
                  </p>
                  <Delta value={r.returnPercent} className="text-xs" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="text-xs text-ink-faint text-center">
        You can hide yourself from the leaderboard in Settings → Privacy.
      </p>
    </div>
  );
}
