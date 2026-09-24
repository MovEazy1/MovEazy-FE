/**
 * The internal half of a listing.
 *
 * The database is what keeps this from tenants — inventory_private has no anon
 * grant and every policy behind is_crm_staff(). What is testable here is the
 * shaping around it: that a broker id cannot outlive the source that justified
 * it, that "not stated" does not become a stray value, and that the POC message
 * carries nothing a tenant said.
 */
import { describe, expect, it } from "vitest";
import {
  BLANK_INTERNAL, PROPERTY_SOURCES, hasInternalDetail, isMissingInternalTable,
  pocMessage, sourceLabel,
} from "./crmPropertyInternal";

describe("PROPERTY_SOURCES", () => {
  it("is exactly the three the database allows", () => {
    // The check constraint on inventory_private.source lists these three; a
    // fourth option here would be a save that fails at the database.
    expect(PROPERTY_SOURCES.map((s) => s.id)).toEqual(["owner", "broker", "tenant"]);
  });

  it("defaults a new listing to the owner", () => {
    expect(BLANK_INTERNAL.source).toBe("owner");
    expect(BLANK_INTERNAL.broker_id).toBe("");
  });

  it("labels an unknown source rather than rendering the raw value", () => {
    expect(sourceLabel("broker")).toBe("Broker");
    expect(sourceLabel("")).toBe("Owner");
    expect(sourceLabel("agency")).toBe("Owner");
  });
});

describe("hasInternalDetail", () => {
  it("is false for a blank row, so nothing is claimed that was not recorded", () => {
    expect(hasInternalDetail(null)).toBe(false);
    expect(hasInternalDetail({ ...BLANK_INTERNAL })).toBe(false);
    // Whitespace is not a contact.
    expect(hasInternalDetail({ ...BLANK_INTERNAL, poc_name: "   " })).toBe(false);
  });

  it("is true once there is anything worth showing", () => {
    expect(hasInternalDetail({ ...BLANK_INTERNAL, poc_phone: "9876543210" })).toBe(true);
    expect(hasInternalDetail({ ...BLANK_INTERNAL, broker_id: "abc" })).toBe(true);
    expect(hasInternalDetail({ ...BLANK_INTERNAL, poc_note: "call after 7" })).toBe(true);
  });

  it("does not count the source alone", () => {
    // Every row has a source — it defaults. If that counted, every listing
    // would claim to have a contact recorded.
    expect(hasInternalDetail({ ...BLANK_INTERNAL, source: "broker" })).toBe(false);
  });
});

describe("isMissingInternalTable", () => {
  it("tells a missing migration apart from a real failure", () => {
    expect(isMissingInternalTable({ code: "PGRST205" })).toBe(true);
    expect(isMissingInternalTable({ code: "42P01" })).toBe(true);
    expect(isMissingInternalTable({ message: 'relation "public.inventory_private" does not exist' })).toBe(true);
    // A permission denial is not a missing table, and must not be reported as
    // "run the migration" — the file has been run and the caller isn't staff.
    expect(isMissingInternalTable({ code: "42501", message: "permission denied for table inventory_private" })).toBe(false);
    expect(isMissingInternalTable(null)).toBe(false);
  });
});

describe("pocMessage", () => {
  it("opens with the first name and names the flat", () => {
    const msg = pocMessage({
      pocName: "Ravi Kumar", propertyId: "MZ-24HXEX", title: "2 BHK", area: "HSR Layout",
    });
    expect(msg).toContain("Hi Ravi,");
    expect(msg).toContain("2 BHK, HSR Layout");
    expect(msg).toContain("MZ-24HXEX");
  });

  it("still says which flat when there is no name for it", () => {
    const msg = pocMessage({ propertyId: "MZ-24HXEX" });
    expect(msg).toContain("MZ-24HXEX");
    // Not "Hi undefined," or a dangling comma.
    expect(msg.startsWith("Hi, this is MovEazy.")).toBe(true);
  });

  it("does not repeat the id when the id is all there is to call it", () => {
    expect(pocMessage({ propertyId: "MZ-24HXEX" })).not.toContain("(MZ-24HXEX)");
  });

  it("carries nothing about the tenant or the rent", () => {
    // This goes to whoever holds the keys. The only thing they need is which
    // flat — anything else is a client's business travelling to a third party.
    const msg = pocMessage({
      pocName: "Ravi", propertyId: "MZ-1", title: "2 BHK", area: "HSR",
    }).toLowerCase();
    for (const leak of ["rent", "₹", "deposit", "tenant", "client", "budget"]) {
      expect(msg).not.toContain(leak);
    }
  });
});
