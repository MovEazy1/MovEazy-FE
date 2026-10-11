import { describe, expect, it } from "vitest";
import { cleanUtr, closureDue, isUtr, leadNeedLine, moveInRows, topSets, upiLink } from "./partnerLeads";

describe("upiLink", () => {
  it("pays MovEazy's UPI ID with the amount filled in", () => {
    const u = upiLink({ vpa: "8090911024@pthdfc", amount: 2000, note: "30 MovEazy leads" });
    expect(u.startsWith("upi://pay?")).toBe(true);
    const q = new URLSearchParams(u.split("?")[1]);
    expect(q.get("pa")).toBe("8090911024@pthdfc");
    expect(q.get("am")).toBe("2000");
    expect(q.get("cu")).toBe("INR");
    expect(q.get("tn")).toBe("30 MovEazy leads");
    expect(u).not.toContain("+");
  });
  it("nothing without a UPI ID", () => expect(upiLink({ vpa: "", amount: 1 })).toBe(""));
});

describe("UTR", () => {
  it("strips spaces and upper-cases", () => expect(cleanUtr(" axis 1234 5678 ")).toBe("AXIS12345678"));
  it("accepts a 12-digit UPI ref and bank refs, not junk", () => {
    expect(isUtr("412345678901")).toBe(true);
    expect(isUtr("HDFC00012345X")).toBe(true);
    expect(isUtr("12-34")).toBe(false);
    expect(isUtr("123")).toBe(false);
  });
});

describe("closureDue", () => {
  it("30% of a month's rent direct with the owner, 20% with other brokers", () => {
    expect(closureDue(30000, "direct")).toBe(9000);
    expect(closureDue(30000, "shared")).toBe(6000);
  });
  it("nothing on a pack lead — paid up front", () => expect(closureDue(30000, "direct", "paid30")).toBe(0));
});

describe("topSets", () => {
  const pairs = [
    { bhk: "1 BHK", area: "Whitefield", n: 50 },
    { bhk: "2 BHK", area: "HSR Layout", n: 12 },
    { bhk: "1 BHK", area: "HSR Layout", n: 30 },
    { bhk: "3 BHK", area: "Bellandur", n: 0 },
  ];
  it("the broker's areas first, then the biggest; empty sets dropped", () => {
    expect(topSets(pairs, ["HSR Layout"]).map((p) => `${p.bhk} ${p.area}`))
      .toEqual(["1 BHK HSR Layout", "2 BHK HSR Layout", "1 BHK Whitefield"]);
  });
});

describe("moveInRows", () => {
  it("names the first of next month", () => {
    const rows = moveInRows({ week: 3, before: 10, before_date: "2026-11-01", month: 7, two_months: 2, later: 1, flexible: 4 });
    expect(rows[1][0]).toBe("Moving before 1 Nov");
    expect(rows.map((r) => r[1])).toEqual([3, 10, 7, 2, 1, 4]);
  });
});

describe("leadNeedLine", () => {
  it("what they want in a line", () => {
    expect(leadNeedLine({ flat_types: ["1 BHK"], localities: ["HSR Layout"], budget_max: 30000, move_in: "2026-10-16" }))
      .toBe("1 BHK · HSR Layout · up to ₹30,000 · move-in 16 Oct");
  });
});
