/**
 * Scheduled scenario events — the part of the simulation that makes the
 * market dramatic: flash crashes, meme frenzies, oil shocks, crypto winters.
 *
 * Design rules:
 *  - An event is a PURE function of the simulated timeline. Events are pinned
 *    to `dayOfCycle` (0-49), so the whole 50-day pattern still repeats exactly
 *    and the same shock lands at the same point of every cycle.
 *  - Events never escape their window: a price at a time inside the window is
 *    multiplied by the event modifier, everything outside is untouched.
 *  - Events multiply: a crash during a rally is chaos, and that is the point.
 */

import type { AssetClass, Market, StockDef } from "./universe.js";

const DAY_MS = 24 * 3600 * 1000;
export const CYCLE_DAYS = 50;

export type EventScope = "ALL" | "ASSET_CLASS" | "SECTOR" | "SYMBOL" | "MARKET";
export type EventSeverity = "crash" | "rally" | "wild";

export interface ScheduledEvent {
  key: string;
  name: string;
  headline: string;
  description: string;
  scope: EventScope;
  target?: string;
  modifier: number; // 0.66 = -34%, 1.35 = +35%
  dayOfCycle: number; // 0-49
  startHour: number; // hours after UTC midnight
  durationHours: number;
  severity: EventSeverity;
}

export const SCHEDULED_EVENTS: ScheduledEvent[] = [
  {
    key: "launch-rally",
    name: "Launch Week Rally",
    headline: "Simulated markets rip higher as everyone piles in at once",
    description:
      "A fictional broad rally. Every listing drifts up while the crowd is euphoric — a good reminder that rallies feel amazing right before they don't last.",
    scope: "ALL",
    modifier: 1.09,
    dayOfCycle: 1,
    startHour: 13,
    durationHours: 6,
    severity: "rally",
  },
  {
    key: "tech-wreck",
    name: "Tech Wreck",
    headline: "Simulated tech selloff: multiples finally meet gravity",
    description:
      "A fictional selloff in technology listings. High-growth names fall hardest — concentration risk in one sector, in one afternoon.",
    scope: "SECTOR",
    target: "Technology",
    modifier: 0.82,
    dayOfCycle: 3,
    startHour: 14,
    durationHours: 5,
    severity: "crash",
  },
  {
    key: "meme-frenzy",
    name: "Meme Frenzy",
    headline: "Simulated internet crowd storms meme listings",
    description:
      "A fictional pile-on. Meme listings explode upward on pure hype while fundamentals stay exactly where they were.",
    scope: "SECTOR",
    target: "Meme",
    modifier: 1.18,
    dayOfCycle: 6,
    startHour: 13,
    durationHours: 7,
    severity: "wild",
  },
  {
    key: "flash-crash",
    name: "Flash Crash",
    headline: "Simulated flash crash: everything drops in minutes",
    description:
      "A fictional market-wide panic. Prices gap down ~26% in a couple of hours. Anyone who logged in without cash to spare learns why cash is a position.",
    scope: "ALL",
    modifier: 0.74,
    dayOfCycle: 8,
    startHour: 13,
    durationHours: 6,
    severity: "crash",
  },
  {
    key: "dead-cat-bounce",
    name: "Dead-Cat Bounce",
    headline: "Simulated bargain hunters flood back in",
    description:
      "A fictional rebound after the crash. Prices recover part of the drop — a textbook bounce, not a guarantee.",
    scope: "ALL",
    modifier: 1.12,
    dayOfCycle: 9,
    startHour: 13,
    durationHours: 5,
    severity: "rally",
  },
  {
    key: "oil-shock",
    name: "Oil Shock",
    headline: "Simulated supply shock sends energy listings vertical",
    description:
      "A fictional supply disruption. Energy listings spike while transport and consumer names quietly bleed.",
    scope: "SECTOR",
    target: "Energy",
    modifier: 1.25,
    dayOfCycle: 12,
    startHour: 15,
    durationHours: 4,
    severity: "rally",
  },
  {
    key: "crypto-winter",
    name: "Crypto Winter",
    headline: "Simulated crypto meltdown wipes out a third of the sector",
    description:
      "A fictional crypto crash. Leveraged crypto holders discover what a 30% overnight candle does to a portfolio.",
    scope: "ASSET_CLASS",
    target: "CRYPTO",
    modifier: 0.7,
    dayOfCycle: 15,
    startHour: 14,
    durationHours: 6,
    severity: "crash",
  },
  {
    key: "gold-rush",
    name: "Gold Rush",
    headline: "Simulated investors run for cover into gold",
    description:
      "A fictional flight to safety. Gold climbs while risky assets stall — the classic hedge trade.",
    scope: "SYMBOL",
    target: "GOLD",
    modifier: 1.15,
    dayOfCycle: 18,
    startHour: 16,
    durationHours: 5,
    severity: "rally",
  },
  {
    key: "melt-up-era",
    name: "Melt-Up Era",
    headline: "Simulated melt-up: everything drifts higher for days",
    description:
      "A fictional multi-day melt-up. Gains look effortless for four days straight — which is exactly when risk gets forgotten.",
    scope: "ALL",
    modifier: 1.12,
    dayOfCycle: 10,
    startHour: 8,
    durationHours: 96,
    severity: "rally",
  },
  {
    key: "commodity-boom",
    name: "Commodity Boom",
    headline: "Simulated commodities boom runs for days",
    description:
      "A fictional multi-day boom in commodities. Gold, oil, metals and crops all drift higher while most stocks stand still.",
    scope: "ASSET_CLASS",
    target: "COMMODITY",
    modifier: 1.18,
    dayOfCycle: 20,
    startHour: 6,
    durationHours: 108,
    severity: "rally",
  },
  {
    key: "meltdown-era",
    name: "Global Risk-Off Era",
    headline: "Simulated risk-off era: a long, grinding slide",
    description:
      "A fictional multi-day bear market. Slow bleeding is harder to sit through than a single crash — this is where panic-selling usually happens.",
    scope: "ALL",
    modifier: 0.82,
    dayOfCycle: 33,
    startHour: 5,
    durationHours: 110,
    severity: "crash",
  },
  {
    key: "earnings-avalanche",
    name: "Earnings Avalanche",
    headline: "Simulated earnings season beats expectations everywhere",
    description:
      "A fictional wall of good numbers. Broad gains across almost every listing.",
    scope: "ALL",
    modifier: 1.16,
    dayOfCycle: 21,
    startHour: 13,
    durationHours: 8,
    severity: "rally",
  },
  {
    key: "aadidev-hype",
    name: "Aadidev.co Hype Train",
    headline: "Simulated rumour: Aadidev.co lands a mystery mega-client",
    description:
      "Pure fictional hype around the house listing. The price doubles-ish on a headline nobody has verified. Textbook 'buy the rumour' moment.",
    scope: "SYMBOL",
    target: "AADIDEV",
    modifier: 1.55,
    dayOfCycle: 24,
    startHour: 14,
    durationHours: 4,
    severity: "wild",
  },
  {
    key: "aadidev-reality",
    name: "Aadidev.co Reality Check",
    headline: "Simulated rumour collapses: the mega-client never existed",
    description:
      "The fictional deal falls apart and Aadidev.co gives back the hype — and then some. 'Sell the news' demonstrated the hard way.",
    scope: "SYMBOL",
    target: "AADIDEV",
    modifier: 0.62,
    dayOfCycle: 26,
    startHour: 14,
    durationHours: 5,
    severity: "crash",
  },
  {
    key: "rate-scare",
    name: "Rate Scare",
    headline: "Simulated rate scare slams the bond desk",
    description:
      "A fictional yield spike. Bonds — normally the calm asset — fall while the crowd recalculates everything.",
    scope: "ASSET_CLASS",
    target: "BOND",
    modifier: 0.9,
    dayOfCycle: 29,
    startHour: 15,
    durationHours: 6,
    severity: "crash",
  },
  {
    key: "ai-hype",
    name: "AI Hype Wave",
    headline: "Simulated AI mania lifts the chip makers again",
    description:
      "A fictional semiconductor melt-up. Every chip listing rockets on the same story for the fourth time this cycle.",
    scope: "SECTOR",
    target: "Semiconductors",
    modifier: 1.2,
    dayOfCycle: 32,
    startHour: 13,
    durationHours: 7,
    severity: "rally",
  },
  {
    key: "black-swan",
    name: "Black Swan Friday",
    headline: "Simulated black swan: the whole market is red",
    description:
      "The big fictional one. Everything drops ~34%. Diversification helps, panic-selling makes it permanent, buying the wreckage is how the next rally gets funded.",
    scope: "ALL",
    modifier: 0.66,
    dayOfCycle: 36,
    startHour: 14,
    durationHours: 6,
    severity: "crash",
  },
  {
    key: "bailout-rally",
    name: "Bailout Rally",
    headline: "Simulated rescue package sends everything rocketing",
    description:
      "A fictional policy rescue. The market rips back the morning after the crash.",
    scope: "ALL",
    modifier: 1.14,
    dayOfCycle: 37,
    startHour: 13,
    durationHours: 8,
    severity: "rally",
  },
  {
    key: "supply-squeeze",
    name: "Supply Squeeze",
    headline: "Simulated shortages squeeze commodity prices higher",
    description:
      "Fictional supply chaos across commodities. Oil, metals and crops all climb at once.",
    scope: "ASSET_CLASS",
    target: "COMMODITY",
    modifier: 1.3,
    dayOfCycle: 41,
    startHour: 15,
    durationHours: 5,
    severity: "rally",
  },
  {
    key: "trial-flop",
    name: "Drug Trial Flop",
    headline: "Simulated biotech trial fails and the sector cracks",
    description:
      "A fictional failed trial. Single-product biotech names get destroyed — this is why position sizing exists.",
    scope: "SECTOR",
    target: "Biotech",
    modifier: 0.72,
    dayOfCycle: 44,
    startHour: 13,
    durationHours: 4,
    severity: "crash",
  },
  {
    key: "chip-glut",
    name: "Chip Glut",
    headline: "Simulated chip glut: too much supply, not enough buyers",
    description:
      "A fictional inventory glut drags technology listings down for the afternoon.",
    scope: "SECTOR",
    target: "Technology",
    modifier: 0.78,
    dayOfCycle: 47,
    startHour: 14,
    durationHours: 6,
    severity: "crash",
  },
  {
    key: "bank-run",
    name: "Bank Run Panic",
    headline: "Simulated bank run: the financial desk is in full retreat",
    description:
      "A fictional liquidity scare. Bank and insurance listings gap down together while everyone rediscovers what 'counterparty risk' means.",
    scope: "SECTOR",
    target: "Financials",
    modifier: 0.76,
    dayOfCycle: 5,
    startHour: 15,
    durationHours: 5,
    severity: "crash",
  },
  {
    key: "airline-squeeze",
    name: "Fuel Price Squeeze",
    headline: "Simulated jet-fuel spike hammers the airlines",
    description:
      "A fictional fuel-cost shock. Airlines get hit hardest — oil does the opposite of airlines, and this cycle proves it.",
    scope: "SECTOR",
    target: "Airlines",
    modifier: 0.8,
    dayOfCycle: 11,
    startHour: 16,
    durationHours: 6,
    severity: "crash",
  },
  {
    key: "reit-rate-pinch",
    name: "Rate Pinch",
    headline: "Simulated yield jump squeezes the REITs",
    description:
      "A fictional rate scare. Property trusts fall while bonds wobble — rate-sensitive listings learn nothing good comes cheap.",
    scope: "SECTOR",
    target: "REITs",
    modifier: 0.84,
    dayOfCycle: 14,
    startHour: 13,
    durationHours: 5,
    severity: "crash",
  },
  {
    key: "meme-collapse",
    name: "Meme Collapse",
    headline: "Simulated meme unwind: the crowd heads for the exits at once",
    description:
      "The fictional hype reverses. Meme listings give back their frenzy in one brutal afternoon — momentum cuts both ways.",
    scope: "SECTOR",
    target: "Meme",
    modifier: 0.7,
    dayOfCycle: 7,
    startHour: 17,
    durationHours: 4,
    severity: "crash",
  },
  {
    key: "coffee-crisis",
    name: "Coffee Crisis",
    headline: "Simulated frost wipes out the fictional coffee harvest",
    description:
      "A fictional crop disaster sends softs vertical. Breakfast is now a luxury good — agricultural commodities spike together.",
    scope: "SECTOR",
    target: "Softs",
    modifier: 1.32,
    dayOfCycle: 19,
    startHour: 8,
    durationHours: 10,
    severity: "wild",
  },
  {
    key: "battery-boom",
    name: "Battery Boom",
    headline: "Simulated EV megadeal lights up the battery metals",
    description:
      "A fictional supply deal. Lithium, cobalt and nickel all jump at once — the electrification trade in miniature.",
    scope: "SECTOR",
    target: "Battery Metals",
    modifier: 1.24,
    dayOfCycle: 23,
    startHour: 9,
    durationHours: 12,
    severity: "rally",
  },
  {
    key: "meme-coin-mania",
    name: "Meme-Coin Mania",
    headline: "Simulated meme coins go vertical on one fake celebrity post",
    description:
      "A fictional celebrity endorsement. The meme-crypto basket rockets while serious crypto barely shrugs. Never confuse the two.",
    scope: "SECTOR",
    target: "Meme Crypto",
    modifier: 1.45,
    dayOfCycle: 28,
    startHour: 21,
    durationHours: 5,
    severity: "wild",
  },
  {
    key: "stablecoin-wobble",
    name: "Stablecoin Wobble",
    headline: "Simulated stablecoin wobble rattles all of crypto",
    description:
      "A fictional depeg scare. Crypto sells off hard across the board before calm returns — a dress rehearsal for real risk management.",
    scope: "ASSET_CLASS",
    target: "CRYPTO",
    modifier: 0.78,
    dayOfCycle: 30,
    startHour: 3,
    durationHours: 4,
    severity: "crash",
  },
  {
    key: "dividend-stampede",
    name: "Dividend Stampede",
    headline: "Simulated yield hunters stampede into dividend payers",
    description:
      "A fictional rotation. Dividend funds and cash-like listings drift up while growth names sit still — boring wins for a day.",
    scope: "SECTOR",
    target: "Dividend Fund",
    modifier: 1.14,
    dayOfCycle: 34,
    startHour: 14,
    durationHours: 8,
    severity: "rally",
  },
  {
    key: "defense-order",
    name: "Defense Order Surge",
    headline: "Simulated defense contract flood lifts aerospace names",
    description:
      "A fictional procurement spree. Aerospace & defense listings march higher on headlines nobody can verify — until they do.",
    scope: "SECTOR",
    target: "Aerospace & Defense",
    modifier: 1.18,
    dayOfCycle: 39,
    startHour: 13,
    durationHours: 6,
    severity: "rally",
  },
  {
    key: "aadiverse-mania",
    name: "AadiVerse Mania",
    headline: "Simulated AadiVerse takeover rumours send everything fictional vertical",
    description:
      "A fictional buyout saga. Every AadiVerse listing gaps up on gossip — including the house stock. Rumours this good are usually exactly that.",
    scope: "MARKET",
    target: "AADI",
    modifier: 1.28,
    dayOfCycle: 43,
    startHour: 14,
    durationHours: 5,
    severity: "wild",
  },
  {
    key: "lightning-crash",
    name: "Lightning Crash",
    headline: "Simulated algorithm glitch: 12% gone in ninety minutes",
    description:
      "A fictional rogue algorithm. A short, violent market-wide air pocket — the kind that makes stop-losses feel very smart or very silly.",
    scope: "ALL",
    modifier: 0.88,
    dayOfCycle: 45,
    startHour: 19,
    durationHours: 2,
    severity: "crash",
  },
];

export interface ActiveScheduledEvent {
  def: ScheduledEvent;
  startedAt: Date;
  endsAt: Date;
}

export function eventAppliesTo(
  ev: ScheduledEvent,
  def: Pick<StockDef, "symbol" | "sector" | "assetClass" | "market">,
): boolean {
  switch (ev.scope) {
    case "ALL":
      return true;
    case "ASSET_CLASS":
      return def.assetClass === (ev.target as AssetClass);
    case "SECTOR":
      return def.sector === ev.target;
    case "SYMBOL":
      return def.symbol === ev.target;
    case "MARKET":
      return def.market === (ev.target as Market);
    default:
      return false;
  }
}

function cycleDayOf(dayIndex: number): number {
  return ((dayIndex % CYCLE_DAYS) + CYCLE_DAYS) % CYCLE_DAYS;
}

/** Absolute start timestamp of an event scheduled on `dayIndex`. */
function startOf(ev: ScheduledEvent, dayIndex: number): number {
  return dayIndex * DAY_MS + ev.startHour * 3600 * 1000;
}

/** All scheduled events running at `at` (checks today and yesterday's spill). */
export function activeScheduledEvents(at: Date = new Date()): ActiveScheduledEvent[] {
  const t = at.getTime();
  const dayIndex = Math.floor(t / DAY_MS);
  const out: ActiveScheduledEvent[] = [];
  for (const ev of SCHEDULED_EVENTS) {
    // Multi-day "eras" can have started several days ago — walk back far enough.
    const lookback = Math.ceil(ev.durationHours / 24);
    for (let offset = 0; offset >= -lookback; offset--) {
      const candDay = dayIndex + offset;
      if (cycleDayOf(candDay) !== ev.dayOfCycle) continue;
      const start = startOf(ev, candDay);
      const end = start + ev.durationHours * 3600 * 1000;
      if (t >= start && t < end) {
        out.push({ def: ev, startedAt: new Date(start), endsAt: new Date(end) });
      }
      break;
    }
  }
  return out.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
}

/** Combined scheduled-event multiplier for one listing at one instant. */
export function scheduledMultiplier(def: StockDef, at: Date = new Date()): number {
  let mult = 1;
  for (const active of activeScheduledEvents(at)) {
    if (eventAppliesTo(active.def, def)) mult *= active.def.modifier;
  }
  return mult;
}

/** The next scheduled event that has not started yet (for the "incoming" teaser). */
export function upcomingScheduledEvent(
  at: Date = new Date(),
): { def: ScheduledEvent; startsAt: Date } | null {
  const t = at.getTime();
  const dayIndex = Math.floor(t / DAY_MS);
  let best: { def: ScheduledEvent; startsAt: Date } | null = null;
  for (const ev of SCHEDULED_EVENTS) {
    for (let offset = 0; offset <= CYCLE_DAYS; offset++) {
      const candDay = dayIndex + offset;
      if (cycleDayOf(candDay) !== ev.dayOfCycle) continue;
      const start = startOf(ev, candDay);
      if (start > t && (!best || start < best.startsAt.getTime())) {
        best = { def: ev, startsAt: new Date(start) };
      }
      break;
    }
  }
  return best;
}

/** How the UI should colour an event. */
export function severityOf(modifier: number): EventSeverity {
  if (modifier >= 1.35 || modifier <= 0.68) return "wild";
  return modifier < 1 ? "crash" : "rally";
}

/** Scope in the shared API vocabulary ("MANUAL" is reserved for admin events). */
export function sharedScope(
  ev: ScheduledEvent,
): "ALL" | "ASSET_CLASS" | "SECTOR" | "SYMBOL" | "MARKET" {
  return ev.scope;
}
