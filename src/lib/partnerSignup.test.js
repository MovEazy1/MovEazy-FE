import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: null, isSupabaseConfigured: false }));

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { JOIN_DESK, REF_TTL, cameByReferral, joinMessage, refFromCookie, signupSource, startReferralJoin } = await import("./partnerSignup");

describe("joining through a referral link", () => {
  beforeEach(() => store.clear());

  it("knows a referred visitor by the code kept from their first landing", () => {
    expect(cameByReferral()).toBe(false);
    store.set("mz_partner_src", JSON.stringify({ channel: "referral", ref: "ASHA12", utm: {}, at: Date.now() }));
    expect(cameByReferral()).toBe(true);
  });

  it("the message asks to join, with the number and the referral code", () => {
    expect(joinMessage("9876543210", "ASHA12")).toBe(
      "Hi, I want to join as a MovEazy partner, help me understand the steps.\nMy number: 9876543210\nReferral code: ASHA12",
    );
    expect(joinMessage("", "")).toBe("Hi, I want to join as a MovEazy partner, help me understand the steps.");
  });

  it("opens WhatsApp to the partner desk, and refuses a bad number", () => {
    store.set("mz_partner_src", JSON.stringify({ channel: "referral", ref: "ASHA12", utm: {}, at: Date.now() }));
    const url = startReferralJoin("+91 98765 43210");
    expect(url.startsWith(`https://wa.me/91${JOIN_DESK}?text=`)).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1])).toMatch(/join as a MovEazy partner[\s\S]*9876543210[\s\S]*ASHA12/);
    expect(() => startReferralJoin("12345")).toThrow(/valid 10-digit/);
  });
});

describe("a referral link counts for 24 hours, on every MovEazy site", () => {
  beforeEach(() => store.clear());

  it("a code kept on this site lasts 24 hours from the click", () => {
    const at = 1_800_000_000_000;
    store.set("mz_partner_src", JSON.stringify({ channel: "referral", ref: "ASHA12", refAt: at, at, utm: {} }));
    expect(signupSource(at + REF_TTL - 60_000).ref).toBe("ASHA12");
    expect(signupSource(at + REF_TTL + 60_000).ref).toBe("");
  });

  it("the cookie a link left on another MovEazy site is read within its 24 hours", () => {
    const at = 1_800_000_000_000;
    const cookie = `other=1; mz_partner_ref=${encodeURIComponent(`ASHA12.${at}`)}`;
    expect(refFromCookie(cookie, at + 3_600_000)).toEqual({ ref: "ASHA12", at });
    expect(refFromCookie(cookie, at + REF_TTL + 1)).toBe(null);
    expect(refFromCookie("other=1", at)).toBe(null);
    expect(refFromCookie(`mz_partner_ref=${encodeURIComponent(`as<ha.${at}`)}`, at)).toEqual({ ref: "ASHA", at });
  });
});
