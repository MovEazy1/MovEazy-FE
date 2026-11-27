import { describe, it, expect } from "vitest";
import {
  statusInfo, fmtINR, emptyRequest, toRequestPayload, validateRequest, signUrl, waShareSign,
} from "./rentAgreements";

describe("rentAgreements helpers", () => {
  it("statusInfo maps known and unknown statuses", () => {
    expect(statusInfo("completed").step).toBe(4);
    expect(statusInfo("unpaid").step).toBe(1);
    expect(statusInfo("weird").label).toBe("weird");
  });

  it("fmtINR formats rupees and handles blanks", () => {
    expect(fmtINR(30000)).toBe("₹30,000");
    expect(fmtINR("")).toBe("—");
    expect(fmtINR(null)).toBe("—");
  });

  it("emptyRequest carries the role and city", () => {
    const f = emptyRequest("owner", "Pune");
    expect(f.role).toBe("owner");
    expect(f.city).toBe("Pune");
    expect(f.duration_months).toBe(11);
  });

  it("toRequestPayload joins the address, filters occupants, keeps aadhaar and latlng", () => {
    const f = emptyRequest("tenant", "Bengaluru");
    f.address = { building: "Acme", flat_no: "12", floor: "3", street: "Main", locality: "HSR", pincode: "560102" };
    f.area = "HSR Layout";
    f.tenant.aadhaar = "1234 5678 9012";
    f.occupants = [{ name: "Sam", relation: "self", age: "29" }, { name: "", relation: "", age: "" }];
    const p = toRequestPayload(f, { lat: 12.9, lng: 77.6 });
    expect(p.lat).toBe(12.9);
    expect(p.aadhaar).toBe("1234 5678 9012");
    expect(p.details.address).toContain("Acme");
    expect(p.details.address).toContain("Flat 12");
    expect(p.details.address).toContain("Floor 3");
    expect(p.details.occupants).toHaveLength(1);
    expect(p.details.occupant_count).toBe(1);
  });

  it("validateRequest flags missing essentials", () => {
    const f = emptyRequest("tenant", "");
    const errs = validateRequest(f);
    expect(errs.length).toBeGreaterThan(0);
    const good = emptyRequest("tenant", "Bengaluru");
    good.owner = { name: "O", mobile: "9800000000", email: "o@x.in" };
    good.tenant = { name: "T", mobile: "9800000001", email: "t@x.in" };
    good.rent = 30000; good.start_date = "2026-12-01";
    expect(validateRequest(good)).toEqual([]);
  });

  it("signUrl builds an absolute link and waShareSign targets the party", () => {
    const token = "abc123";
    expect(signUrl(token)).toContain("/rent/sign/abc123");
    const wa = waShareSign({ role: "owner", name: "Raj", mobile: "9800000000", sign_token: token }, { rent: 30000, start_date: "2026-12-01" });
    expect(wa).toContain("wa.me/919800000000");
    expect(decodeURIComponent(wa)).toContain("/rent/sign/abc123");
  });
});
