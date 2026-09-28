import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { Delta } from "./ui.js";
import type { Quote } from "@aadiinvest/shared";

export default function GlobalSearch({ autoFocus }: { autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () =>
      api.get<{ results: Quote[] }>(
        `/api/markets/search?q=${encodeURIComponent(debounced)}`,
      ),
    enabled: open,
  });

  const go = (symbol: string) => {
    setOpen(false);
    setQ("");
    navigate(`/stocks/${symbol}`);
  };

  return (
    <div className="relative" ref={ref}>
      <input
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search stocks by name or symbol..."
        className="input pl-9"
        aria-label="Search stocks"
      />
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden>
        ⌕
      </span>
      {open && (q.length > 0 || isFetching) && (
        <div className="absolute inset-x-0 top-full mt-2 card p-1 z-50 animate-pop-in max-h-80 overflow-y-auto">
          {(data?.results ?? []).length === 0 && !isFetching && (
            <p className="text-sm text-ink-dim px-3 py-4 text-center">
              No matches for “{q}”.
            </p>
          )}
          {(data?.results ?? []).map((r) => (
            <button
              key={r.symbol}
              onClick={() => go(r.symbol)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-card-hover text-left cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">{r.symbol}</p>
                <p className="text-xs text-ink-dim truncate">{r.name}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm tabular-nums">${r.price}</p>
                <Delta value={r.changePercent} className="text-xs" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
