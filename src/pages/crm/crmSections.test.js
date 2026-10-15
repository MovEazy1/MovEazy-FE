import { describe, expect, it } from "vitest";
import { PHONE_TABS, RAIL, sectionFor } from "./crmSections";

describe("CRM sections", () => {
  it("names the screen a path is on, longest match first", () => {
    expect(sectionFor("/crm/partner-usage/abc")?.label).toBe("Partner usage");
    expect(sectionFor("/crm/partner-payments")?.label).toBe("Partner payments");
    expect(sectionFor("/crm/payments")?.label).toBe("Payments");
    expect(sectionFor("/crm/properties/new")?.label).toBe("New property");
    expect(sectionFor("/crm/properties/MZ-1/edit")?.label).toBe("Properties");
    expect(sectionFor("/crm/buildings/x")?.label).toBe("Building");
    expect(sectionFor("/crm/nowhere")).toBe(null);
  });
  it("keeps the bottom bar to five, Home first, each a real screen", () => {
    expect(PHONE_TABS.map((t) => t.label)).toEqual(["Home", "Payments", "Alerts", "Partners", "Clients"]);
    for (const t of PHONE_TABS) expect(sectionFor(t.to)).not.toBe(null);
  });
  it("gives every rail section an icon and a group for Home's grid", () => {
    for (const r of RAIL) { expect(r.icon).toBeTruthy(); expect(r.group).toBeTruthy(); }
  });
});
