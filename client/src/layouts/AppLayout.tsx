import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth-context.js";
import { cn } from "../lib/utils.js";
import { levelFromXp } from "./level.js";
import {
  useToast,
} from "../components/ui.js";
import GlobalSearch from "../components/GlobalSearch.js";
import TutorialHost from "../tutorial/TutorialHost.js";
import type { NotificationView } from "@aadiinvest/shared";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: "▦" },
  { to: "/markets", label: "Markets", icon: "📈" },
  { to: "/news", label: "News", icon: "📰" },
  { to: "/watchlist", label: "Watchlist", icon: "★" },
  { to: "/portfolio", label: "Portfolio", icon: "◈" },
  { to: "/trade", label: "Buy & Sell", icon: "⇄" },
  { to: "/simulator", label: "Chaos Lab", icon: "🔮" },
  { to: "/wallet", label: "Wallet", icon: "▤" },
  { to: "/activity", label: "Activity", icon: "☰" },
  { to: "/learn", label: "Learn", icon: "🎓" },
  { to: "/leaderboard", label: "Leaderboard", icon: "🏆" },
];

const MOBILE_NAV = [
  { to: "/dashboard", label: "Home", icon: "▦" },
  { to: "/markets", label: "Markets", icon: "📈" },
  { to: "/portfolio", label: "Portfolio", icon: "◈" },
  { to: "/trade", label: "Trade", icon: "⇄" },
  { to: "/wallet", label: "Wallet", icon: "▤" },
];

const MORE_MENU = [
  { to: "/simulator", label: "Chaos Lab" },
  { to: "/watchlist", label: "Watchlist" },
  { to: "/news", label: "Market News" },
  { to: "/activity", label: "Activity" },
  { to: "/learn", label: "Learn" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/help", label: "Helpdesk" },
  { to: "/settings", label: "Settings" },
];

function NavItem({
  to,
  icon,
  label,
}: {
  to: string;
  icon: string;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-brand/15 text-brand-strong"
            : "text-ink-dim hover:text-ink hover:bg-card-hover",
        )
      }
    >
      <span aria-hidden className="w-5 text-center">{icon}</span>
      {label}
    </NavLink>
  );
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      api.get<{ items: NotificationView[]; unread: number }>("/api/notifications"),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markRead = async (id: string) => {
    await api.post(`/api/notifications/${id}/read`);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markAll = async () => {
    await api.post("/api/notifications/read-all");
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-xl p-2 text-ink-dim hover:text-ink hover:bg-card-hover cursor-pointer"
        aria-label={`Notifications${data?.unread ? ` (${data.unread} unread)` : ""}`}
      >
        🔔
        {(data?.unread ?? 0) > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-down text-[10px] font-bold text-white flex items-center justify-center">
            {data!.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 card p-0 overflow-hidden z-50 animate-pop-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-edge-soft">
            <span className="text-sm font-semibold">Notifications</span>
            <button onClick={markAll} className="text-xs text-brand-strong hover:underline cursor-pointer">
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {(data?.items ?? []).length === 0 && (
              <p className="text-sm text-ink-dim px-4 py-6 text-center">
                You're all caught up.
              </p>
            )}
            {(data?.items ?? []).map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                className={cn(
                  "block w-full text-left px-4 py-3 border-b border-edge-soft last:border-0 hover:bg-card-hover cursor-pointer",
                  !n.read && "bg-brand/5",
                )}
              >
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-xs text-ink-dim mt-0.5">{n.body}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  if (!user) return null;

  return (
    <div className="min-h-full flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 border-r border-edge-soft bg-bg-soft/50 px-4 py-5 sticky top-0 h-screen">
        <NavLink to="/dashboard" className="flex items-center gap-2.5 px-2 mb-6">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <span className="font-bold text-lg tracking-tight">Market Mayhem</span>
        </NavLink>
        <nav className="flex-1 space-y-1" aria-label="Main">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
          <div className="my-3 border-t border-edge-soft" />
          <NavItem to="/help" icon="💬" label="Helpdesk" />
          <NavItem to="/settings" icon="⚙️" label="Settings" />
          {user.role === "ADMIN" && <NavItem to="/admin" icon="🛡️" label="Admin" />}
        </nav>
        <div className="border-t border-edge-soft pt-3 mt-3">
          <div className="flex items-center gap-3 px-2">
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: user.avatarColor }}
              aria-hidden
            >
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{user.displayName ?? user.username}</p>
              <p className="text-xs text-ink-dim">Level {levelFromXp(user.xp)} · {user.xp} XP</p>
            </div>
            <button
              onClick={async () => {
                await logout();
                push("Signed out. See you soon!", "info");
                navigate("/");
              }}
              className="text-xs text-ink-faint hover:text-ink cursor-pointer"
              aria-label="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-40 bg-bg/85 backdrop-blur border-b border-edge-soft">
          <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
            <NavLink to="/dashboard" className="lg:hidden flex items-center gap-2">
              <img src="/favicon.svg" alt="" className="h-7 w-7" />
              <span className="font-bold">Market Mayhem</span>
            </NavLink>
            <div className="hidden sm:block flex-1 max-w-md">
              <GlobalSearch />
            </div>
            <div className="flex-1 sm:hidden" />
            <div className="flex items-center gap-1.5">
              <span className="badge bg-up-soft text-up border border-up/20 hidden md:inline-flex">
                SIMULATED DATA
              </span>
              <NotificationsBell />
              <NavLink
                to="/settings"
                className="lg:hidden rounded-xl p-2 text-ink-dim hover:text-ink hover:bg-card-hover"
                aria-label="Settings"
              >
                ⚙️
              </NavLink>
            </div>
          </div>
          <div className="sm:hidden px-4 pb-3">
            <GlobalSearch />
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 py-6 pb-24 lg:pb-6">
          <div className="max-w-6xl mx-auto animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-bg/95 backdrop-blur border-t border-edge-soft"
        aria-label="Mobile"
      >
        <div className="grid grid-cols-6 items-stretch">
          {MOBILE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium",
                  isActive ? "text-brand-strong" : "text-ink-faint",
                )
              }
            >
              <span className="text-lg leading-none" aria-hidden>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen((o) => !o)}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium cursor-pointer",
              moreOpen ? "text-brand-strong" : "text-ink-faint",
            )}
          >
            <span className="text-lg leading-none" aria-hidden>⋯</span>
            More
          </button>
        </div>
        {moreOpen && (
          <div className="absolute bottom-full inset-x-0 bg-card border-t border-edge p-2 grid grid-cols-3 gap-1 animate-pop-in">
            {MORE_MENU.map((m) => (
              <NavLink
                key={m.to}
                to={m.to}
                className="rounded-lg px-3 py-2.5 text-xs text-ink-dim hover:text-ink hover:bg-card-hover"
              >
                {m.label}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* Interactive tutorial overlay host */}
      <TutorialHost />
    </div>
  );
}
