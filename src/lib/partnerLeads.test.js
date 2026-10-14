import { describe, expect, it } from "vitest";
import { cleanUtr, closureDue, hasAskedForLeads, isUtr, leadNeedLine, moveInRows, moveazyTabBadge, topSets, unablePayMessage, upiLink } from "./partnerLeads";

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
  it("a website lead (their own flat, found on MovEazy) is shared like Premium", () => expect(closureDue(30000, "shared", "website")).toBe(6000));
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

describe("moveazyTabBadge", () => {
  const a = (status) => ({ status });
  it("NEW until the tab is first opened", () => expect(moveazyTabBadge(false, [a("assigned")])).toBe("NEW"));
  it("then the leads not yet contacted", () =>
    expect(moveazyTabBadge(true, [a("assigned"), a("contacted"), a("assigned"), a("closed")])).toBe("2"));
  it("nothing when all are contacted", () => expect(moveazyTabBadge(true, [a("contacted")])).toBe(""));
  it("caps at 99+", () => expect(moveazyTabBadge(true, Array.from({ length: 120 }, () => a("assigned")))).toBe("99+"));
});

describe("hasAskedForLeads", () => {
  it("any real request counts, rejected too", () => expect(hasAskedForLeads([{ status: "rejected" }])).toBe(true));
  it("an abandoned online payment doesn't", () =>
    expect(hasAskedForLeads([{ status: "awaiting_payment" }, { status: "cancelled" }])).toBe(false));
  it("none yet", () => expect(hasAskedForLeads([])).toBe(false));
});

describe("unablePayMessage", () => {
  it("says what, who and their number", () =>
    expect(unablePayMessage("the 5 months Premium plan (₹4,999)", "Rita", "+91 98000 00001"))
      .toBe("Hi MovEazy, I'm unable to pay for the 5 months Premium plan (₹4,999) on the partner app. Name: Rita · Mobile: 98000 00001."));
  it("without a name or number", () =>
    expect(unablePayMessage("30 MovEazy leads (₹2,000)")).toBe("Hi MovEazy, I'm unable to pay for 30 MovEazy leads (₹2,000) on the partner app."));
});
