import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { formatCad, formatDateTime } from "../lib/format.js";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "../components/ui.js";
import { useWallet } from "../components/StockHooks.js";
import TransferModal from "../components/TransferModal.js";

interface LedgerRow {
  id: string;
  kind: string;
  amount: string;
  account: string;
  symbol: string | null;
  description: string;
  createdAt: string;
}

export default function WalletPage() {
  const { data, isLoading, error, refetch } = useWallet();
  const [modal, setModal] = useState<null | "WALLET_TO_INVESTMENT" | "INVESTMENT_TO_WALLET">(null);

  const { data: ledger } = useQuery({
    queryKey: ["wallet-ledger"],
    queryFn: () => api.get<{ items: LedgerRow[]; total: number }>("/api/wallet/transactions?limit=100"),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error || !data) {
    return <ErrorState message="We couldn't load your wallet." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Wallet</h1>
        <p className="text-sm text-ink-dim mt-0.5">
          Two accounts, clearly separated. Virtual CAD only.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-3">
        <Card className="!p-6">
          <p className="text-xs uppercase tracking-wide text-ink-dim">Wallet</p>
          <p className="text-4xl font-bold tabular-nums mt-2">
            {formatCad(Number(data.walletBalance))}
          </p>
          <p className="text-xs text-ink-faint mt-1">Your bank inside the game.</p>
          <Button
            className="mt-4 w-full"
            onClick={() => setModal("WALLET_TO_INVESTMENT")}
            disabled={Number(data.walletBalance) <= 0}
          >
            Transfer to Investment Account →
          </Button>
        </Card>
        <Card className="!p-6">
          <p className="text-xs uppercase tracking-wide text-ink-dim">Investment Account</p>
          <p className="text-4xl font-bold tabular-nums mt-2">
            {formatCad(Number(data.investmentCash))}
          </p>
          <p className="text-xs text-ink-faint mt-1">Cash available for trading.</p>
          <Button
            variant="secondary"
            className="mt-4 w-full"
            onClick={() => setModal("INVESTMENT_TO_WALLET")}
            disabled={Number(data.investmentCash) <= 0}
          >
            ← Transfer to Wallet
          </Button>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Transaction History" />
        {!ledger || ledger.items.length === 0 ? (
          <p className="text-sm text-ink-dim py-6 text-center">
            No transactions yet. Your $800 starting balance appears here once seeded.
          </p>
        ) : (
          <div className="divide-y divide-edge-soft">
            {ledger.items.map((t) => {
              const n = Number(t.amount);
              return (
                <div key={t.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{t.description}</p>
                    <p className="text-xs text-ink-faint">
                      {formatDateTime(t.createdAt)} · {t.account === "WALLET" ? "Wallet" : "Investment"}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${n >= 0 ? "text-up" : "text-ink"}`}>
                    {n >= 0 ? "+" : ""}
                    {formatCad(n).replace("$", "$")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {modal && data && (
        <TransferModal
          open
          onClose={() => setModal(null)}
          direction={modal}
          walletBalance={data.walletBalance}
          investmentCash={data.investmentCash}
        />
      )}
    </div>
  );
}
