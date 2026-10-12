import { describe, expect, it } from "vitest";
import { planPriceLines, rewardTimer } from "./partnerPlans";

describe("planPriceLines", () => {
  it("₹4,999 for 5 months reads ₹1,000/month", () =>
    expect(planPriceLines({ price: 4999, months: 5 })).toEqual({ perMonth: "₹1,000/month", total: "₹4,999 · 5 months" }));
  it("₹9,999 for 12 months reads ₹833/month", () => expect(planPriceLines({ price: 9999, months: 12 }).perMonth).toBe("₹833/month"));
  it("one month", () => expect(planPriceLines({ price: 1500, months: 1 })).toEqual({ perMonth: "₹1,500/month", total: "₹1,500 · 1 month" }));
});

describe("rewardTimer", () => {
  it("counts down, and the (i) says what happens", () => {
    const t = rewardTimer({ name: "Neel", amount: 1500, days_left: 23 });
    expect(t.label).toBe("₹1,500 · redeemable in 23 days");
    expect(t.info).toBe("If Neel doesn't cancel the subscription, ₹1,500 will be credited directly to your bank account in 23 days.");
  });
  it("one day, and the last day", () => {
    expect(rewardTimer({ name: "A", amount: 500, days_left: 1 }).label).toBe("₹500 · redeemable in 1 day");
    expect(rewardTimer({ name: "A", amount: 500, days_left: 0 }).label).toBe("₹500 · redeemable now");
  });
});
