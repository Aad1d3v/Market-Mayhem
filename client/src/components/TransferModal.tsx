import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiRequestError } from "../lib/api.js";
import { Button, Field, Input, Modal, useToast } from "./ui.js";
import { parseMoney } from "../lib/format.js";

export default function TransferModal({
  open,
  onClose,
  direction,
  walletBalance,
  investmentCash,
  initialAmount,
}: {
  open: boolean;
  onClose: () => void;
  direction: "WALLET_TO_INVESTMENT" | "INVESTMENT_TO_WALLET";
  walletBalance: string;
  investmentCash: string;
  initialAmount?: string;
}) {
  const [amount, setAmount] = useState(initialAmount ?? "100");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const { push } = useToast();

  const source =
    direction === "WALLET_TO_INVESTMENT" ? walletBalance : investmentCash;

  const submit = async () => {
    const parsed = parseMoney(amount);
    if (!parsed || Number(parsed) <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/api/wallet/transfer", { direction, amount: parsed });
      push(
        `Transferred $${Number(parsed).toFixed(2)} ${
          direction === "WALLET_TO_INVESTMENT"
            ? "to Investment Account"
            : "to Wallet"
        }.`,
        "success",
      );
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      onClose();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Transfer failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={direction === "WALLET_TO_INVESTMENT" ? "Transfer to Investment Account" : "Transfer to Wallet"}
    >
      <div className="space-y-4">
        <div className="card p-3.5 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-ink-dim">From</span>
            <span className="font-semibold">
              {direction === "WALLET_TO_INVESTMENT" ? "Wallet" : "Investment Account"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-dim">To</span>
            <span className="font-semibold">
              {direction === "WALLET_TO_INVESTMENT" ? "Investment Account" : "Wallet"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-dim">Available</span>
            <span className="tabular-nums">${source}</span>
          </div>
        </div>

        <Field label="Amount (CAD)" error={error ?? undefined}>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="100.00"
          />
        </Field>

        <div className="flex gap-1.5">
          {["50", "100", "200", "400"].map((v) => (
            <Button key={v} size="sm" variant="secondary" onClick={() => setAmount(v)}>
              ${v}
            </Button>
          ))}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setAmount(String(Number(source)))}
          >
            Max
          </Button>
        </div>

        <Button className="w-full" disabled={submitting} onClick={submit}>
          {submitting ? "Transferring…" : "Confirm Transfer"}
        </Button>
        <p className="text-xs text-ink-dim text-center">
          Virtual money only. Transfers are validated and recorded server-side.
        </p>
      </div>
    </Modal>
  );
}
