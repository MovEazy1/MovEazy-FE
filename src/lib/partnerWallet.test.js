import { describe, expect, it } from "vitest";
import { lifetimeEstimate, pctLabel, walletTotals } from "./partnerPlans";

describe("walletTotals", () => {
  const r = {
    pending: 1500, earned: 3000, paid: 500,
    commission: { due: 4000, held: 2000, held_until: "2026-11-12T00:00:00Z", paid: 6000, lost: 900 },
    joined: [
      { deals: [{ status: "waiting", amount: 2500 }, { status: "paid", amount: 6000 }, { status: "none", amount: 0 }] },
      { deals: [{ status: "waiting", amount: 1000 }] },
      {},
    ],
  };
  it("available = rewards due + commission due", () => expect(walletTotals(r).available).toBe(7000));
  it("on the way = rewards in their 30 days + deals waiting for MovEazy", () => expect(walletTotals(r).onTheWay).toBe(5000));
  it("held, with its deadline", () => expect(walletTotals(r)).toMatchObject({ held: 2000, heldUntil: "2026-11-12T00:00:00Z" }));
  it("paid adds both; lifetime is commission earned (lost never counts)", () =>
    expect(walletTotals(r)).toMatchObject({ paid: 6500, lifetime: 10000 }));
  it("an empty Wallet is all zeros", () =>
    expect(walletTotals(null)).toEqual({ available: 0, onTheWay: 0, held: 0, heldUntil: null, paid: 0, lifetime: 0 }));
});

describe("lifetimeEstimate", () => {
  it("10 partners × 2 deals × ₹30,000 at 10% = ₹60,000 a month", () =>
    expect(lifetimeEstimate(10, 2, 30000)).toEqual({ monthly: 60000, yearly: 720000 }));
  it("uses the partner's own rate", () => expect(lifetimeEstimate(1, 1, 30000, 6.67).monthly).toBe(2001));
  it("never negative", () => expect(lifetimeEstimate(-3, 2, 30000).monthly).toBe(0));
});

describe("pctLabel", () => {
  it("drops trailing zeros", () => {
    expect(pctLabel(10)).toBe("10%");
    expect(pctLabel("6.67")).toBe("6.67%");
    expect(pctLabel(12.5)).toBe("12.5%");
  });
});
