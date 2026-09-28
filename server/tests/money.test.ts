import { describe, expect, it } from "vitest";
import { dec, greaterThan, money, shares, sum, toCentsString } from "../src/utils/money.js";

describe("money helpers", () => {
  it("avoids float drift", () => {
    // 0.1 + 0.2 === 0.30000000000000004 in floats
    expect(toCentsString(sum(0.1, 0.2))).toBe("0.30");
  });

  it("rounds half-even to cents", () => {
    expect(money("2.675").toFixed(2)).toBe("2.68");
    expect(money("1.005").toFixed(2)).toBe("1.00");
  });

  it("quantizes shares to 6dp", () => {
    expect(shares("0.1234564").toFixed(6)).toBe("0.123456");
  });

  it("compares decimals safely", () => {
    expect(greaterThan("0.3", sum(0.1, 0.2))).toBe(false);
    expect(greaterThan("0.31", sum(0.1, 0.2))).toBe(true);
  });

  it("handles Decimal round-trips from Prisma-style strings", () => {
    expect(money(dec("1234.56")).toFixed(2)).toBe("1234.56");
  });
});
