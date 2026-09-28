import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, ApiRequestError } from "../lib/api.js";
import { useAuth } from "../lib/auth-context.js";
import { Button, Card, Field, Input } from "../components/ui.js";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/api/auth/login", { email, password });
      await refresh();
      navigate((location.state as { from?: string })?.from ?? "/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Sign in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm animate-fade-up">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-8">
          <img src="/favicon.svg" alt="" className="h-9 w-9" />
          <span className="font-bold text-xl">Market Mayhem</span>
        </Link>
        <Card>
          <h1 className="text-lg font-bold mb-1">Welcome back</h1>
          <p className="text-sm text-ink-dim mb-5">Sign in to your simulated portfolio.</p>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email">
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            {error && <p className="text-sm text-down">{error}</p>}
            <Button className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign In"}
            </Button>
          </form>
          <div className="flex items-center justify-between mt-4 text-sm">
            <Link to="/forgot-password" className="text-brand-strong hover:underline">
              Forgot password?
            </Link>
            <Link to="/register" className="text-brand-strong hover:underline">
              Create account
            </Link>
          </div>
        </Card>
        <p className="text-center text-xs text-ink-faint mt-6">
          Educational simulation — no real money involved.
        </p>
      </div>
    </div>
  );
}
