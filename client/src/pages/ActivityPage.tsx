import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { formatDateTime } from "../lib/format.js";
import { Button, Card, Delta, EmptyState, ErrorState, Skeleton } from "../components/ui.js";
import { cn } from "../lib/utils.js";
import type { ActivityItem } from "@aadiinvest/shared";

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "BUYS", label: "Buys" },
  { key: "SELLS", label: "Sells" },
  { key: "TRANSFERS", label: "Transfers" },
  { key: "ACHIEVEMENTS", label: "Achievements" },
  { key: "REWARDS", label: "Rewards" },
] as const;

const PAGE_SIZE = 25;

export default function ActivityPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("ALL");
  const [page, setPage] = useState(0);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["activity", filter, page],
    queryFn: () =>
      api.get<{ items: ActivityItem[]; total: number }>(
        `/api/activity?filter=${filter}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
      ),
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <ErrorState message="Couldn't load your activity." onRetry={() => refetch()} />;

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Activity</h1>
        <p className="text-sm text-ink-dim mt-0.5">Everything you've done in the simulation.</p>
      </header>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setFilter(f.key);
              setPage(0);
            }}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors",
              filter === f.key
                ? "bg-brand/15 text-brand-strong"
                : "text-ink-dim hover:text-ink hover:bg-card-hover",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card>
        {items.length === 0 ? (
          <EmptyState
            icon="🗓️"
            title="Nothing here yet"
            hint="Trades, transfers, achievements and rewards will appear in this timeline."
          />
        ) : (
          <ol className="relative space-y-0">
            {items.map((a, i) => {
              const amount = a.amount ? Number(a.amount) : null;
              return (
                <li key={a.id} className="flex gap-4">
                  {/* timeline rail */}
                  <div className="flex flex-col items-center">
                    <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-brand/60" />
                    {i < items.length - 1 && <span className="w-px flex-1 bg-edge-soft" />}
                  </div>
                  <div className={cn("pb-6 flex-1", i === 0 && "animate-fade-up")}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold">{a.title}</p>
                      {amount !== null && (
                        <Delta
                          value={amount.toFixed(2)}
                          className="text-xs"
                        />
                      )}
                    </div>
                    {a.detail && <p className="text-xs text-ink-dim mt-0.5">{a.detail}</p>}
                    <p className="text-[11px] text-ink-faint mt-1">{formatDateTime(a.createdAt)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-edge-soft">
            <Button
              size="sm"
              variant="secondary"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Previous
            </Button>
            <span className="text-xs text-ink-faint">
              Page {page + 1} of {pages}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
