import { useEffect, useState } from "react";
import type { MarketEventView, UpcomingEventView } from "@aadiinvest/shared";
import { cn } from "../lib/utils.js";

function scopeLabel(ev: MarketEventView): string {
  switch (ev.scope) {
    case "ALL":
      return "Entire market";
    case "ASSET_CLASS":
      return `${ev.target ?? ""} across the board`.trim();
    case "SECTOR":
      return `${ev.target ?? ""} sector`;
    case "SYMBOL":
      return ev.target ?? "Single listing";
    case "MANUAL":
      return "Admin-triggered scenario";
    default:
      return "Market";
  }
}

function countdown(ms: number): string {
  if (ms <= 0) return "ending now";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min left`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return `${hours}h ${rest}m left`;
}

/** Re-renders every 30s so countdowns stay honest. */
function useTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function ActiveEventCard({
  ev,
  className,
}: {
  ev: MarketEventView;
  className?: string;
}) {
  const now = useTick();
  const crash = ev.severity === "crash";
  const wild = ev.severity === "wild";
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        crash && "border-down/40 bg-down-soft",
        wild && "border-warn/40 bg-warn/10",
        !crash && !wild && "border-up/40 bg-up-soft",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            {crash ? "💥" : wild ? "⚡" : "🚀"}
          </span>
          <p className="font-bold">{ev.name}</p>
          <span
            className={cn(
              "badge",
              crash
                ? "bg-down/15 text-down border border-down/30"
                : wild
                  ? "bg-warn/15 text-warn border border-warn/30"
                  : "bg-up/15 text-up border border-up/30",
            )}
          >
            {ev.percentChange >= 0 ? "+" : ""}
            {ev.percentChange.toFixed(1)}%
          </span>
        </div>
        <p className="text-xs text-ink-dim">
          {scopeLabel(ev)} · {countdown(new Date(ev.endsAt).getTime() - now)}
        </p>
      </div>
      <p className="text-sm text-ink-dim mt-1.5">{ev.headline}</p>
      <p className="text-xs text-ink-faint mt-1">
        {ev.description} <span className="font-semibold">Simulated event.</span>
      </p>
    </div>
  );
}

export default function EventBanner({
  events,
  upcoming,
  limit = 2,
  className,
}: {
  events: MarketEventView[] | undefined;
  upcoming?: UpcomingEventView | null;
  limit?: number;
  className?: string;
}) {
  const now = useTick();
  const active = (events ?? []).slice(0, limit);
  const next = upcoming ?? null;
  const nextMs = next ? new Date(next.startsAt).getTime() - now : 0;
  if (active.length === 0 && !next) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {active.map((ev) => (
        <ActiveEventCard key={`${ev.key}-${ev.startedAt}`} ev={ev} />
      ))}
      {next && (
        <div className="rounded-2xl border border-edge bg-card-hover/40 p-3.5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">🔮 Incoming scenario: {next.name}</p>
            <p className="text-xs text-ink-dim mt-0.5">{next.teaser}</p>
          </div>
          <span
            className={cn(
              "badge",
              next.severity === "crash"
                ? "bg-down/10 text-down border border-down/20"
                : "bg-brand/10 text-brand-strong border border-brand/20",
            )}
          >
            {nextMs > 0 ? `starts in ${countdown(nextMs).replace(" left", "")}` : "starting now"}
          </span>
        </div>
      )}
    </div>
  );
}
