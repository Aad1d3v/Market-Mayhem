import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth-context.js";
import { Button, Card, Modal, useToast } from "../components/ui.js";
import { PriceChart, type CandlePoint } from "../components/charts.js";
import TransferModal from "../components/TransferModal.js";
import { useStock } from "../components/StockHooks.js";
import { simulationBuy } from "./tutorialActions.js";

interface TutorialState {
  currentStep: number;
  completed: boolean;
}

/**
 * Interactive tutorial — uses the REAL application UI and performs REAL
 * simulated transactions (the $200 transfer and the 5-share demo buy).
 * Progress is persisted server-side; skipping saves completion.
 */
export default function TutorialHost() {
  const { user, refresh } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { push } = useToast();

  const [step, setStep] = useState<number | null>(null); // null = inactive
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [transferDone, setTransferDone] = useState(false);
  const [buyDone, setBuyDone] = useState(false);

  const { data: tutorial } = useQuery({
    queryKey: ["tutorial"],
    queryFn: () => api.get<TutorialState>("/api/tutorial"),
    enabled: Boolean(user),
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => api.get<{ walletBalance: string; investmentCash: string }>("/api/wallet"),
    enabled: Boolean(user),
  });

  const demoCandles = useMemo<CandlePoint[]>(() => {
    // AADIDEV (Aadidev.co) illustrative series for the "prices move" step.
    return [
      { time: "1", close: "20.00" },
      { time: "2", close: "18.00" },
      { time: "3", close: "23.00" },
      { time: "4", close: "21.00" },
    ];
  }, []);

  // Show welcome modal once, only for users who never started the tutorial.
  useEffect(() => {
    if (
      user &&
      tutorial &&
      !tutorial.completed &&
      tutorial.currentStep === 0 &&
      !welcomeOpen &&
      step === null
    ) {
      const seen = sessionStorage.getItem("aadi_welcome_shown");
      if (!seen) {
        setWelcomeOpen(true);
        sessionStorage.setItem("aadi_welcome_shown", "1");
      }
    }
  }, [user, tutorial, welcomeOpen, step]);

  if (!user) return null;

  const isAppPage = !["/"].includes(location.pathname);
  const saveStep = async (n: number) => {
    setStep(n);
    await api.post("/api/tutorial/step", { currentStep: n }).catch(() => {});
  };

  const startTutorial = () => {
    setWelcomeOpen(false);
    setStep(0);
    navigate("/wallet");
  };

  const skipTutorial = async () => {
    setWelcomeOpen(false);
    setStep(null);
    await api.post("/api/tutorial/complete", { skipped: true }).catch(() => {});
    await refresh();
  };

  const finish = async () => {
    setStep(null);
    await api.post("/api/tutorial/complete", { skipped: false }).catch(() => {});
    await refresh();
    queryClient.invalidateQueries();
    push("Tutorial complete! +100 XP", "success");
    navigate("/dashboard");
  };

  const overlay =
    step !== null &&
    isAppPage &&
    tutorial &&
    !tutorial.completed;

  return (
    <>
      {/* ---------- Welcome modal ---------- */}
      <Modal open={welcomeOpen} onClose={() => setWelcomeOpen(false)} title="Welcome to Market Mayhem" wide>
        <div className="space-y-4 text-center py-2">
          <div className="text-5xl" aria-hidden>🎉</div>
          <p className="text-[15px] text-ink-dim max-w-md mx-auto">
            You've got <span className="text-ink font-bold">$800 of virtual cash</span> — and
            <span className="text-ink font-bold"> 1 free share of Aadidev.co</span>, the house
            listing, already sitting in your portfolio. Before you start trading, let's learn how the
            market works.
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
            <Card className="!p-4">
              <p className="text-xs uppercase text-ink-dim">Wallet</p>
              <p className="text-2xl font-bold tabular-nums mt-1">${wallet?.walletBalance ?? "800.00"}</p>
            </Card>
            <Card className="!p-4">
              <p className="text-xs uppercase text-ink-dim">Investment Account</p>
              <p className="text-2xl font-bold tabular-nums mt-1">${wallet?.investmentCash ?? "0.00"}</p>
            </Card>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
            <Button size="lg" onClick={startTutorial}>Start Tutorial</Button>
            <Button size="lg" variant="secondary" onClick={skipTutorial}>
              Skip Tutorial
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---------- Tutorial steps (hidden while an action modal is open) ---------- */}
      {overlay && !transferOpen && !buyOpen && (
        <div className="fixed inset-0 z-[45] pointer-events-none" aria-live="polite">
          {/* Step 0 — Wallet */}
          {step === 0 && (
            <SpotlightCard
              title="Your Wallet"
              text="You start with $800 of virtual cash. Think of this as your bank balance inside the game."
              onNext={() => saveStep(1)}
              progress={{ step: 0, total: 10 }}
            />
          )}

          {/* Step 1 — Transfer (real action) */}
          {step === 1 && (
            <SpotlightCard
              title="Transfer money to invest"
              text="Money in your wallet isn't available for trading yet. Move some into your Investment Account — let's transfer $200 for real."
              onNext={() => (transferDone ? saveStep(2) : setTransferOpen(true))}
              nextLabel={transferDone ? "Next" : "Open Transfer"}
              progress={{ step: 1, total: 10 }}
            />
          )}

          {/* Step 2 — What is a stock */}
          {step === 2 && (
            <SpotlightCard
              title="What is a stock?"
              text="A stock represents a small piece of ownership in a public company."
              progress={{ step: 2, total: 10 }}
            >
              <Card className="!bg-bg-soft mt-3 flex items-center justify-between">
                <div className="text-left">
                  <p className="font-bold">AADIDEV</p>
                  <p className="text-xs text-ink-dim">Aadidev.co — the house listing</p>
                </div>
                <p className="text-2xl font-bold tabular-nums">$20.00</p>
              </Card>
              <Button className="mt-4 w-full" onClick={() => saveStep(3)}>
                Next
              </Button>
            </SpotlightCard>
          )}

          {/* Step 3 — Prices move */}
          {step === 3 && (
            <SpotlightCard
              title="Stock prices move over time"
              text="Prices can rise and fall. There are no guaranteed profits."
              progress={{ step: 3, total: 10 }}
            >
              <div className="mt-3">
                <PriceChart data={demoCandles} spanDays={1} height={160} />
              </div>
              <p className="text-xs text-ink-faint mt-2 text-center">$20 → $18 → $23 → $21</p>
              <Button className="mt-4 w-full" onClick={() => saveStep(4)}>
                Next
              </Button>
            </SpotlightCard>
          )}

          {/* Step 4 — Real demo buy */}
          {step === 4 && (
            <SpotlightCard
              title="Let's buy — for real (simulated)"
              text="This actually executes: 5 shares of AADIDEV at roughly $20.00 ≈ $100.00 from your investment account. You already own one gifted share on top of that."
              onNext={() => (buyDone ? saveStep(5) : setBuyOpen(true))}
              nextLabel={buyDone ? "Next" : "Buy 5 shares"}
              progress={{ step: 4, total: 10 }}
            />
          )}

          {/* Step 5 — Portfolio */}
          {step === 5 && (
            <SpotlightCard
              title="Your portfolio"
              text="Your portfolio contains the investments you own."
              onNext={() => saveStep(6)}
              progress={{ step: 5, total: 10 }}
            >
              <div className="grid grid-cols-2 gap-2 mt-3 text-left">
                <MiniStat label="Shares" value="6 (5 bought + 1 gift)" />
                <MiniStat label="Average cost" value="≈ $20.00" />
                <MiniStat label="Current value" value="≈ $120.00" />
                <MiniStat label="Profit / loss" value="moves with price" />
              </div>
              <Button className="mt-4 w-full" onClick={() => saveStep(6)} variant="secondary">
                Open Portfolio
              </Button>
              <Button className="mt-2 w-full" onClick={() => saveStep(6)}>
                Next
              </Button>
            </SpotlightCard>
          )}

          {/* Step 6 — Up and down */}
          {step === 6 && (
            <SpotlightCard
              title="Gains and losses"
              text="If the price rises, your position increases in value. The opposite can happen too."
              progress={{ step: 6, total: 10 }}
            >
              <div className="grid grid-cols-2 gap-2 mt-3 text-left">
                <Card className="!p-3 !bg-up-soft">
                  <p className="text-xs text-up font-semibold">Price rises to $23</p>
                  <p className="text-sm mt-1">5 × $23 = $115</p>
                  <p className="text-sm text-up font-semibold">+$15 profit</p>
                </Card>
                <Card className="!p-3 !bg-down-soft">
                  <p className="text-xs text-down font-semibold">Price falls to $17</p>
                  <p className="text-sm mt-1">5 × $17 = $85</p>
                  <p className="text-sm text-down font-semibold">−$15 loss</p>
                </Card>
              </div>
              <Button className="mt-4 w-full" onClick={() => saveStep(7)}>
                Next
              </Button>
            </SpotlightCard>
          )}

          {/* Step 7 — Bull & bear */}
          {step === 7 && (
            <SpotlightCard
              title="Bull & bear markets"
              text="Bull: prices are generally rising. Bear: prices are generally falling."
              progress={{ step: 7, total: 10 }}
            >
              <div className="flex items-center justify-center gap-8 mt-4 text-4xl" aria-hidden>
                <span title="Bull market — rising">🐂📈</span>
                <span title="Bear market — falling">🐻📉</span>
              </div>
              <Button className="mt-4 w-full" onClick={() => saveStep(8)}>
                Next
              </Button>
            </SpotlightCard>
          )}

          {/* Step 8 — Diversification */}
          {step === 8 && (
            <SpotlightCard
              title="Diversification"
              text="Owning different investments can reduce reliance on one company or sector, although diversification does not eliminate risk."
              progress={{ step: 8, total: 10 }}
            >
              <div className="grid grid-cols-4 gap-2 mt-3 text-center text-xs">
                {["Technology", "Healthcare", "Consumer", "Financials"].map((s) => (
                  <Card key={s} className="!p-2.5">{s}</Card>
                ))}
              </div>
              <Button className="mt-4 w-full" onClick={() => saveStep(9)}>
                Next
              </Button>
            </SpotlightCard>
          )}

          {/* Step 9 — Finish */}
          {step === 9 && (
            <SpotlightCard
              title="You've learned the basics!"
              text="Transfer, buy, hold, and watch your portfolio — all simulated, all yours to explore."
              onNext={finish}
              nextLabel="Enter Market Mayhem"
              progress={{ step: 9, total: 10 }}
            >
              <Button variant="secondary" className="mt-3 w-full" onClick={finish}>
                Finish & Review Later
              </Button>
            </SpotlightCard>
          )}
        </div>
      )}

      {/* Real transfer modal (tutorial-driven) */}
      {transferOpen && wallet && (
        <TransferModal
          open
          direction="WALLET_TO_INVESTMENT"
          walletBalance={wallet.walletBalance}
          investmentCash={wallet.investmentCash}
          initialAmount="200"
          onClose={async () => {
            setTransferOpen(false);
            // Verify the transfer actually happened before unlocking Next.
            try {
              const fresh = await api.get<{ walletBalance: string; investmentCash: string }>(
                "/api/wallet",
              );
              if (Number(fresh.investmentCash) > 0) {
                setTransferDone(true);
                push("Transfer complete — Wallet $600, Investment $200!", "success");
              }
            } catch {
              /* ignore */
            }
            queryClient.invalidateQueries({ queryKey: ["wallet"] });
          }}
        />
      )}

      {/* Real demo buy (tutorial-driven, server-executed) */}
      {buyOpen && (
        <TutorialBuyModal
          onClose={async (ok) => {
            setBuyOpen(false);
            if (ok) {
              setBuyDone(true);
              queryClient.invalidateQueries();
            }
          }}
        />
      )}
    </>
  );
}

/* ---------- helpers ---------- */

function SpotlightCard({
  title,
  text,
  children,
  onNext,
  nextLabel = "Next",
  progress,
  locked,
}: {
  title: string;
  text: string;
  children?: React.ReactNode;
  onNext?: () => void;
  nextLabel?: string;
  progress?: { step: number; total: number };
  locked?: boolean;
}) {
  return (
    <div className="absolute inset-x-0 bottom-16 lg:bottom-8 lg:left-64 flex justify-center px-4 pointer-events-auto">
      <Card className="w-full max-w-md shadow-2xl border-brand/40 animate-pop-in">
        <div className="flex items-center justify-between mb-2">
          <span className="badge bg-brand/10 text-brand-strong border border-brand/20">
            Tutorial {progress ? `· ${progress.step + 1}/${progress.total}` : ""}
          </span>
        </div>
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="text-sm text-ink-dim mt-1">{text}</p>
        {children}
        {onNext && (
          <Button className="mt-4 w-full" onClick={onNext} disabled={locked}>
            {nextLabel}
            {locked ? " (complete the action first)" : ""}
          </Button>
        )}
      </Card>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="!p-3 text-left">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

/**
 * Executes the REAL tutorial buy: 5 × AADIDEV (Aadidev.co) @ market, server-side.
 */
function TutorialBuyModal({ onClose }: { onClose: (ok: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();
  const { data: stock } = useStock("AADIDEV");
  const price = Number(stock?.quote.price ?? 20);

  const buy = async () => {
    setBusy(true);
    setError(null);
    try {
      await simulationBuy("5");
      push(`Bought 5 AADIDEV at about $${price.toFixed(2)} per share.`, "success");
      onClose(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Buy failed.");
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={() => onClose(false)} title="Buy 5 × AADIDEV (Aadidev.co)">
      <div className="space-y-4">
        <div className="card !bg-bg-soft p-3.5 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-dim">Shares</span>
            <span className="font-semibold">5</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-dim">Price (live, simulated)</span>
            <span className="tabular-nums">${price.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-edge-soft pt-1.5">
            <span className="text-ink-dim">Estimated total</span>
            <span className="font-bold tabular-nums">${(price * 5).toFixed(2)}</span>
          </div>
        </div>
        {error && <p className="text-sm text-down">{error}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => onClose(false)}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={busy} onClick={buy}>
            {busy ? "Buying…" : "Buy"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
