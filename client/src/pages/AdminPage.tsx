import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiRequestError } from "../lib/api.js";
import { formatCad, formatDateTime } from "../lib/format.js";
import {
  Button,
  Card,
  Input,
  Modal,
  SectionTitle,
  Skeleton,
  useToast,
} from "../components/ui.js";
import { cn } from "../lib/utils.js";

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  trades: number;
  openTickets: number;
  disabledUsers: number;
  apiStatus: string;
}

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  disabled: boolean;
  emailVerified: boolean;
  xp: number;
  createdAt: string;
  walletBalance: string;
  investmentCash: string;
}

interface AdminTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  status: string;
  username: string;
  createdAt: string;
  messages: { id: string; authorName: string; authorRole: string; body: string; createdAt: string }[];
}

interface MarketEventRow {
  id: string;
  name: string;
  description: string;
  modifier: number;
  active: boolean;
}

const TABS = ["Overview", "Users", "Tickets", "Market Events"] as const;

export default function AdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const queryClient = useQueryClient();
  const { push } = useToast();

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.get<AdminStats>("/api/admin/stats"),
  });
  const [userQuery, setUserQuery] = useState("");
  const { data: users } = useQuery({
    queryKey: ["admin-users", userQuery],
    queryFn: () =>
      api.get<{ items: AdminUser[]; total: number }>(
        `/api/admin/users?limit=50&q=${encodeURIComponent(userQuery)}`,
      ),
    enabled: tab === "Users",
  });
  const { data: tickets } = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: () => api.get<{ items: AdminTicket[] }>("/api/admin/tickets"),
    enabled: tab === "Tickets",
  });
  const { data: events } = useQuery({
    queryKey: ["admin-events"],
    queryFn: () => api.get<{ items: MarketEventRow[] }>("/api/admin/market-events"),
    enabled: tab === "Market Events",
  });

  const [replyTicket, setReplyTicket] = useState<AdminTicket | null>(null);
  const [replyText, setReplyText] = useState("");
  const [nextStatus, setNextStatus] = useState("IN_PROGRESS");

  const toggleUser = async (u: AdminUser) => {
    try {
      await api.patch(`/api/admin/users/${u.id}`, { disabled: !u.disabled });
      push(u.disabled ? `${u.username} re-enabled.` : `${u.username} disabled.`, "success");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      push(e instanceof ApiRequestError ? e.message : "Update failed.", "error");
    }
  };

  const sendReply = async () => {
    if (!replyTicket) return;
    try {
      await api.patch(`/api/admin/tickets/${replyTicket.id}`, {
        reply: replyText,
        status: nextStatus,
      });
      push("Reply sent.", "success");
      setReplyTicket(null);
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
    } catch (e) {
      push(e instanceof ApiRequestError ? e.message : "Reply failed.", "error");
    }
  };

  const toggleEvent = async (ev: MarketEventRow) => {
    await api.patch(`/api/admin/market-events/${ev.id}`, { active: !ev.active });
    push(
      ev.active ? `${ev.name} deactivated.` : `${ev.name} activated (SIMULATED).`,
      "success",
    );
    queryClient.invalidateQueries({ queryKey: ["admin-events"] });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">🛡️ Admin</h1>
          <p className="text-sm text-ink-dim mt-0.5">
            Server-authorized dashboard. Non-admins are rejected by the API.
          </p>
        </div>
      </header>

      <div className="flex gap-1.5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer",
              tab === t ? "bg-brand/15 text-brand-strong" : "text-ink-dim hover:text-ink",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {stats ? (
            <>
              <StatCard label="Total Users" value={String(stats.totalUsers)} />
              <StatCard label="Active Sessions" value={String(stats.activeUsers)} />
              <StatCard label="Trades" value={String(stats.trades)} />
              <StatCard label="Open Tickets" value={String(stats.openTickets)} />
              <StatCard label="Disabled Users" value={String(stats.disabledUsers)} />
            </>
          ) : (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          )}
        </div>
      )}

      {tab === "Users" && (
        <Card>
          <SectionTitle
            title="Users"
            action={
              <Input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Search username or email…"
                className="!w-56"
              />
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-faint border-b border-edge-soft">
                  <th className="py-2.5 pr-4">User</th>
                  <th className="py-2.5 pr-4">Wallet</th>
                  <th className="py-2.5 pr-4">Invested Cash</th>
                  <th className="py-2.5 pr-4">XP</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5" />
                </tr>
              </thead>
              <tbody>
                {(users?.items ?? []).map((u) => (
                  <tr key={u.id} className="border-b border-edge-soft last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-semibold">
                        {u.username}
                        {u.role === "ADMIN" && (
                          <span className="ml-1.5 text-[10px] font-bold text-warn">ADMIN</span>
                        )}
                      </p>
                      <p className="text-xs text-ink-faint">{u.email}</p>
                    </td>
                    <td className="py-3 pr-4 tabular-nums">{formatCad(Number(u.walletBalance))}</td>
                    <td className="py-3 pr-4 tabular-nums">{formatCad(Number(u.investmentCash))}</td>
                    <td className="py-3 pr-4 tabular-nums">{u.xp}</td>
                    <td className="py-3 pr-4">
                      {u.disabled ? (
                        <span className="badge bg-down-soft text-down border border-down/20">Disabled</span>
                      ) : (
                        <span className="badge bg-up-soft text-up border border-up/20">Active</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {u.role !== "ADMIN" && (
                        <Button size="sm" variant={u.disabled ? "secondary" : "danger"} onClick={() => toggleUser(u)}>
                          {u.disabled ? "Enable" : "Disable"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "Tickets" && (
        <Card>
          <SectionTitle title="Support Tickets" />
          {(tickets?.items ?? []).length === 0 ? (
            <p className="text-sm text-ink-dim py-6 text-center">No tickets.</p>
          ) : (
            <div className="divide-y divide-edge-soft">
              {(tickets?.items ?? []).map((t) => (
                <div key={t.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      #{t.ticketNumber} · {t.subject}
                    </p>
                    <p className="text-xs text-ink-faint">
                      {t.username} · {t.category} · {formatDateTime(t.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        "badge",
                        t.status === "OPEN" && "bg-warn/10 text-warn border border-warn/20",
                        t.status === "IN_PROGRESS" && "bg-brand/10 text-brand-strong border border-brand/20",
                        t.status === "RESOLVED" && "bg-up-soft text-up border border-up/20",
                      )}
                    >
                      {t.status.replace("_", " ")}
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => setReplyTicket(t)}>
                      Open
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "Market Events" && (
        <Card>
          <SectionTitle title="Simulated Market Events" />
          <p className="text-xs text-ink-faint mb-4">
            Activating an event announces a clearly-labeled SIMULATED scenario to all users and
            applies a narrative modifier to the game layer. Real market data is never altered.
          </p>
          <div className="space-y-2">
            {(events?.items ?? []).map((ev) => (
              <div key={ev.id} className="flex items-center justify-between card !bg-bg-soft px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{ev.name}</p>
                  <p className="text-xs text-ink-dim">{ev.description}</p>
                </div>
                <Button size="sm" variant={ev.active ? "danger" : "secondary"} onClick={() => toggleEvent(ev)}>
                  {ev.active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Reply modal */}
      <Modal
        open={Boolean(replyTicket)}
        onClose={() => setReplyTicket(null)}
        title={replyTicket ? `Reply · #${replyTicket.ticketNumber}` : ""}
        wide
      >
        {replyTicket && (
          <div className="space-y-4">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {replyTicket.messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "rounded-xl px-3.5 py-2.5 text-sm",
                    m.authorRole === "ADMIN" ? "bg-brand/10" : "bg-bg-soft",
                  )}
                >
                  <p className="text-xs text-ink-dim mb-0.5">
                    {m.authorName} · {formatDateTime(m.createdAt)}
                  </p>
                  <p className="whitespace-pre-line">{m.body}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="label">Reply</label>
                <textarea
                  className="input min-h-20"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write your response…"
                />
              </div>
              <select
                className="input !w-36"
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value)}
                aria-label="Set ticket status"
              >
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </div>
            <Button className="w-full" disabled={!replyText.trim()} onClick={sendReply}>
              Send reply
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="!p-4">
      <p className="text-xs text-ink-dim uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
    </Card>
  );
}
