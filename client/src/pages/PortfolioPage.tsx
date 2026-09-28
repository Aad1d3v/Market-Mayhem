import { Link } from "react-router-dom";
import { formatCad } from "@aadiinvest/shared";
import {
  Button,
  Card,
  Delta,
  EmptyState,
  ErrorState,
  SectionTitle,
  Skeleton,
} from "../components/ui.js";
import { AllocationPie } from "../components/charts.js";
import { usePortfolio } from "../components/StockHooks.js";

export default function PortfolioPage() {
  const { data, isLoading, error, refetch } = usePortfolio();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (error || !data) {
    return <ErrorState message="We couldn't load your portfolio." onRetry={() => refetch()} />;
  }

  const hasHoldings = data.holdings.length > 0;
  const slices = [
    ...data.holdings.map((h) => ({
      name: h.symbol,
      value: Number(h.marketValue),
    })),
    ...(Number(data.investmentCash) > 0
      ? [{ name: "Cash", value: Number(data.investmentCash) }]
      : []),
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-sm text-ink-dim mt-0.5">Investment account overview</p>
        </div>
        <Link to="/trade">
          <Button>Trade</Button>
        </Link>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="!p-4">
          <p className="text-xs text-ink-dim uppercase tracking-wide">Investment Account Value</p>
          <p className="text-2xl font-bold tabular-nums mt-1">
            {formatCad(Number(data.investmentAccountValue))}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-ink-dim uppercase tracking-wide">Invested</p>
          <p className="text-2xl font-bold tabular-nums mt-1">
            {formatCad(Number(data.investedMarketValue))}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-ink-dim uppercase tracking-wide">Cash</p>
          <p className="text-2xl font-bold tabular-nums mt-1">
            {formatCad(Number(data.investmentCash))}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-ink-dim uppercase tracking-wide">Total Return</p>
          <p className="text-xl font-bold tabular-nums mt-1">
            <Delta value={data.totalReturn} />
          </p>
          <p className="text-xs text-ink-faint">{data.totalReturnPercent}%</p>
        </Card>
      </div>

      {!hasHoldings ? (
        <Card>
          <EmptyState
            icon="🌱"
            title="$0 invested — Your portfolio is waiting."
            hint="Explore the simulated markets and make your first trade."
            action={
              <Link to="/markets">
                <Button>Explore Markets</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          {/* Holdings */}
          <Card className="!p-0 overflow-hidden">
            <div className="px-5 pt-5">
              <SectionTitle title="Holdings" />
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-faint border-b border-edge-soft">
                    <th className="px-5 py-3">Ticker</th>
                    <th className="px-5 py-3">Shares</th>
                    <th className="px-5 py-3 text-right">Avg Cost</th>
                    <th className="px-5 py-3 text-right">Price</th>
                    <th className="px-5 py-3 text-right">Market Value</th>
                    <th className="px-5 py-3 text-right">Unrealized P/L</th>
                    <th className="px-5 py-3 text-right">Return %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.holdings.map((h) => (
                    <tr key={h.id} className="border-b border-edge-soft last:border-0 hover:bg-card-hover/60">
                      <td className="px-5 py-3.5">
                        <Link to={`/stocks/${h.symbol}`} className="font-bold hover:text-brand-strong">
                          {h.symbol}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 tabular-nums">{Number(h.shares)}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums">${h.averageCost}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums">${h.currentPrice}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums">${h.marketValue}</td>
                      <td className="px-5 py-3.5 text-right">
                        <Delta value={h.unrealizedPL} className="text-xs" />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Delta value={h.unrealizedPLPercent} className="text-xs" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-edge-soft">
              {data.holdings.map((h) => (
                <Link key={h.id} to={`/stocks/${h.symbol}`} className="block px-4 py-3.5">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm">{h.symbol}</p>
                    <p className="text-sm tabular-nums">${h.marketValue}</p>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs text-ink-faint">
                    <span>{Number(h.shares)} shares @ ${h.averageCost}</span>
                    <Delta value={h.unrealizedPLPercent} className="text-xs" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          {/* Allocation */}
          <Card>
            <SectionTitle title="Allocation" />
            <div className="grid md:grid-cols-2 gap-4 items-center">
              <AllocationPie slices={slices} />
              <ul className="space-y-2 text-sm">
                {slices.map((s, i) => {
                  const total = slices.reduce((acc, x) => acc + x.value, 0);
                  const pct = total > 0 ? ((s.value / total) * 100).toFixed(1) : "0";
                  const colors = ["#6366f1", "#34d399", "#f59e0b", "#f87171", "#06b6d4", "#a78bfa", "#fbbf24", "#84cc16"];
                  return (
                    <li key={s.name} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-sm"
                          style={{ background: colors[i % colors.length] }}
                        />
                        {s.name}
                      </span>
                      <span className="tabular-nums text-ink-dim">{pct}%</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
