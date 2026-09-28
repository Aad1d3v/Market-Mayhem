import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiRequestError } from "../lib/api.js";
import { useAuth } from "../lib/auth-context.js";
import { Button, Card, Field, Input } from "../components/ui.js";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { refresh } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setError(null);
    if (password !== confirm) {
      setErrors({ confirm: "Passwords do not match." });
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/auth/register", { username, email, password });
      await refresh();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.fields) setErrors(err.fields);
        setError(err.message);
      } else {
        setError("Registration failed.");
      }
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
          <h1 className="text-lg font-bold mb-1">Create your free account</h1>
          <p className="text-sm text-ink-dim mb-5">
            You'll receive <span className="text-ink font-semibold">$800.00 CAD</span> of virtual
            cash — one time, no strings.
          </p>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Username" error={errors.username}>
              <Input
                required
                minLength={3}
                maxLength={24}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. market_rookie"
                autoComplete="username"
              />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password" error={errors.password}>
              <Input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8+ characters, letters and numbers"
              />
            </Field>
            <Field label="Confirm Password" error={errors.confirm}>
              <Input
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat your password"
              />
            </Field>
            {error && <p className="text-sm text-down">{error}</p>}
            <Button className="w-full" disabled={submitting}>
              {submitting ? "Creating account…" : "Start for Free"}
            </Button>
          </form>
          <p className="text-sm text-ink-dim mt-4 text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-brand-strong hover:underline">
              Sign in
            </Link>
          </p>
        </Card>
        <p className="text-center text-xs text-ink-faint mt-6">
Market Mayhem is an educational simulation. No real money is deposited, invested, or withdrawn. You start with $800 virtual cash and 1 free share of Aadidev.co.
        </p>
      </div>
    </div>
  );
}
