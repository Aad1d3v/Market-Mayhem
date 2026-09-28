/**
 * Market Mayhem seed — development data.
 * Run: npm run db:seed
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../server/src/utils/password";

const prisma = new PrismaClient();

const ACHIEVEMENTS = [
  { code: "FIRST_TRADE", name: "First Trade", description: "Place your first simulated trade.", icon: "🎯", xpReward: 100, order: 1 },
  { code: "FIRST_BUY", name: "Opening Position", description: "Buy your first shares.", icon: "🛒", xpReward: 50, order: 2 },
  { code: "FIRST_SELL", name: "Taking Profit", description: "Sell shares for the first time.", icon: "💰", xpReward: 50, order: 3 },
  { code: "FIRST_PROFIT", name: "In The Green", description: "Close a trade for more than you paid.", icon: "📈", xpReward: 75, order: 4 },
  { code: "FIRST_LOSS", name: "Lessons Cost Less", description: "Experience your first simulated loss.", icon: "📉", xpReward: 25, order: 5 },
  { code: "DIVERSIFIED", name: "Diversified", description: "Hold 4 or more different stocks at once.", icon: "🧺", order: 6, xpReward: 100 },
  { code: "FIVE_TRADES", name: "Getting Serious", description: "Complete 5 trades.", icon: "5️⃣", xpReward: 50, order: 7 },
  { code: "TEN_TRADES", name: "Double Digits", description: "Complete 10 trades.", icon: "🔟", xpReward: 100, order: 8 },
  { code: "TWENTY_FIVE_TRADES", name: "Market Regular", description: "Complete 25 trades.", icon: "🏅", xpReward: 200, order: 9 },
  { code: "FIFTY_TRADES", name: "Floor Veteran", description: "Complete 50 trades.", icon: "🎖️", xpReward: 300, order: 10 },
  { code: "HUNDRED_TRADES", name: "Centurion", description: "Complete 100 trades. The floor knows your name.", icon: "💯", xpReward: 500, order: 11 },
  { code: "MARKET_SURVIVOR", name: "Market Survivor", description: "Experience both gains and losses.", icon: "🛡️", xpReward: 75, order: 12 },
  { code: "BULL_MARKET", name: "Bull Rider", description: "Hold a position while the simulated market rises 5%.", icon: "🐂", xpReward: 75, order: 13 },
  { code: "BEAR_MARKET", name: "Bear Handler", description: "Hold a position while the simulated market falls 5%.", icon: "🐻", xpReward: 75, order: 14 },
  { code: "LEARNER", name: "Student of the Market", description: "Complete your first lesson.", icon: "📚", xpReward: 25, order: 15 },
  { code: "QUIZ_MASTER", name: "Quiz Master", description: "Pass 3 quizzes.", icon: "🧠", xpReward: 100, order: 16 },
  { code: "PORTFOLIO_1000", name: "Four Figures", description: "Grow your investment account past $1,000.", icon: "💵", xpReward: 100, order: 17 },
  { code: "PORTFOLIO_5000", name: "High Five", description: "Grow your investment account past $5,000.", icon: "🏆", xpReward: 250, order: 18 },
  { code: "PORTFOLIO_10000", name: "Five Figures", description: "Grow your investment account past $10,000.", icon: "💎", xpReward: 400, order: 19 },
  { code: "PORTFOLIO_25000", name: "Whale Watch", description: "Grow your investment account past $25,000.", icon: "🐋", xpReward: 750, order: 20 },
  { code: "TUTORIAL_COMPLETE", name: "Ready to Trade", description: "Complete the interactive tutorial.", icon: "🎓", xpReward: 100, order: 0 },
  // --- Asset-class explorer series ---
  { code: "CRYPTO_CURIOUS", name: "Crypto Curious", description: "Own a simulated crypto asset. Volatility included at no extra charge.", icon: "🪙", xpReward: 75, order: 21 },
  { code: "GOLD_FINGER", name: "Gold Finger", description: "Own a precious metal — the classic hide-from-the-storm move.", icon: "🥇", xpReward: 75, order: 22 },
  { code: "BOND_HOLDER", name: "Slow and Steady", description: "Own a bond or cash-like listing. Boring is a strategy.", icon: "🧾", xpReward: 75, order: 23 },
  { code: "FUND_BELIEVER", name: "Basket Believer", description: "Own an ETF or fund — instant diversification in one ticket.", icon: "🧺", xpReward: 75, order: 24 },
  { code: "COMMODITY_TRADER", name: "Commodities Trader", description: "Own a commodity: oil, wheat, lithium, coffee — pick your poison.", icon: "🛢️", xpReward: 75, order: 25 },
  { code: "AADIVERSE_LOCAL", name: "AadiVerse Local", description: "Own a fictional AadiVerse listing. House rules apply.", icon: "🚀", xpReward: 75, order: 26 },
  { code: "CLASS_TOURIST", name: "Asset-Class Tourist", description: "Hold positions in 4 different asset classes at once.", icon: "🗺️", xpReward: 200, order: 27 },
  // --- Watchlist & habit series ---
  { code: "WATCHLIST_STARTER", name: "Window Shopper", description: "Add your first listing to the watchlist.", icon: "⭐", xpReward: 25, order: 28 },
  { code: "WATCHLIST_FIVE", name: "Scout", description: "Watch 5 listings at the same time.", icon: "🔭", xpReward: 50, order: 29 },
  { code: "WATCHLIST_TEN", name: "Market Analyst", description: "Watch 10 listings at the same time.", icon: "📊", xpReward: 100, order: 30 },
  { code: "WATCHLIST_HOARDER", name: "Watch Everything", description: "Watch 25 listings at once. You will not read them all.", icon: "👀", xpReward: 200, order: 31 },
  // --- Chaos Lab (what-if sandbox) series ---
  { code: "CHAOS_APPRENTICE", name: "Chaos Apprentice", description: "Credit your first profit from a Chaos Lab scenario sale.", icon: "🔮", xpReward: 75, order: 32 },
  { code: "CHAOS_JOURNEYMAN", name: "Journeyman of Chaos", description: "Credit $500 or more of total Chaos Lab profit.", icon: "🌀", xpReward: 150, order: 33 },
  { code: "CHAOS_LORD", name: "Chaos Lord", description: "Credit $2,500 or more of total Chaos Lab profit.", icon: "👑", xpReward: 300, order: 34 },
  // --- Streak & dedication series ---
  { code: "STREAK_3", name: "Warming Up", description: "Log in 3 days in a row.", icon: "🔥", xpReward: 50, order: 35 },
  { code: "STREAK_7", name: "Habit Forming", description: "Log in 7 days in a row.", icon: "📅", xpReward: 150, order: 36 },
  { code: "STREAK_30", name: "Iron Routine", description: "Log in 30 days in a row. Legendary consistency.", icon: "⛏️", xpReward: 500, order: 37 },
  { code: "NIGHT_OWL", name: "Night Owl", description: "Place a trade between 10 p.m. and 4 a.m. Crypto never sleeps.", icon: "🦉", xpReward: 50, order: 38 },
];

interface SeedQuiz {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface SeedLesson {
  slug: string;
  title: string;
  category: string;
  estimatedMinutes: number;
  body: string;
  example: string;
  quiz: SeedQuiz[];
}

const LESSONS: SeedLesson[] = [
  {
    slug: "what-is-a-stock",
    title: "What is a stock?",
    category: "Basics",
    estimatedMinutes: 4,
    body: "A stock represents a small piece of ownership in a public company. When you buy a share, you own a fraction of that company — its buildings, products and profits.\n\nCompanies sell shares to raise money. Investors buy them hoping the company grows, which can increase the share's value. Some companies also share profits through dividends.\n\nPrices move constantly as buyers and sellers disagree about what a company is worth. If more people want to buy than sell, the price tends to rise; if more want to sell, it tends to fall.",
    example: "Imagine AADI DEMO Corp. has 1,000 shares total. If you buy 5 shares, you own 0.5% of the company in this simulation. If the company does well and the price rises from $20.00 to $23.00, your 5 shares are now worth $115 instead of $100.",
    quiz: [
      {
        prompt: "What does owning a share of stock mean?",
        options: [
          "You loaned money to the company",
          "You own a small piece of the company",
          "You are guaranteed a profit",
          "You own the company's debts",
        ],
        correctIndex: 1,
        explanation: "A share is ownership. Loans are bonds — and profits are never guaranteed.",
      },
      {
        prompt: "What usually happens when more people want to buy a stock than sell it?",
        options: [
          "The price tends to fall",
          "The price tends to rise",
          "Nothing changes",
          "The company shuts down",
        ],
        correctIndex: 1,
        explanation: "Demand pushing against limited supply generally pushes the price up.",
      },
    ],
  },
  {
    slug: "what-is-an-etf",
    title: "What is an ETF?",
    category: "Basics",
    estimatedMinutes: 4,
    body: "An ETF (exchange-traded fund) is a basket of many investments that trades like a single stock. Buying one ETF share can give you a slice of hundreds of companies at once.\n\nETFs make diversification easy: instead of betting on one company, you spread your risk across many. Some ETFs track an index like the S&P 500; others focus on sectors, countries or themes.\n\nETFs usually have low fees, but they still go up and down — diversification reduces reliance on any single company, it does not eliminate risk.",
    example: "Instead of choosing between Apple, Microsoft and hundreds of others, an index ETF lets you own a tiny piece of all of them with one purchase.",
    quiz: [
      {
        prompt: "What is inside an ETF?",
        options: ["Only one company's stock", "A basket of many investments", "Only bonds", "Cash only"],
        correctIndex: 1,
        explanation: "An ETF bundles many investments into one tradable unit.",
      },
      {
        prompt: "Does owning an ETF eliminate risk?",
        options: ["Yes, always", "No, it reduces reliance on single companies but markets still fall", "Yes, if it tracks an index", "Only in a bear market"],
        correctIndex: 1,
        explanation: "Diversification spreads risk; it cannot remove it.",
      },
    ],
  },
  {
    slug: "what-is-a-dividend",
    title: "What is a dividend?",
    category: "Stocks",
    estimatedMinutes: 3,
    body: "Some companies share part of their profits with shareholders through dividends — regular cash payments, usually every quarter.\n\nDividend yield compares a year of dividends to the share price. A $50 stock paying $2 per year has a 4% yield.\n\nNot every company pays dividends. Young, fast-growing companies often reinvest profits instead. Dividend payments can also be reduced or stopped.",
    example: "If a simulated company pays $0.50 per share each quarter, a holder of 10 shares would collect $20 per year — in this simulation it is added to the investment account cash.",
    quiz: [
      {
        prompt: "A dividend is…",
        options: ["A fee you pay to the broker", "A share of company profits paid to shareholders", "A type of order", "A government bonus"],
        correctIndex: 1,
        explanation: "Dividends are profit distributions to shareholders.",
      },
      {
        prompt: "Do all companies pay dividends?",
        options: ["Yes", "No — many reinvest profits instead", "Only in Canada", "Only losing companies"],
        correctIndex: 1,
        explanation: "Growth companies often prefer reinvesting profits.",
      },
    ],
  },
  {
    slug: "what-is-a-market-index",
    title: "What is a market index?",
    category: "Markets",
    estimatedMinutes: 3,
    body: "A market index measures the performance of a group of stocks. It answers: 'how is the market doing overall?'\n\nFamous examples include the S&P 500 (500 large US companies), the Dow Jones Industrial Average (30 giants) and the S&P/TSX Composite (Canadian companies).\n\nIndexes are benchmarks. When people say 'the market was up today', they usually mean an index rose. You cannot buy an index directly, but you can buy ETFs that track one.",
    example: "If an index starts the year at 20,000 and ends at 22,000, it rose 10% — even though some members fell. Indexes summarize the group, not any single stock.",
    quiz: [
      {
        prompt: "A market index tracks…",
        options: ["One company's profit", "The performance of a group of stocks", "Interest rates only", "Your personal portfolio"],
        correctIndex: 1,
        explanation: "Indexes summarize groups of stocks.",
      },
      {
        prompt: "Which is a Canadian index?",
        options: ["S&P 500", "Nasdaq", "S&P/TSX Composite", "FTSE 100"],
        correctIndex: 2,
        explanation: "The S&P/TSX Composite covers the Canadian market.",
      },
    ],
  },
  {
    slug: "what-is-market-capitalization",
    title: "What is market capitalization?",
    category: "Stocks",
    estimatedMinutes: 3,
    body: "Market capitalization (market cap) is the total value of all a company's shares: share price × number of shares.\n\nLarge-cap (mega) companies are typically worth over $10 billion; mid-cap between $2–10 billion; small-cap under $2 billion. Bigger companies are often (not always!) more stable; smaller ones can grow faster but swing more.\n\nMarket cap changes with the price — a falling price shrinks the cap in real time.",
    example: "A simulated company with 100 million shares at $20.00 has a $2 billion market cap. If the price doubles, the cap doubles — the share count did not change.",
    quiz: [
      {
        prompt: "Market cap equals…",
        options: ["Company profit × 10", "Share price × total shares", "Total sales per year", "Cash in the bank"],
        correctIndex: 1,
        explanation: "It is price times share count — the company's total equity value.",
      },
      {
        prompt: "A company with a $2 billion market cap is generally…",
        options: ["Small-cap", "Mid-cap", "Large-cap", "Mega-cap"],
        correctIndex: 1,
        explanation: "Around $2–10 billion is commonly called mid-cap.",
      },
    ],
  },
  {
    slug: "what-is-volatility",
    title: "What is volatility?",
    category: "Risk",
    estimatedMinutes: 4,
    body: "Volatility describes how much a price swings. High volatility means big moves up and down; low volatility means calmer moves.\n\nVolatile investments can make money quickly — and lose it just as fast. Over a short window, they are simply less predictable.\n\nTime horizon matters: the longer you plan to hold, the more short-term swings matter less. But volatility never disappears.",
    example: "Simulated stock A moves ±1% on a typical day; simulated stock B moves ±5%. B is more volatile. A $100 investment in B could be worth $95 or $105 tomorrow — A might be $99 or $101.",
    quiz: [
      {
        prompt: "High volatility means…",
        options: ["Prices barely move", "Prices swing widely", "The company is bankrupt", "Dividends are higher"],
        correctIndex: 1,
        explanation: "Volatility is the size of price swings, not their direction.",
      },
      {
        prompt: "Volatile investments are…",
        options: ["Guaranteed profitable", "More unpredictable over short periods", "Always bad", "Risk-free"],
        correctIndex: 1,
        explanation: "Swings cut both ways; unpredictability is the risk.",
      },
    ],
  },
  {
    slug: "what-is-diversification",
    title: "What is diversification?",
    category: "Portfolio Management",
    estimatedMinutes: 4,
    body: "Diversification means spreading investments across different companies and sectors so no single outcome dominates your results.\n\nIf all your virtual money is in one tech stock, one bad product launch hurts everything. If you hold technology, healthcare, consumer and financial stocks, trouble in one area may be cushioned elsewhere.\n\nImportant: diversification reduces reliance on any one company or sector — it does not eliminate risk. In a broad market decline, most holdings fall together.",
    example: "With $800 in the simulation, you could split it: $200 in tech, $200 in consumer staples, $200 in financials, $200 kept as cash — instead of $800 in one stock.",
    quiz: [
      {
        prompt: "The main goal of diversification is to…",
        options: ["Maximize short-term profit", "Reduce reliance on any single investment", "Avoid all taxes", "Guarantee gains"],
        correctIndex: 1,
        explanation: "Spreading bets softens the blow when one investment stumbles.",
      },
      {
        prompt: "Diversification eliminates risk.",
        options: ["True", "False — it reduces concentration risk only", "True in bull markets", "True for ETFs"],
        correctIndex: 1,
        explanation: "Market-wide declines can still hit a diversified portfolio.",
      },
    ],
  },
  {
    slug: "what-is-a-bull-market",
    title: "What is a bull market?",
    category: "Markets",
    estimatedMinutes: 3,
    body: "A bull market is a period when prices are generally rising and optimism is high — typically defined as a 20%+ rise from recent lows.\n\nBulls attack upward with their horns — a memorable image for rising markets. In bull markets, more investors want in, which can push prices further up.\n\nCaution: bull markets do not last forever. Buying simply because prices are rising is how investors end up paying peak prices.",
    example: "In the simulation, a 'Bull Run' market event lifts most simulated stocks. Your holdings gain value — but remember the pattern repeats every 50 simulated days, and every event is fiction.",
    quiz: [
      {
        prompt: "A bull market is when prices are…",
        options: ["Generally falling", "Generally rising", "Flat", "Random"],
        correctIndex: 1,
        explanation: "Bulls thrust upward — rising markets.",
      },
      {
        prompt: "Bull markets last forever.",
        options: ["True", "False", "True since 2009", "Only for indexes"],
        correctIndex: 1,
        explanation: "Markets cycle. Every bull market in history has been followed by pullbacks.",
      },
    ],
  },
  {
    slug: "what-is-a-bear-market",
    title: "What is a bear market?",
    category: "Markets",
    estimatedMinutes: 3,
    body: "A bear market is a period when prices are generally falling — commonly a 20%+ decline from recent highs.\n\nBears swipe downward with their paws. Fear dominates: investors sell, which can push prices lower still.\n\nParadoxically, bear markets are when patient long-term investors can buy at lower prices. But catching the bottom is impossible to do reliably — even professionals fail at it.",
    example: "A simulated 'Market Pullback' event knocks simulated prices down. Your portfolio loses value on paper — a loss only becomes 'locked in' if you sell at the lower price.",
    quiz: [
      {
        prompt: "A bear market is when prices are…",
        options: ["Generally rising", "Generally falling", "Only tech stocks fall", "Trading halts"],
        correctIndex: 1,
        explanation: "Bears swipe down — falling markets.",
      },
      {
        prompt: "Your simulated portfolio fell 15%. You have…",
        options: ["Locked in a 15% loss", "An unrealized loss unless you sell", "Nothing to worry about ever", "Guaranteed recovery"],
        correctIndex: 1,
        explanation: "Paper losses are unrealized until sold — but they are still real risk.",
      },
    ],
  },
  {
    slug: "what-is-a-pe-ratio",
    title: "What is a P/E ratio?",
    category: "Advanced Basics",
    estimatedMinutes: 4,
    body: "The price-to-earnings ratio compares a company's share price to its annual profit per share: P/E = share price ÷ earnings per share.\n\nIt answers: 'how much are investors paying for each dollar of profit?' A P/E of 20 means $20 paid per $1 of yearly profit.\n\nHigh P/E can mean high growth expectations — or overvaluation. Low P/E can mean a bargain — or a struggling business. Context matters: compare within sectors.",
    example: "A simulated company earns $5 per share yearly; its price is $100. P/E = 100 ÷ 5 = 20. If earnings double and the price stays, the P/E halves to 10.",
    quiz: [
      {
        prompt: "P/E ratio compares…",
        options: ["Price to revenue", "Price to earnings per share", "Profit to employees", "Price to dividends"],
        correctIndex: 1,
        explanation: "It is the price paid per dollar of annual profit.",
      },
      {
        prompt: "A very high P/E might mean…",
        options: ["The company is worthless", "Investors expect high growth (or the stock is expensive)", "Dividends are guaranteed", "Nothing at all"],
        correctIndex: 1,
        explanation: "High P/E = high expectations, or a richly priced stock.",
      },
    ],
  },
  {
    slug: "what-is-a-limit-order",
    title: "What is a limit order?",
    category: "Advanced Basics",
    estimatedMinutes: 3,
    body: "A limit order tells your broker: 'buy or sell, but only at my price or better.'\n\nBuy limit: the most you're willing to pay. Sell limit: the least you're willing to accept. The order waits until the price reaches your level — which may never happen.\n\nContrast with a market order: buy or sell immediately at the current price. Market orders guarantee execution, not price. Limit orders promise price, not execution.",
    example: "A simulated stock trades at $20.00. You place a buy limit at $19.00. If the price dips, you buy cheaper. If it never dips, your order simply expires unfilled.",
    quiz: [
      {
        prompt: "A limit order…",
        options: ["Executes immediately at any price", "Executes only at your price or better", "Is illegal", "Only works for selling"],
        correctIndex: 1,
        explanation: "Limits set a price boundary; they may never fill.",
      },
      {
        prompt: "A market order guarantees…",
        options: ["A specific price", "Execution, not price", "Profit", "Tax advantages"],
        correctIndex: 1,
        explanation: "Market orders fill now at whatever the price is.",
      },
    ],
  },
  {
    slug: "what-is-compound-growth",
    title: "What is compound growth?",
    category: "Advanced Basics",
    estimatedMinutes: 4,
    body: "Compounding is growth on growth. When returns are reinvested, they start generating their own returns — the effect snowballs over time.\n\nThe Rule of 72 estimates doubling time: divide 72 by your annual return percentage. At 8% per year, money doubles roughly every 9 years.\n\nCompounding also works against you with debt: unpaid interest charges interest. And of course, markets do not deliver steady returns — real investing involves ups and downs.",
    example: "$100 growing 10% per year: $110 after year 1, $121 after year 2, $133 after 3. The extra $1 in year 2 came from the year-1 gains, not the original $100.",
    quiz: [
      {
        prompt: "Compound growth means…",
        options: ["Growth on your original deposit only", "Growth on growth — returns generating returns", "A bank fee", "Doubling every year"],
        correctIndex: 1,
        explanation: "Reinvested returns start earning their own returns.",
      },
      {
        prompt: "At 8% annual growth, $100 doubles in roughly…",
        options: ["4 years", "9 years", "18 years", "36 years"],
        correctIndex: 1,
        explanation: "Rule of 72: 72 ÷ 8 = 9 years.",
      },
    ],
  },
  {
    slug: "what-is-risk",
    title: "What is risk?",
    category: "Risk",
    estimatedMinutes: 4,
    body: "Risk is uncertainty about outcomes — including the chance of losing money. Every investment carries it; risk and potential return are linked.\n\nHigher potential returns usually require accepting higher risk of loss. Anyone promising high returns with no risk is describing a scam.\n\nManage risk by: diversifying, investing only what you can afford to lose, having a time horizon that lets you ride out dips, and never borrowing to speculate. In this simulator, every dollar is virtual — real markets hurt for real.",
    example: "Putting all $800 of virtual cash into one volatile stock could double it — or halve it. Splitting it across sectors and keeping some cash softens both outcomes.",
    quiz: [
      {
        prompt: "Risk means…",
        options: ["Only the chance of profit", "Uncertainty including the chance of loss", "A fee", "The same as volatility"],
        correctIndex: 1,
        explanation: "Risk is the possibility outcomes differ from expectations.",
      },
      {
        prompt: "'High returns, zero risk' offers are…",
        options: ["A great deal", "A hallmark of scams", "Standard bank products", "Guaranteed by governments"],
        correctIndex: 1,
        explanation: "Risk and return are linked — treat 'riskless riches' as fraud.",
      },
    ],
  },
  {
    slug: "what-is-a-market-order",
    title: "What is a market order?",
    category: "Advanced Basics",
    estimatedMinutes: 3,
    body: "A market order says: 'buy or sell right now at the best available price.'\n\nMarket orders prioritize speed over price. They almost always execute immediately during market hours — at whatever price the market currently offers.\n\nThey suit situations where being invested matters more than the exact price — for small, liquid stocks the difference is usually pennies. For thinly traded securities, prices can slip significantly.",
    example: "You buy 5 shares of a simulated stock at $20.00 with a market order and it fills at $20.01. That penny is the cost of immediacy. A limit at $20.00 might have saved it — or never filled.",
    quiz: [
      {
        prompt: "A market order executes…",
        options: ["At your chosen price only", "Immediately at the best available price", "Only at market open", "After 3 days"],
        correctIndex: 1,
        explanation: "Speed first, price second.",
      },
      {
        prompt: "Compared to a limit order, a market order…",
        options: ["Guarantees a better price", "Guarantees execution but not price", "Is riskier legally", "Earns dividends"],
        correctIndex: 1,
        explanation: "You trade price certainty for execution certainty.",
      },
    ],
  },
];

const MARKET_EVENTS = [
  { name: "Bull Run", description: "Simulated scenario: broad simulated prices drift upward.", modifier: 1.08 },
  { name: "Market Pullback", description: "Simulated scenario: broad simulated prices drift downward.", modifier: 0.92 },
  { name: "Volatility Spike", description: "Simulated scenario: larger intraday swings in simulated prices.", modifier: 1.0 },
  { name: "Recovery", description: "Simulated scenario: simulated prices recover after a dip.", modifier: 1.05 },
  { name: "Tech Rally", description: "Simulated scenario: simulated technology listings rise.", modifier: 1.1 },
  { name: "Market Crash", description: "Simulated scenario: a sharp simulated decline across listings.", modifier: 0.85 },
];

/**
 * The tutorial stock was renamed to AADIDEV (Aadidev.co) when the app became
 * Market Mayhem. Portfolios, orders, the ledger and watchlists may still hold
 * the old symbol, so migrate them in place.
 */
async function migrateLegacySymbols() {
  const renames: [string, string][] = [["AADI-DEMO", "AADIDEV"]];
  for (const [from, to] of renames) {
    const holdings = await prisma.holding.findMany({ where: { symbol: from } });
    for (const h of holdings) {
      const existing = await prisma.holding.findUnique({
        where: { userId_symbol: { userId: h.userId, symbol: to } },
      });
      if (existing) {
        // Merge: combine shares and keep a share-weighted average cost.
        const shares = existing.shares + h.shares;
        const cost =
          Math.round(
            (existing.averageCost * existing.shares + h.averageCost * h.shares) / shares,
          );
        await prisma.holding.update({
          where: { id: existing.id },
          data: { shares, averageCost: cost },
        });
        await prisma.holding.delete({ where: { id: h.id } });
      } else {
        await prisma.holding.update({ where: { id: h.id }, data: { symbol: to } });
      }
    }
    const [orders, txns, watched] = await Promise.all([
      prisma.order.updateMany({ where: { symbol: from }, data: { symbol: to } }),
      prisma.transaction.updateMany({ where: { symbol: from }, data: { symbol: to } }),
      prisma.watchlistItem.updateMany({ where: { symbol: from }, data: { symbol: to } }),
    ]);
    if (holdings.length + orders.count + txns.count + watched.count > 0) {
      console.log(
        `🔁 Migrated ${from} → ${to}: ${holdings.length} holdings, ${orders.count} orders, ${txns.count} ledger rows, ${watched.count} watchlist items`,
      );
    }
  }
}

async function main() {
  console.log("🌱 Seeding Market Mayhem development data…");

  // ---- Rename retired symbols before anything else touches portfolios ----
  await migrateLegacySymbols();

  // ---- Admin + documented dev test user ----
  // In production the admin credentials MUST come from the environment
  // (render.yaml generates a random ADMIN_PASSWORD) — never a default.
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@aadiinvest.local").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    if (process.env.NODE_ENV === "production") {
      console.error("❌ [Fatal] ADMIN_PASSWORD is not set. Refusing to seed a production admin with a default password.");
      console.error("   Set ADMIN_EMAIL and ADMIN_PASSWORD in the service's Environment settings.");
      process.exit(1);
    }
    console.warn("⚠️  ADMIN_PASSWORD unset — falling back to the development-only default (NOT for production).");
  }
  const adminPasswordFinal = adminPassword ?? "ChangeMe!Admin2026";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      username: "admin",
      usernameLower: "admin",
      email: adminEmail,
      passwordHash: await hashPassword(adminPasswordFinal),
      role: "ADMIN",
      emailVerified: true,
      displayName: "Administrator",
      avatarColor: "#f59e0b",
    },
  });
  await ensureAccounts(admin.id, admin.username);
  console.log(`👑 Admin: ${admin.email} (password from ADMIN_PASSWORD env)`);

  const devEmail = "dev@aadiinvest.local";
  const dev = await prisma.user.upsert({
    where: { email: devEmail },
    update: {},
    create: {
      username: "devtrader",
      usernameLower: "devtrader",
      email: devEmail,
      passwordHash: await hashPassword("DevTrader!2026"),
      emailVerified: true,
      displayName: "Dev Trader",
      avatarColor: "#6366f1",
    },
  });
  await ensureAccounts(dev.id, dev.username);
  console.log("🧪 Dev test user: dev@aadiinvest.local / DevTrader!2026 (development only)");

  // ---- Achievements ----
  for (const a of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { code: a.code },
      update: { name: a.name, description: a.description, icon: a.icon, xpReward: a.xpReward, order: a.order },
      create: a,
    });
  }
  console.log(`🏅 ${ACHIEVEMENTS.length} achievements`);

  // ---- Lessons + quizzes ----
  for (const [i, l] of LESSONS.entries()) {
    const lesson = await prisma.lesson.upsert({
      where: { slug: l.slug },
      update: {
        title: l.title,
        category: l.category,
        estimatedMinutes: l.estimatedMinutes,
        body: l.body,
        example: l.example,
        order: i,
      },
      create: {
        slug: l.slug,
        title: l.title,
        category: l.category,
        estimatedMinutes: l.estimatedMinutes,
        body: l.body,
        example: l.example,
        order: i,
      },
    });
    const existing = await prisma.quizQuestion.count({ where: { lessonId: lesson.id } });
    if (existing === 0) {
      for (const [qi, q] of l.quiz.entries()) {
        await prisma.quizQuestion.create({
          data: {
            lessonId: lesson.id,
            prompt: q.prompt,
            options: JSON.stringify(q.options),
            correctIndex: q.correctIndex,
            explanation: q.explanation,
            order: qi,
          },
        });
      }
    }
  }
  console.log(`📚 ${LESSONS.length} lessons with quizzes`);

  // ---- Market events (defined but inactive; admin can activate) ----
  for (const e of MARKET_EVENTS) {
    const found = await prisma.marketEvent.findFirst({ where: { name: e.name } });
    if (!found) {
      await prisma.marketEvent.create({ data: e });
    }
  }
  console.log(`📊 ${MARKET_EVENTS.length} simulated market events`);

  console.log("✅ Seed complete.");
}

async function ensureAccounts(userId: string, username: string) {
  await prisma.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: 80000 }, // $800.00 in cents
  });
  await prisma.investmentAccount.upsert({
    where: { userId },
    update: {},
    create: { userId, cash: 0 },
  });
  await prisma.tutorialProgress.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  await prisma.watchlist.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  const hasStart = await prisma.transaction.findFirst({
    where: { userId, kind: "STARTING_BALANCE" },
  });
  if (!hasStart) {
    await prisma.transaction.create({
      data: {
        userId,
        kind: "STARTING_BALANCE",
        amount: 80000, // cents
        account: "WALLET",
        description: "Starting balance — welcome to Market Mayhem!",
      },
    });
    await prisma.activityEvent.create({
      data: {
        userId,
        type: "STARTING_BALANCE",
        title: "Received starting balance",
        detail: "$800.00 CAD of virtual cash was added to your wallet.",
        amount: 80000, // cents
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
