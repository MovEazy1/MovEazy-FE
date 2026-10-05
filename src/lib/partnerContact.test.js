import { describe, expect, it } from "vitest";
import { VISITS_DESK, contactMessage, hasExactPlace, locationHidden } from "./partnerContact";

const flat = { property_id: "MZ-ASHA01", flat_type: "2 BHK", bedrooms: 2, area: "HSR Layout", rent: 32000 };

describe("locationHidden", () => {
  it("another broker's flat without its address or pin", () => {
    expect(locationHidden({ ...flat, source: "broker", full_address: "", latitude: null, longitude: null })).toBe(true);
    expect(locationHidden({ ...flat, source: "broker", full_address: "14, 19th Cross" })).toBe(false);
    expect(locationHidden({ ...flat, source: "broker", full_address: "", latitude: 12.9, longitude: 77.6 })).toBe(false);
  });
  it("never MovEazy's or your own", () => {
    expect(locationHidden({ ...flat, source: "moveazy", full_address: "" })).toBe(false);
    expect(locationHidden({ ...flat, source: "mine", full_address: "" })).toBe(false);
    expect(hasExactPlace({ full_address: "  " })).toBe(false);
  });
});

describe("contactMessage", () => {
  const visitAt = "2026-10-11T11:30:00Z";
  it("the visits desk gets the flat, its link, the broker and the visit wanted", () => {
    const m = contactMessage(flat, { role: "moveazy", phone: VISITS_DESK }, { partnerName: "Bala", agency: "Bala Realty", visitAt });
    expect(m).toMatch(/visit request/i);
    expect(m).toMatch(/2 BHK in HSR Layout/);
    expect(m).toMatch(/MZ-ASHA01/);
    expect(m).toMatch(/Broker: Bala, Bala Realty/);
    expect(m).toMatch(/Visit wanted: .*Oct/);
    expect(m).toMatch(/https?:\/\//);
  });
  it("with no time picked it asks for the options", () => {
    expect(contactMessage(flat, { role: "moveazy" })).toMatch(/please share the options/);
  });
  it("an owner is asked for a visit, by first name", () => {
    const m = contactMessage(flat, { role: "owner", name: "Priya Kumar" }, { partnerName: "Bala", visitAt });
    expect(m.startsWith("Hi Priya, I'm Bala, a MovEazy partner broker.")).toBe(true);
    expect(m).toMatch(/can we visit on .*Oct/);
  });
  it("a listing broker is asked whether it's still available", () => {
    expect(contactMessage(flat, { role: "broker", name: "Asha" })).toMatch(/^Hi Asha, about the 2 BHK in HSR Layout .*still available/);
  });
});
