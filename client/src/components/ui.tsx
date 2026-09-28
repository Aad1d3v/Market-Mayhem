import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { cn } from "../lib/utils.js";

/* ---------------- Button ---------------- */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "btn",
        variant === "primary" && "btn-primary",
        variant === "secondary" && "btn-secondary",
        variant === "ghost" && "btn-ghost",
        variant === "danger" && "btn-danger",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "lg" && "px-6 py-3 text-base",
        className,
      )}
      {...props}
    />
  );
}

/* ---------------- Card ---------------- */

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("card p-5", className)}>{children}</div>;
}

export function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-dim">
        {title}
      </h2>
      {action}
    </div>
  );
}

/* ---------------- Inputs ---------------- */

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("input", props.className)} {...props} />;
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-down">{error}</p>}
    </div>
  );
}

/* ---------------- Badges & deltas ---------------- */

export function SimulatedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "badge bg-brand/10 text-brand-strong border border-brand/20",
        className,
      )}
      title="All data in Market Mayhem is simulated for education."
    >
      SIMULATED DATA
    </span>
  );
}

export function Delta({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const n = Number(value);
  const up = n >= 0;
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        up ? "text-up" : "text-down",
        className,
      )}
    >
      {up ? "+" : ""}
      {value}
      {up ? " ↑" : " ↓"}
    </span>
  );
}

export function StatusDot({ open }: { open: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-dim">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          open ? "bg-up animate-pulse" : "bg-ink-faint",
        )}
      />
      {open ? "Market Open" : "Market Closed"}
    </span>
  );
}

/* ---------------- Modal ---------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn(
          "w-full bg-card border border-edge rounded-t-2xl sm:rounded-2xl shadow-2xl animate-pop-in max-h-[92vh] overflow-y-auto",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-edge-soft bg-card/95 backdrop-blur">
          <h3 className="font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="btn-ghost rounded-lg p-1.5 cursor-pointer"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- Toasts ---------------- */

interface Toast {
  id: number;
  message: string;
  kind: "success" | "error" | "info";
}

const ToastContext = createContext<{ push: (m: string, kind?: Toast["kind"]) => void }>({
  push: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: Toast["kind"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        className="fixed bottom-20 sm:bottom-6 right-4 z-[60] flex flex-col gap-2 max-w-xs"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "animate-fade-up rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur",
              t.kind === "success" && "bg-up-soft border-up/30 text-ink",
              t.kind === "error" && "bg-down-soft border-down/30 text-ink",
              t.kind === "info" && "bg-card border-edge text-ink",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/* ---------------- States ---------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="text-4xl mb-3" aria-hidden>
        {icon}
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      {hint && <p className="text-sm text-ink-dim max-w-sm">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="text-4xl mb-3" aria-hidden>
        ⚠️
      </div>
      <h3 className="font-semibold mb-1">Something went wrong</h3>
      <p className="text-sm text-ink-dim max-w-sm">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* ---------------- Quantity stepper ---------------- */

export function QuantityStepper({
  value,
  onChange,
  step = "1",
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  step?: string;
  max?: string;
}) {
  const n = Number(value) || 0;
  const bump = (dir: 1 | -1) => {
    let next = Math.max(0, n + dir * Number(step));
    if (max) next = Math.min(next, Number(max));
    const decimals = (step.split(".")[1] ?? "").length;
    onChange(String(Number(next.toFixed(decimals))));
  };
  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={() => bump(-1)} aria-label="Decrease quantity">
        −
      </Button>
      <Input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-center"
        aria-label="Quantity"
      />
      <Button variant="secondary" size="sm" onClick={() => bump(1)} aria-label="Increase quantity">
        +
      </Button>
    </div>
  );
}
