import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiRequestError } from "../lib/api.js";
import { Button, Card, Field, Input } from "../components/ui.js";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ message: string }>("/api/auth/forgot-password", { email });
      setMessage(res.message);
      setStep("reset");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/api/auth/reset-password", { email, code, newPassword });
      alert("Password updated. Sign in with your new password.");
      navigate("/login");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Reset failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm animate-fade-up">
        <Link to="/login" className="flex items-center justify-center gap-2.5 mb-8">
          <img src="/favicon.svg" alt="" className="h-9 w-9" />
          <span className="font-bold text-xl">Market Mayhem</span>
        </Link>
        <Card>
          {step === "request" ? (
            <>
              <h1 className="text-lg font-bold mb-1">Forgot password</h1>
              <p className="text-sm text-ink-dim mb-5">
                Enter your email and we'll send a reset code.
              </p>
              <form onSubmit={request} className="space-y-4">
                <Field label="Email">
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </Field>
                {error && <p className="text-sm text-down">{error}</p>}
                <Button className="w-full" disabled={submitting}>
                  {submitting ? "Sending…" : "Send reset code"}
                </Button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-lg font-bold mb-1">Check your email</h1>
              {message && <p className="text-xs text-ink-dim mb-4">{message}</p>}
              <form onSubmit={reset} className="space-y-4">
                <Field label="Reset code">
                  <Input
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="6-digit code"
                    inputMode="numeric"
                  />
                </Field>
                <Field label="New password">
                  <Input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="8+ characters, letters and numbers"
                  />
                </Field>
                {error && <p className="text-sm text-down">{error}</p>}
                <Button className="w-full" disabled={submitting}>
                  {submitting ? "Updating…" : "Reset password"}
                </Button>
              </form>
            </>
          )}
          <p className="text-sm text-center mt-4">
            <Link to="/login" className="text-brand-strong hover:underline">
              Back to sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
