import { describe, expect, it } from "vitest";
import { addDays, dealKind, dealShareUrl, mondayOf, untilMidnightIst, weekLabel } from "./deals";

describe("deals", () => {
  it("puts each flat type in its Deal of the Day slot, like deal_kind() in SQL", () => {
    expect(dealKind("1 RK")).toBe("1rk");
    expect(dealKind("Studio")).toBe("1rk");
    expect(dealKind("1 BHK")).toBe("1bhk");
    expect(dealKind("2 BHK")).toBe("2bhk");
    expect(dealKind("3 BHK")).toBe("3bhk");
    expect(dealKind("4 BHK")).toBe("3bhk");
    expect(dealKind("Room in Preoccupied flat")).toBe(null);
    expect(dealKind("")).toBe(null);
  });
  it("writes the week's dates", () => {
    expect(weekLabel("2026-11-09", "2026-11-15")).toBe("9–15 Nov");
    expect(weekLabel("2026-10-26", "2026-11-01")).toBe("26 Oct – 1 Nov");
  });
  it("finds Monday and moves days", () => {
    expect(mondayOf("2026-11-11")).toBe("2026-11-09");
    expect(mondayOf("2026-11-15")).toBe("2026-11-09");
    expect(mondayOf("2026-11-09")).toBe("2026-11-09");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });
  it("counts down to midnight IST", () => {
    // 18:30 UTC is midnight IST: one minute before is "1m".
    expect(untilMidnightIst(Date.UTC(2026, 10, 11, 18, 29))).toBe("1m");
    expect(untilMidnightIst(Date.UTC(2026, 10, 11, 12, 30))).toBe("6h 0m");
  });
  it("shares the flat's page on WhatsApp", () => {
    const url = dealShareUrl({ id: "MZ-AB12CD", title: "2 BHK in HSR", price: "₹30,000/mo" });
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url)).toContain("https://www.moveazy.co.in/property/MZ-AB12CD");
  });
});
