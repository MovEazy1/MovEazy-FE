// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { distanceText, metresBetween, seenAgo, spotUrl, tenantWhatsApp } from "./liveVisits";
import { bubbleVisit } from "../components/LiveVisitBubble";

describe("live visits", () => {
  it("measures and words distances", () => {
    expect(metresBetween({ lat: 12.9116, lng: 77.6474 }, { lat: 12.9125, lng: 77.6474 })).toBeGreaterThan(95);
    expect(distanceText(43)).toBe("40 m");
    expect(distanceText(4)).toBe("10 m");
    expect(distanceText(1530)).toBe("1.5 km");
    expect(distanceText(null)).toBe("");
  });
  it("says how long ago a location came in", () => {
    const now = Date.parse("2026-11-17T10:00:00Z");
    expect(seenAgo("2026-11-17T09:59:40Z", now)).toBe("just now");
    expect(seenAgo("2026-11-17T09:57:00Z", now)).toBe("3 min ago");
  });
  it("gives the tenant a link to the visit on WhatsApp", () => {
    const url = tenantWhatsApp({ id: "abc", client: { name: "Riya Shah", phone: "+91 98450 11111" }, flat: { title: "2 BHK in HSR" }, visit_at: null }, "Ravi");
    expect(url.startsWith("https://wa.me/919845011111?text=")).toBe(true);
    const text = decodeURIComponent(url);
    expect(text).toContain("Hi Riya, this is Ravi");
    expect(text).toContain("https://www.moveazy.co.in/my-visit/abc");
  });
  it("opens a spot in Google Maps", () => {
    expect(spotUrl({ lat: 12.9, lng: 77.6 })).toBe("https://www.google.com/maps/search/?api=1&query=12.9,77.6");
    expect(spotUrl({ lat: 12.9, lng: 77.6, link: "https://maps.app.goo.gl/x" })).toBe("https://maps.app.goo.gl/x");
  });
  it("puts a live visit in the bubble first, then what's waiting on this side", () => {
    const rows = [{ id: "a", status: "shared" }, { id: "b", status: "coming", live: true }, { id: "c", status: "assigned" }];
    expect(bubbleVisit(rows, "tenant").id).toBe("b");
    expect(bubbleVisit([{ id: "a", status: "shared" }, { id: "c", status: "assigned" }], "tenant").id).toBe("a");
    expect(bubbleVisit([{ id: "c", status: "assigned" }], "partner").id).toBe("c");
    expect(bubbleVisit([{ id: "c", status: "assigned" }], "tenant")).toBe(null);
  });
});
