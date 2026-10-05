import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: null, isSupabaseConfigured: false }));

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { JOIN_DESK, cameByReferral, joinMessage, startReferralJoin } = await import("./partnerSignup");

describe("joining through a referral link", () => {
  beforeEach(() => store.clear());

  it("knows a referred visitor by the code kept from their first landing", () => {
    expect(cameByReferral()).toBe(false);
    store.set("mz_partner_src", JSON.stringify({ channel: "referral", ref: "ASHA12", utm: {} }));
    expect(cameByReferral()).toBe(true);
  });

  it("the message asks to join, with the number and the referral code", () => {
    expect(joinMessage("9876543210", "ASHA12")).toBe(
      "Hi, I want to join as a MovEazy partner, help me understand the steps.\nMy number: 9876543210\nReferral code: ASHA12",
    );
    expect(joinMessage("", "")).toBe("Hi, I want to join as a MovEazy partner, help me understand the steps.");
  });

  it("opens WhatsApp to the partner desk, and refuses a bad number", () => {
    store.set("mz_partner_src", JSON.stringify({ channel: "referral", ref: "ASHA12", utm: {} }));
    const url = startReferralJoin("+91 98765 43210");
    expect(url.startsWith(`https://wa.me/91${JOIN_DESK}?text=`)).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1])).toMatch(/join as a MovEazy partner[\s\S]*9876543210[\s\S]*ASHA12/);
    expect(() => startReferralJoin("12345")).toThrow(/valid 10-digit/);
  });
});
