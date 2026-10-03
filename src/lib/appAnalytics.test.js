import { describe, expect, it } from "vitest";
import { cleanLabel, currentApp, describeTarget } from "./appAnalytics";

const loc = (hostname, pathname = "/") => ({ hostname, pathname });

describe("currentApp", () => {
  it("knows the two apps by host or path", () => {
    expect(currentApp(loc("owners.moveazy.co.in"))).toBe("owner");
    expect(currentApp(loc("owner.moveazy.co.in", "/properties"))).toBe("owner");
    expect(currentApp(loc("partners.moveazy.co.in"))).toBe("partner");
    expect(currentApp(loc("www.moveazy.co.in", "/owners/properties"))).toBe("owner");
    expect(currentApp(loc("www.moveazy.co.in", "/partners"))).toBe("partner");
  });
  it("and nothing else", () => {
    expect(currentApp(loc("www.moveazy.co.in", "/crm/clients"))).toBe("");
    expect(currentApp(loc("www.moveazy.co.in", "/ownership"))).toBe("");
  });
});

describe("cleanLabel", () => {
  it("never keeps a number or an email", () => {
    expect(cleanLabel("Call 98765 43210")).toBe("Call ••••");
    expect(cleanLabel("+91 98765-43210 · WhatsApp")).toBe("•••• · WhatsApp");
    expect(cleanLabel("Mail priya@example.com")).toBe("Mail •••@•••");
  });
  it("keeps short numbers that are part of the words", () => {
    expect(cleanLabel("Flats · 12")).toBe("Flats · 12");
    expect(cleanLabel("2 BHK · ₹30,000")).toBe("2 BHK · ₹30,000");
  });
  it("collapses space and caps the length", () => {
    expect(cleanLabel("  Add \n  property ")).toBe("Add property");
    expect(cleanLabel("x".repeat(500))).toHaveLength(120);
  });
});

describe("describeTarget", () => {
  // The bits of an element describeTarget reads (the test environment has no DOM).
  const fake = (tag, attrs = {}, text = "", { clickable = true, label = null } = {}) => {
    const node = {
      tagName: tag.toUpperCase(), innerText: text, textContent: text,
      getAttribute: (k) => attrs[k] ?? null,
      querySelector: () => null,
      closest: (sel) => (sel === "label" ? label : clickable ? node : null),
    };
    return node;
  };
  it("names a button by its words, or its aria-label", () => {
    expect(describeTarget(fake("button", {}, "Add property"))).toEqual({ label: "Add property", target: "button" });
    expect(describeTarget(fake("button", { "aria-label": "Close" }))).toEqual({ label: "Close", target: "button" });
  });
  it("tells links, tabs and toggles apart", () => {
    expect(describeTarget(fake("a", { href: "/x" }, "Open"))?.target).toBe("link");
    expect(describeTarget(fake("button", { role: "tab" }, "Visits"))?.target).toBe("tab");
    expect(describeTarget(fake("input", { type: "checkbox", name: "wifi" }, "", { label: { innerText: " Wi-Fi" } })))
      .toEqual({ label: "Wi-Fi", target: "toggle" });
  });
  it("masks a number on a button", () => {
    expect(describeTarget(fake("a", { href: "tel:+919876543210" }, "98765 43210"))?.label).toBe("••••");
  });
  it("ignores a tap on nothing in particular", () => {
    expect(describeTarget(fake("p", {}, "text", { clickable: false }))).toBeNull();
  });
});
