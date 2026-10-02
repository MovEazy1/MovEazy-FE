import { describe, expect, it } from "vitest";
import { PRICE_VIEWS, flatDisplay, flatUrl, priceViewLabel } from "./flatInsights";

describe("flat QR", () => {
  it("opens the flat's own page on moveazy.co.in, marked as a scan", () => {
    expect(flatUrl("MZ-AB12CD", { qr: true })).toBe("https://www.moveazy.co.in/property/MZ-AB12CD?s=qr");
    expect(flatUrl("MZ-AB12CD")).toBe("https://www.moveazy.co.in/property/MZ-AB12CD");
    expect(flatDisplay("MZ-AB12CD")).toBe("moveazy.co.in/property/MZ-AB12CD");
  });

  it("names the four rent views the database accepts", () => {
    expect(PRICE_VIEWS.map((p) => p.id)).toEqual(["too_high", "bit_high", "fair", "good_value"]);
    expect(priceViewLabel("bit_high")).toBe("A bit high");
    expect(priceViewLabel("nope")).toBe("");
  });
});
