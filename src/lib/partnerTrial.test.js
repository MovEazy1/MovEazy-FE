import { describe, expect, it } from "vitest";
import { extendedMessage, parseEmails, trialPopup } from "./partnerTrial";

describe("parseEmails", () => {
  it("splits on commas, spaces and lines, lower-cases, drops repeats", () => {
    expect(parseEmails(" Asha@X.com, bina@x.com\nasha@x.com;  chetan@x.com ")).toEqual(["asha@x.com", "bina@x.com", "chetan@x.com"]);
  });
  it("nothing in, nothing out", () => expect(parseEmails("  ")).toEqual([]));
});

describe("trialPopup", () => {
  it("ended first", () => expect(trialPopup({ ended_due: true, welcome_due: true })).toEqual({ kind: "ended" }));
  it("then the welcome, with the days they have", () =>
    expect(trialPopup({ welcome_due: true, extended_days: 10, days_left: 40 })).toEqual({ kind: "welcome", days: 40 }));
  it("then an extension, with the total added", () =>
    expect(trialPopup({ extended_days: 30, days_left: 52 })).toEqual({ kind: "extended", days: 30, left: 52 }));
  it("nothing due, or no trial", () => {
    expect(trialPopup({ days_left: 12, extended_days: 0 })).toBe(null);
    expect(trialPopup(null)).toBe(null);
  });
});

describe("extendedMessage", () => {
  it("is the CRM's wording", () => {
    expect(extendedMessage(10)).toBe("Congratulations, your Trial Premium Pack is Extended by 10 Days. Enjoy all the premium and make the most of this time.");
    expect(extendedMessage(1)).toMatch(/by 1 Day\./);
  });
});
