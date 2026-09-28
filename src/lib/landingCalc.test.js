import { describe, expect, it } from "vitest";
import { brokerEarnings, inr, ownerReturns } from "./landingCalc";

describe("brokerEarnings", () => {
  it("uses the agreed defaults: 2 MovEazy flats at 50%, 1 MovEazy client at 70%, minus ₹1,499", () => {
    const r = brokerEarnings();
    expect(r.fromProperties).toBe(25000);
    expect(r.fromClients).toBe(17500);
    expect(r.net).toBe(41001);
    expect(r.multiple).toBe(28);
  });

  it("matches the brief's worked formula (1 flat, 3 clients, ₹1,500 fee)", () => {
    expect(brokerEarnings({ properties: 1, clients: 3, fee: 1500 }).net).toBe(63500);
  });

  it("follows the admin shares", () => {
    expect(brokerEarnings({ properties: 2, clients: 0, propertyShare: 100 }).fromProperties).toBe(50000);
  });

  it("shows the fee as the only line when nothing closes, and never divides by zero", () => {
    const r = brokerEarnings({ properties: 0, clients: 0 });
    expect(r.net).toBe(-1499);
    expect(r.multiple).toBeNull();
  });
});

describe("ownerReturns", () => {
  it("uses the agreed defaults for a ₹50k 2 BHK: ₹72,000 a year, 12% of rent", () => {
    const r = ownerReturns();
    expect(r.paintingSaved).toBe(25000);
    expect(r.timeSaved).toBe(20000);
    expect(r.maintTimeSaved).toBe(5333);
    expect(r.daysRecovered).toBe(13);
    expect(r.extraRent).toBe(21667);
    expect(r.total).toBe(72000);
    expect(r.pct).toBe(12);
  });

  it("scales with tenant changes", () => {
    expect(ownerReturns({ changesPerYear: 2 }).total).toBe(138667);
  });

  it("never counts negative savings", () => {
    const r = ownerReturns({ paintMoveazy: 60000, vacantDaysWith: 30 });
    expect(r.paintingSaved).toBe(0);
    expect(r.extraRent).toBe(0);
  });

  it("formats rupees the Indian way", () => {
    expect(inr(101001)).toBe("₹1,01,001");
  });
});
