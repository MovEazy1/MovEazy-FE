/**
 * The half-finished visitor.
 *
 * The funnel used to open with a Google wall, and everyone who wasn't ready to
 * hand over an account left without a trace. These tests pin the properties
 * that make the replacement worth having: a lead key nobody can guess, answers
 * that survive a closed tab, and partial saves that cannot erase what an
 * earlier step already captured.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: null, isSupabaseConfigured: false }));
vi.mock("./sessionSync", () => ({ anonId: () => "a_test_anon" }));
vi.mock("./attribution", () => ({ firstTouch: () => null }));

function browser() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  return store;
}

let lead;

beforeEach(async () => {
  vi.resetModules();
  browser();
  lead = await import("./leadIntake.js");
});

afterEach(() => {
  delete globalThis.localStorage;
});

describe("the key a lead is stored under", () => {
  it("is long enough that it cannot be guessed", () => {
    // The server refuses anything under 24 characters, because a short key
    // would expose one visitor's answers and phone number to another.
    expect(lead.leadKey()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("stays the same browser-to-browser so answers can be found again", () => {
    expect(lead.leadKey()).toBe(lead.leadKey());
  });

  it("differs between browsers", async () => {
    const first = lead.leadKey();
    browser();
    vi.resetModules();
    const other = await import("./leadIntake.js");
    expect(other.leadKey()).not.toBe(first);
  });
});

describe("what we keep before someone signs up", () => {
  it("remembers a number so the gate is asked once, not on every visit", async () => {
    expect(lead.hasLeadPhone()).toBe(false);
    await lead.saveLead({ phone: "9876543210" });
    expect(lead.hasLeadPhone()).toBe(true);
    expect(lead.leadSnapshot().phone).toBe("9876543210");
  });

  it("leaves untouched fields alone when a step saves only its own answer", async () => {
    // The bug this guards: step four saving its prefs and blanking the name
    // captured at step one, leaving the CRM a number with nobody attached.
    await lead.saveLead({ name: "Asha", phone: "9876543210" });
    await lead.saveLead({ prefs: { localities: ["HSR"] }, step: 3 });

    const snap = lead.leadSnapshot();
    expect(snap.name).toBe("Asha");
    expect(snap.phone).toBe("9876543210");
    expect(snap.prefs).toEqual({ localities: ["HSR"] });
    expect(snap.step).toBe(3);
  });

  it("keeps a completed lead completed when preferences are edited again", async () => {
    // A lead the CRM has already acted on must not silently revert to
    // half-finished because the visitor reopened the questionnaire.
    await lead.saveLead({ completed: true, step: 9 });
    await lead.saveLead({ prefs: { localities: ["Indiranagar"] }, step: 2 });
    expect(lead.leadSnapshot().completed).toBe(true);
  });

  it("survives the questionnaire being closed and reopened", async () => {
    await lead.saveLead({ name: "Ravi", prefs: { flatTypes: ["2 BHK"] }, step: 4 });
    vi.resetModules();
    const reopened = await import("./leadIntake.js");
    expect(reopened.leadSnapshot()).toMatchObject({
      name: "Ravi",
      step: 4,
      prefs: { flatTypes: ["2 BHK"] },
    });
  });

  it("starts empty rather than undefined for a first-time visitor", () => {
    expect(lead.leadSnapshot()).toEqual({
      name: "", phone: "", prefs: null, step: 0, completed: false,
      leadType: "", propertyId: "",
    });
  });

  it("marks someone who opened a shared property link as a direct lead", async () => {
    // The bug this guards: leadType defaulted to "questionnaire", and the
    // don't-demote rule keyed on that default — so a brand-new lead counted as
    // a questionnaire one and could never be recorded as direct. Every share
    // link would have landed in the CRM mislabelled.
    await lead.saveLead({ phone: "9888877777", leadType: "direct_property", propertyId: "MZ-FQ5U48" });
    expect(lead.leadSnapshot()).toMatchObject({
      leadType: "direct_property", propertyId: "MZ-FQ5U48",
    });
  });

  it("promotes that lead once they start answering questions", async () => {
    await lead.saveLead({ phone: "9888877777", leadType: "direct_property", propertyId: "MZ-FQ5U48" });
    await lead.saveLead({ prefs: { localities: ["HSR"] }, step: 2, leadType: "questionnaire" });
    expect(lead.leadSnapshot().leadType).toBe("questionnaire");
    // The flat that brought them in is still the flat that brought them in.
    expect(lead.leadSnapshot().propertyId).toBe("MZ-FQ5U48");
  });

  it("never demotes a questionnaire lead who later opens a shared link", async () => {
    await lead.saveLead({ prefs: { localities: ["HSR"] }, step: 3, leadType: "questionnaire" });
    await lead.saveLead({ leadType: "direct_property", propertyId: "MZ-OTHER1" });
    expect(lead.leadSnapshot().leadType).toBe("questionnaire");
  });

  it("does not throw when storage is unavailable", async () => {
    // Private mode: every accessor throws. Losing the lead is acceptable;
    // breaking the page the visitor is standing on is not.
    globalThis.localStorage = {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("denied"); },
      removeItem: () => { throw new Error("denied"); },
    };
    await expect(lead.saveLead({ phone: "9876543210" })).resolves.toBeTruthy();
    expect(lead.hasLeadPhone()).toBe(false);
  });
});
