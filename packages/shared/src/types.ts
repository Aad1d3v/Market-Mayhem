/**
 * Shared domain types — single source of truth for API contracts
 * between the Express server and the React client.
 */

export type Role = "USER" | "ADMIN";

export type Market = "US" | "CA" | "AADI";

/** What kind of thing you can buy. */
export type AssetClass = "STOCK" | "ETF" | "CRYPTO" | "COMMODITY" | "BOND";

export const ASSET_CLASSES: AssetClass[] = ["STOCK", "ETF", "CRYPTO", "COMMODITY", "BOND"];

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  STOCK: "Stocks",
  ETF: "ETFs & Funds",
  CRYPTO: "Crypto",
  COMMODITY: "Commodities",
  BOND: "Bonds",
};

export const MARKET_LABELS: Record<Market, string> = {
  US: "US",
  CA: "Canada",
  AADI: "AadiVerse",
};

export interface StockMeta {
  symbol: string;
  name: string;
  exchange: string;
  market: Market;
  assetClass: AssetClass;
  sector: string;
  description: string;
}

export type DataLabel = "SIMULATED";

export type MarketRegime = "NORMAL" | "BULL" | "BEAR" | "CRASH" | "RECOVERY" | "VOLATILE";

export interface MarketStateView {
  regime: MarketRegime;
  regimeLabel: string;
  regimeEmoji: string;
  regimeBlurb: string;
  /** −1 (fear) .. +1 (greed) */
  sentiment: number;
  indexChangePercent: number;
  breadth: number;
  volatility: number;
  sectorsUp: number;
  sectorsDown: number;
}

export type NewsCategory =
  | "EARNINGS"
  | "MANAGEMENT"
  | "PRODUCT"
  | "LEGAL"
  | "ANALYST"
  | "MACRO"
  | "SECTOR"
  | "CRISIS"
  | "DIVIDEND";

export type NewsSentiment = "POSITIVE" | "NEGATIVE" | "NEUTRAL";

export interface NewsView extends NewsItem {
  category: NewsCategory;
  sentiment: NewsSentiment;
  /** −3 .. +3 — how hard the story should hit. */
  severity: number;
  sectors: string[];
}

export interface SectorHeatRow {
  sector: string;
  changePercent: number;
  listings: number;
}

export interface Quote {
  symbol: string;
  name: string;
  exchange: string;
  market: Market;
  assetClass: AssetClass;
  sector: string;
  price: string;
  change: string;
  changePercent: string;
  dayHigh: string;
  dayLow: string;
  volume: number;
  /** Simulated event currently pushing this price around, if any. */
  event: MarketEventView | null;
  label: DataLabel;
}

/** A simulated scenario that is moving prices right now (crash, rally, frenzy…). */
export interface MarketEventView {
  key: string;
  name: string;
  headline: string;
  description: string;
  /** Multiplier applied to base prices: 0.68 = a 32% crash, 1.25 = a rally. */
  modifier: number;
  percentChange: number;
  scope: "ALL" | "ASSET_CLASS" | "SECTOR" | "SYMBOL" | "MARKET" | "MANUAL";
  target: string | null;
  severity: "crash" | "rally" | "wild";
  startedAt: string;
  endsAt: string;
}

export interface UpcomingEventView {
  key: string;
  name: string;
  teaser: string;
  startsAt: string;
  severity: "crash" | "rally" | "wild";
}

export interface Candle {
  time: string; // ISO timestamp
  open: string;
  high: string;
  low: string;
  close: string;
  volume: number;
}

export interface MarketStatus {
  isOpen: boolean;
  nextChange: string | null;
  note: string;
}

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  publishedAt: string;
  symbols: string[];
  label: DataLabel;
}

export interface CompanyProfile extends StockMeta {
  marketCap: string;
  week52High: string;
  week52Low: string;
  averageVolume: number;
  peRatio: string | null;
  dividendYield: string | null;
  /** Label for what the "dividend yield" column means for this asset class. */
  yieldLabel: string;
}

export interface AuthUser {
  id: string;
  username: string;
  displayName: string | null;
  email: string;
  role: Role;
  emailVerified: boolean;
  level: number;
  xp: number;
  avatarColor: string;
  tutorialCompleted: boolean;
  leaderboardVisible: boolean;
  notificationPrefs: NotificationPrefs;
  createdAt: string;
  achievementCount: number;
}

export interface NotificationPrefs {
  orderFilled: boolean;
  achievements: boolean;
  learning: boolean;
  marketEvents: boolean;
  support: boolean;
}

export interface WalletState {
  walletBalance: string;
  investmentCash: string;
  label: DataLabel;
}

export interface HoldingView {
  id: string;
  symbol: string;
  company: string;
  shares: string;
  averageCost: string;
  currentPrice: string;
  marketValue: string;
  totalCost: string;
  unrealizedPL: string;
  unrealizedPLPercent: string;
  dayChangePercent: string;
}

export interface PortfolioSummary {
  holdings: HoldingView[];
  investedMarketValue: string;
  investmentCash: string;
  investmentAccountValue: string;
  walletBalance: string;
  totalAccountValue: string;
  totalReturn: string;
  totalReturnPercent: string;
  todayChange: string;
  todayChangePercent: string;
  label: DataLabel;
}

export type TransactionKind =
  | "STARTING_BALANCE"
  | "WALLET_TO_INVESTMENT"
  | "INVESTMENT_TO_WALLET"
  | "BUY"
  | "SELL"
  | "SIMULATION_PROFIT";

export interface LedgerEntry {
  id: string;
  kind: TransactionKind;
  amount: string;
  account: "WALLET" | "INVESTMENT";
  symbol: string | null;
  description: string;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  type: TransactionKind | "ACHIEVEMENT" | "XP" | "LESSON" | "QUIZ" | "EVENT";
  title: string;
  detail: string | null;
  amount: string | null;
  createdAt: string;
}

export type OrderSide = "BUY" | "SELL";
export type OrderStatus = "FILLED" | "REJECTED" | "CANCELLED";

export interface OrderView {
  id: string;
  side: OrderSide;
  symbol: string;
  quantity: string;
  price: string | null;
  total: string | null;
  status: OrderStatus;
  reason: string | null;
  createdAt: string;
}

export interface WatchlistItemView {
  symbol: string;
  company: string;
  price: string;
  change: string;
  changePercent: string;
  spark: number[];
}

export interface LessonSummary {
  id: string;
  slug: string;
  title: string;
  category: string;
  estimatedMinutes: number;
  xpReward: number;
  completed: boolean;
  quizBestScore: number | null;
}

export interface LessonDetail extends LessonSummary {
  body: string;
  example: string;
  quiz: QuizQuestionView[];
}

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestionView {
  id: string;
  prompt: string;
  options: QuizOption[];
}

export interface QuizAnswerResult {
  questionId: string;
  correctOptionId: string;
  chosenOptionId: string | null;
  correct: boolean;
  explanation: string;
}

export interface QuizAttemptResult {
  attemptId: string;
  score: number;
  total: number;
  passed: boolean;
  xpAwarded: number;
  answers: QuizAnswerResult[];
}

export interface AchievementView {
  code: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface TicketView {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  createdAt: string;
  updatedAt: string;
  messages: TicketMessageView[];
}

export interface TicketMessageView {
  id: string;
  authorName: string;
  authorRole: Role;
  body: string;
  createdAt: string;
}

export interface LeaderboardRow {
  rank: number;
  username: string;
  level: number;
  portfolioValue: string;
  returnPercent: string;
  isSelf: boolean;
}

export interface DashboardSnapshotPoint {
  date: string;
  value: string;
}

export interface DailyChallenge {
  key: string;
  title: string;
  description: string;
  reward: string;
  progress: number;
  target: number;
  completed: boolean;
}

export interface ApiError {
  error: string;
  code?: string;
  fields?: Record<string, string>;
}

export const LESSON_CATEGORIES = [
  "Basics",
  "Markets",
  "Stocks",
  "Risk",
  "Portfolio Management",
  "Advanced Basics",
] as const;

export const TICKET_CATEGORIES = [
  "Account",
  "Technical",
  "Trading Simulator",
  "Market Data",
  "Bug",
  "Other",
] as const;
