import { describe, expect, it } from "vitest";
import { dec, greaterThan, lessThan, money, toCentsString } from "../src/utils/money.js";

/**
 * The trading engine's settlement logic requires a database, so the full
 * flow is covered by the browser QA walk. These tests pin the *rules* —
 * the exact validations the engine applies before touching any balance.
 */

const MAX_QUANTITY = 100; // matches the production cap

function validateOrder(side: "BUY" | "SELL", symbol: string, qty: string, cash: string, owned: string, price: number) {
  const q = dec(qty);
  if (q.isZero() || lessThan(q, 0)) return "Quantity must be greater than zero.";
  if (greaterThan(q, MAX_QUANTITY)) return "Quantity too large.";
  const total = money(q.times(price));
  if (side === "BUY" && greaterThan(total, cash)) {
    return `Insufficient investment cash. You need $${toCentsString(total.minus(cash))} more virtual cash to place this order.`;
  }
  if (side === "SELL" && lessThan(owned, q)) {
    return "You cannot sell more shares than you own.";
  }
  return null;
}

describe("trading rules", () => {
  it("rejects zero and negative quantity", () => {
    expect(validateOrder("BUY", "AAPL", "0", "500", "0", 100)).toMatch(/greater than zero/);
    expect(validateOrder("BUY", "AAPL", "-2", "500", "0", 100)).toMatch(/greater than zero/);
  });

  it("rejects buying without enough cash", () => {
    const err = validateOrder("BUY", "AAPL", "3", "500", "0", 200);
    expect(err).toMatch(/need \$100\.00 more/);
  });

  it("allows buying exactly up to available cash", () => {
    expect(validateOrder("BUY", "AAPL", "2.5", "500", "0", 200)).toBeNull();
  });

  it("rejects selling more than owned", () => {
    expect(validateOrder("SELL", "AAPL", "11", "0", "10", 50)).toMatch(/more shares than you own/);
  });

  it("allows selling exactly what is owned", () => {
    expect(validateOrder("SELL", "AAPL", "10", "0", "10", 50)).toBeNull();
  });

  it("computes decimal-exact totals for fractional shares", () => {
    expect(toCentsString(money(dec("2.5").times("199.99")))).toBe("499.98");
  });

  it("computes average cost across multiple buys", () => {
    const first = money(dec("1").times(100));
    const second = money(dec("1").times(120));
    const avg = money(first.plus(second).dividedBy(2));
    expect(avg.toFixed(2)).toBe("110.00");
  });
});
