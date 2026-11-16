// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { distanceLabel, partnerWhatsApp, slotLabel, stageLabel } from "./societyPartners";
import { rentLine } from "../pages/find/FindSocieties";

describe("society partners", () => {
  it("writes distances the way a partner reads them", () => {
    expect(distanceLabel(84)).toBe("80 m");
    expect(distanceLabel(1240)).toBe("1.2 km");
    expect(distanceLabel(null)).toBe("");
  });
  it("opens WhatsApp to the partner with the agreed message", () => {
    const url = partnerWhatsApp("+91 98450 12345", "Ravi", "Sobha Silicon Oasis");
    expect(url.startsWith("https://wa.me/919845012345?text=")).toBe(true);
    expect(decodeURIComponent(url)).toContain("Hi Ravi, I am Interested in a flat in Sobha Silicon Oasis & got your contact via MovEazy. Can you please share the available options at the earliest.");
  });
  it("labels slots and stages", () => {
    expect(slotLabel("balcony")).toBe("Balcony / view");
    expect(stageLabel("visit_set")).toBe("Visit set");
  });
  it("leads with the 2 BHK rent", () => {
    expect(rentLine({ "3": [55000, 70000], "2": [38000, 45000] })).toBe("2 BHK ₹38k–45k");
    expect(rentLine({ "1rk": [15000, 18000] })).toBe("1 RK ₹15k–18k");
    expect(rentLine({})).toBe("");
  });
});
