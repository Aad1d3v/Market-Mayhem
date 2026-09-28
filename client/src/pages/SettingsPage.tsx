import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiRequestError } from "../lib/api.js";
import { useAuth } from "../lib/auth-context.js";
import { Button, Card, Field, Input, useToast } from "../components/ui.js";
import { levelFromXp } from "../layouts/level.js";
import { formatDate } from "../lib/format.js";
import type { NotificationPrefs } from "@aadiinvest/shared";

const NOTIF_LABELS: Record<keyof NotificationPrefs, string> = {
  orderFilled: "Order fills and transfers",
  achievements: "Achievements",
  learning: "Learning reminders",
  marketEvents: "Simulated market events",
  support: "Support replies",
};

export default function SettingsPage() {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const { push } = useToast();

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  if (!user) return null;

  const prefs = user.notificationPrefs;

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.patch("/api/me", { displayName });
      await refresh();
      push("Profile updated.", "success");
    } catch (e) {
      push(e instanceof ApiRequestError ? e.message : "Update failed.", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const togglePref = async (key: keyof NotificationPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    await api.patch("/api/me", { notificationPrefs: next });
    await refresh();
  };

  const toggleLeaderboard = async () => {
    await api.patch("/api/me", { leaderboardVisible: !user.leaderboardVisible });
    await refresh();
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-ink-dim mt-0.5">Profile, notifications and privacy.</p>
      </header>

      {/* Profile */}
      <Card>
        <h2 className="font-semibold mb-4">Profile</h2>
        <div className="flex items-center gap-4 mb-5">
          <div
            className="h-14 w-14 rounded-full flex items-center justify-center text-lg font-bold text-white"
            style={{ background: user.avatarColor }}
            aria-hidden
          >
            {user.username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold">{user.username}</p>
            <p className="text-xs text-ink-faint">
              Level {levelFromXp(user.xp)} · {user.xp} XP ·{" "}
              {user.achievementCount} achievements
            </p>
            <p className="text-xs text-ink-faint">Joined {formatDate(user.createdAt)}</p>
          </div>
        </div>
        <Field label="Display name">
          <Input
            value={displayName}
            maxLength={40}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How should we greet you?"
          />
        </Field>
        <p className="text-xs text-ink-faint mt-1.5 mb-3">
          Email: {user.email}{" "}
          {user.emailVerified ? (
            <span className="text-up">· verified ✓</span>
          ) : (
            <span className="text-warn">· unverified</span>
          )}
        </p>
        <Button size="sm" disabled={savingProfile} onClick={saveProfile}>
          {savingProfile ? "Saving…" : "Save profile"}
        </Button>
      </Card>

      {/* Notifications */}
      <Card>
        <h2 className="font-semibold mb-3">Notifications</h2>
        <ul className="divide-y divide-edge-soft">
          {(Object.keys(NOTIF_LABELS) as (keyof NotificationPrefs)[]).map((key) => (
            <li key={key} className="flex items-center justify-between py-3">
              <span className="text-sm">{NOTIF_LABELS[key]}</span>
              <button
                role="switch"
                aria-checked={prefs[key]}
                onClick={() => togglePref(key)}
                className={
                  prefs[key]
                    ? "h-6 w-10 rounded-full bg-brand relative transition-colors cursor-pointer"
                    : "h-6 w-10 rounded-full bg-edge relative transition-colors cursor-pointer"
                }
              >
                <span
                  className={
                    prefs[key]
                      ? "absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-white transition-all"
                      : "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-ink-faint transition-all"
                  }
                />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {/* Privacy */}
      <Card>
        <h2 className="font-semibold mb-3">Privacy</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">Appear on the leaderboard</p>
            <p className="text-xs text-ink-faint">
              Usernames only are ever shown — never emails.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={user.leaderboardVisible}
            onClick={toggleLeaderboard}
            className={
              user.leaderboardVisible
                ? "h-6 w-10 rounded-full bg-brand relative transition-colors cursor-pointer"
                : "h-6 w-10 rounded-full bg-edge relative transition-colors cursor-pointer"
            }
          >
            <span
              className={
                user.leaderboardVisible
                  ? "absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-white transition-all"
                  : "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-ink-faint transition-all"
              }
            />
          </button>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold mb-2">Account</h2>
        <p className="text-sm text-ink-dim mb-4">
          Signing out keeps your portfolio safe — balances never reset.
        </p>
        <Button
          variant="danger"
          onClick={async () => {
            await logout();
            navigate("/");
          }}
        >
          Sign out
        </Button>
      </Card>
    </div>
  );
}
