import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiRequestError } from "../lib/api.js";
import { formatCad } from "@aadiinvest/shared";
import { Button, Delta, Modal, QuantityStepper } from "./ui.js";

export interface TradeModalProps {
  open: boolean;
  onClose: () => void;
  side: "BUY" | "SELL";
  symbol: string;
  company: string;
  price: string;
  availableCash?: string; // for BUY
  ownedShares?: string; // for SELL
  averageCost?: string; // for SELL
  unrealizedPL?: string; // for SELL
  onDone?: () => void;
}

type Stage = "form" | "review" | "result";

export default function TradeModal(props: TradeModalProps) {
  const {
    open,
    onClose,
    side,
    symbol,
    company,
    price,
    availableCash,
    ownedShares,
    averageCost,
    unrealizedPL,
    onDone,
  } = props;

  const [stage, setStage] = useState<Stage>("form");
  const [qty, setQty] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    filledQty: string;
    total: string;
    unlocked: string[];
  } | null>(null);
  const queryClient = useQueryClient();

  const p = Number(price) || 0;
  const q = Number(qty) || 0;
  const estimated = useMemo(() => q * p, [q, p]);

  const reset = () => {
    setStage("form");
    setQty("1");
    setError(null);
    setResult(null);
  };

  const close = () => {
    onClose();
    setTimeout(reset, 200);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{
        quantity: string;
        total: string;
        unlockedAchievements: string[];
      }>("/api/orders", {
        side,
        symbol,
        quantity: String(Number(qty)),
        clientRequestId: crypto.randomUUID(),
      });
      setResult({
        filledQty: res.quantity,
        total: res.total,
        unlocked: res.unlockedAchievements ?? [],
      });
      setStage("result");
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      onDone?.();
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.message : "Order failed. Try again.";
      setError(msg);
      setStage("form");
    } finally {
      setSubmitting(false);
    }
  };

  const insufficient =
    side === "BUY" && availableCash !== undefined && estimated > Number(availableCash);
  const oversell =
    side === "SELL" && ownedShares !== undefined && q > Number(ownedShares);

  return (
    <Modal
      open={open}
      onClose={close}
      title={`${side === "BUY" ? "Buy" : "Sell"} ${symbol}`}
    >
      {stage === "form" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-dim">{company}</span>
            <span className="font-semibold tabular-nums">${price}</span>
          </div>

          {side === "SELL" && ownedShares !== undefined && (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="card p-2.5">
                <p className="text-ink-dim">Owned</p>
                <p className="font-semibold mt-0.5">{Number(ownedShares)}</p>
              </div>
              <div className="card p-2.5">
                <p className="text-ink-dim">Avg cost</p>
                <p className="font-semibold mt-0.5">${averageCost}</p>
              </div>
              <div className="card p-2.5">
                <p className="text-ink-dim">Unrealized</p>
                <Delta value={unrealizedPL ?? "0"} className="text-xs" />
              </div>
            </div>
          )}

          <div>
            <label className="label">Quantity</label>
            <QuantityStepper value={qty} onChange={setQty} step={side === "SELL" ? "1" : "1"} />
            {side === "SELL" && (
              <div className="mt-2 flex gap-1.5">
                {[
                  ["25%", 0.25],
                  ["50%", 0.5],
                  ["All", 1],
                ].map(([label, frac]) => (
                  <Button
                    key={label as string}
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setQty(String(Math.floor(Number(ownedShares ?? 0) * (frac as number) * 1e6) / 1e6))
                    }
                  >
                    Sell {label as string}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="card p-3.5 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-dim">Estimated price</span>
              <span className="tabular-nums">${price}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-dim">Estimated total</span>
              <span className="font-semibold tabular-nums">${estimated.toFixed(2)} CAD</span>
            </div>
            {side === "BUY" && availableCash !== undefined && (
              <div className="flex justify-between">
                <span className="text-ink-dim">Remaining cash</span>
                <span className="tabular-nums">
                  ${Math.max(0, Number(availableCash) - estimated).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {side === "BUY" && availableCash !== undefined && (
            <p className="text-xs text-ink-dim">
              Available investment cash: <span className="text-ink font-semibold">${availableCash}</span>
            </p>
          )}

          {insufficient && (
            <p className="text-sm text-down">
              You need ${(estimated - Number(availableCash)).toFixed(2)} more virtual cash to
              place this order.
            </p>
          )}
          {oversell && (
            <p className="text-sm text-down">You cannot sell more shares than you own.</p>
          )}
          {error && <p className="text-sm text-down">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={close}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={q <= 0 || insufficient || oversell}
              onClick={() => setStage("review")}
            >
              Review Order
            </Button>
          </div>
        </div>
      )}

      {stage === "review" && (
        <div className="space-y-4">
          <div className="card p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-dim">Order type</span>
              <span className="font-semibold">
                {side === "BUY" ? "Market Buy" : "Market Sell"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-dim">Symbol</span>
              <span className="font-semibold">{symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-dim">Quantity</span>
              <span className="tabular-nums">{Number(qty)} shares</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-dim">Est. price</span>
              <span className="tabular-nums">${price}</span>
            </div>
            <div className="flex justify-between border-t border-edge-soft pt-2">
              <span className="text-ink-dim">Estimated total</span>
              <span className="font-bold tabular-nums">{formatCad(estimated)} CAD</span>
            </div>
          </div>
          <p className="text-xs text-ink-dim">
            This is a <span className="text-brand-strong font-semibold">simulated</span> order.
            No real money is involved. The server executes it at the current simulated price.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStage("form")}>
              Back
            </Button>
            <Button className="flex-1" disabled={submitting} onClick={submit}>
              {submitting ? "Placing…" : `Confirm Simulated ${side === "BUY" ? "Buy" : "Sale"}`}
            </Button>
          </div>
        </div>
      )}

      {stage === "result" && result && (
        <div className="space-y-4 text-center py-2">
          <div className="text-4xl" aria-hidden>✅</div>
          <h4 className="font-bold text-lg">Order Filled</h4>
          <p className="text-sm text-ink-dim">
            {side === "BUY" ? "Bought" : "Sold"} {Number(result.filledQty)} shares of {symbol} for{" "}
            <span className="text-ink font-semibold">${result.total}</span> CAD (simulated).
          </p>
          {result.unlocked.length > 0 && (
            <p className="text-sm text-up">
              🏅 Achievement{result.unlocked.length > 1 ? "s" : ""} unlocked!
            </p>
          )}
          <Button className="w-full" onClick={close}>
            Done
          </Button>
        </div>
      )}
    </Modal>
  );
}
