import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import type {
  AssetClass,
  Candle,
  CompanyProfile,
  Market,
  MarketEventView,
  MarketStatus,
  NewsItem,
  PortfolioSummary,
  Quote,
  UpcomingEventView,
  WalletState,
} from "@aadiinvest/shared";

export const TIMEFRAMES = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const TIMEFRAME_SPAN_DAYS: Record<Timeframe, number> = {
  "1D": 1,
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "6M": 182,
  "1Y": 365,
  "5Y": 1826,
};

export interface MarketsPayload {
  label: string;
  disclosure: string;
  status: MarketStatus;
  events: MarketEventView[];
  upcoming: UpcomingEventView | null;
  movers: { gainers: Quote[]; losers: Quote[] };
  sectors: string[];
  quotes: Quote[];
}

export function useMarkets(
  market: Market | "ALL" = "ALL",
  assetClass: AssetClass | "ALL" = "ALL",
) {
  return useQuery({
    queryKey: ["markets", market, assetClass],
    queryFn: () =>
      api.get<MarketsPayload>(
        `/api/markets?market=${market}&assetClass=${assetClass}`,
      ),
    refetchInterval: 30_000,
  });
}

/** Scenario events happening right now (crashes, rallies, frenzies). */
export function useMarketEvents() {
  return useQuery({
    queryKey: ["market-events"],
    queryFn: () =>
      api.get<{ events: MarketEventView[]; upcoming: UpcomingEventView | null }>(
        "/api/markets/events",
      ),
    refetchInterval: 60_000,
  });
}

export function useStock(symbol: string | undefined) {
  return useQuery({
    queryKey: ["stock", symbol],
    queryFn: () =>
      api.get<{
        label: string;
        disclosure: string;
        quote: Quote;
        profile: CompanyProfile;
        status: MarketStatus;
        news: NewsItem[];
      }>(`/api/stocks/${symbol}`),
    enabled: Boolean(symbol),
    refetchInterval: 20_000,
  });
}

export function useHistory(symbol: string | undefined, timeframe: Timeframe) {
  return useQuery({
    queryKey: ["history", symbol, timeframe],
    queryFn: () =>
      api.get<{ candles: Candle[] }>(
        `/api/stocks/${symbol}/history?timeframe=${timeframe}`,
      ),
    enabled: Boolean(symbol),
    staleTime: 20_000,
  });
}

export function useWallet() {
  return useQuery({
    queryKey: ["wallet"],
    queryFn: () => api.get<WalletState>("/api/wallet"),
  });
}

export function usePortfolio() {
  return useQuery({
    queryKey: ["portfolio"],
    queryFn: () => api.get<PortfolioSummary>("/api/portfolio"),
    refetchInterval: 30_000,
  });
}

export function useStockName(symbol: string): string {
  const { data } = useStock(symbol);
  return data?.quote.name ?? symbol;
}
