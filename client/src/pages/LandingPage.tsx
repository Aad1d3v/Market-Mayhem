import { Link } from "react-router-dom";
import { Button, SimulatedBadge } from "../components/ui.js";

const STEPS = [
  { n: 1, title: "Create your free account", detail: "No card, no real money — ever." },
  { n: 2, title: "Get $800 + a free share", detail: "Virtual cash, plus 1 share of Aadidev.co." },
  { n: 3, title: "Learn how investing works", detail: "Interactive tutorial + 14 lessons." },
  { n: 4, title: "Buy anything you like", detail: "Stocks, ETFs, crypto, commodities, bonds." },
  { n: 5, title: "Survive the chaos", detail: "Flash crashes, meme frenzies, bailout rallies." },
  { n: 6, title: "Run what-if simulations", detail: "Invent a fake future and keep the profit." },
];

export default function LandingPage() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <span className="font-bold text-lg">Market Mayhem</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link to="/register">
            <Button size="sm">Start for Free</Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 pt-14 pb-10 text-center">
          <SimulatedBadge className="mb-6" />
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-4">
            Learn the market.{" "}
            <span className="text-brand-strong">Risk nothing.</span>
          </h1>
          <p className="text-lg text-ink-dim max-w-2xl mx-auto mb-8">
            Trade 300+ simulated listings — stocks, funds, crypto, commodities and bonds — with
            $800 of virtual cash and one free share of Aadidev.co. Survive crashes, run what-if
            simulations, learn by doing.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <Link to="/register">
              <Button size="lg" className="w-full sm:w-auto">Start for Free</Button>
            </Link>
            <a href="#how-it-works">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                How It Works
              </Button>
            </a>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {["$800 + 1 Free Share", "300+ Listings", "Market Crashes", "Chaos Lab"].map(
              (t) => (
                <div key={t} className="card px-4 py-3 text-sm font-semibold">
                  {t}
                </div>
              ),
            )}
          </div>

          <p className="mt-8 text-xs text-ink-faint max-w-xl mx-auto">
            Market Mayhem is an educational stock-market simulation. No real money is deposited,
            invested, or withdrawn.
          </p>
        </section>

        {/* Chart flourish */}
        <section className="max-w-4xl mx-auto px-6 pb-16">
          <div className="card p-6">
            <svg viewBox="0 0 600 160" className="w-full" aria-hidden>
              <defs>
                <linearGradient id="hero-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 130 L60 110 L120 118 L180 90 L240 96 L300 66 L360 74 L420 48 L480 58 L540 30 L600 36 L600 160 L0 160 Z"
                fill="url(#hero-grad)"
              />
              <path
                d="M0 130 L60 110 L120 118 L180 90 L240 96 L300 66 L360 74 L420 48 L480 58 L540 30 L600 36"
                fill="none"
                stroke="#818cf8"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-center text-xs text-ink-faint mt-3">
              Illustrative simulated chart. The price pattern repeats every 50 simulated days.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="max-w-6xl mx-auto px-6 pb-16">
          <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {STEPS.map((s) => (
              <div key={s.n} className="card p-5">
                <div className="h-8 w-8 rounded-full bg-brand/15 text-brand-strong font-bold flex items-center justify-center mb-3">
                  {s.n}
                </div>
                <h3 className="font-semibold text-sm mb-1">{s.title}</h3>
                <p className="text-xs text-ink-dim">{s.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Feature sections */}
        <section className="max-w-6xl mx-auto px-6 pb-20 grid md:grid-cols-2 gap-3">
          <div className="card p-6">
            <h3 className="font-bold mb-1.5">📊 Real Market Data</h3>
            <p className="text-sm text-ink-dim">
              Familiar company names and market concepts are displayed while{" "}
              <span className="text-ink">all transactions remain simulated</span>. Every price in
              Market Mayhem is generated by a deterministic educational engine and is clearly
              labeled.
            </p>
          </div>
          <div className="card p-6">
            <h3 className="font-bold mb-1.5">💥 Crashes & Events</h3>
            <p className="text-sm text-ink-dim">
              Flash crashes, meme frenzies, oil shocks and bailout rallies hit the simulated market
              on a fixed timeline. Cash, diversification and nerve all matter.
            </p>
          </div>
          <div className="card p-6">
            <h3 className="font-bold mb-1.5">🔮 Chaos Lab</h3>
            <p className="text-sm text-ink-dim">
              Build your own scenario — “Apple +80% on a new phone” — trade a sandbox copy of your
              portfolio, and any profit you make is paid into your real Investment Account.
            </p>
          </div>
          <div className="card p-6">
            <h3 className="font-bold mb-1.5">🎓 Learn</h3>
            <p className="text-sm text-ink-dim">
              Fourteen bite-size lessons — stocks, ETFs, dividends, volatility, diversification,
              P/E, order types and more — each with a quiz.
            </p>
          </div>
          <div className="card p-6">
            <h3 className="font-bold mb-1.5">🛒 Practice</h3>
            <p className="text-sm text-ink-dim">
              Start with $800 CAD virtual cash, transfer to your investment account, and place
              simulated market orders with a real review-and-confirm flow.
            </p>
          </div>
          <div className="card p-6">
            <h3 className="font-bold mb-1.5">🏅 Progress</h3>
            <p className="text-sm text-ink-dim">
              Earn XP, unlock achievements, complete the daily challenge and climb the
              leaderboard — all game progression, none of it financial advice.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-edge-soft">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-ink-dim">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" className="h-6 w-6" />
            <span className="font-semibold text-ink">Market Mayhem</span>
            <span>· Educational simulation</span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
            <a href="#how-it-works" className="hover:text-ink">About</a>
            <Link to="/register" className="hover:text-ink">Learn</Link>
            <Link to="/login" className="hover:text-ink">Help</Link>
            <span title="Full legal pages ship with the production deployment">Privacy</span>
            <span title="Full legal pages ship with the production deployment">Terms</span>
            <span className="text-ink-faint">Simulation Disclaimer</span>
          </nav>
        </div>
        <p className="text-center text-xs text-ink-faint px-6 pb-8 max-w-3xl mx-auto">
          This application is an educational simulation. It does not provide investment advice and
          does not execute real trades. All market data is simulated.
        </p>
      </footer>
    </div>
  );
}
