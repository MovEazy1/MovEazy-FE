// @vitest-environment jsdom
/**
 * The Meta ad page: photos and details, one button; Schedule a visit asks for
 * the mobile first (unless given), then a day and an hour, books, and shows
 * the confirmation. A rented flat looks like any other.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const PAGE = {
  kind: "flat", property_id: "MZ-1", title: "2 BHK in HSR", flat_type: "2 BHK", furnishing: "Semi-furnished", area: "HSR Layout",
  landmark: "Near BDA Complex", rent: 25000, deposit: 100000, maintenance: 2000, bedrooms: 2, bathrooms: 2, amenities: ["Lift", "Parking"],
  images: [], cover_image_url: "", slots: [],
};
const lead = { phone: "" };
const booked = vi.fn(async ({ slotAt }) => ({ id: "v1", slot_at: slotAt, moved: false }));
vi.mock("../lib/visitAds", async (orig) => ({ ...(await orig()), fetchAdPage: vi.fn(async () => PAGE), bookAdVisit: (...a) => booked(...a) }));
vi.mock("../lib/leadIntake", () => ({ leadSnapshot: () => ({ ...lead }) }));
vi.mock("../lib/flatInsights", () => ({ recordFlatView: vi.fn() }));
vi.mock("../lib/buildings", async (orig) => ({ ...(await orig()), recordBuildingView: vi.fn() }));
vi.mock("../lib/tenantViews", () => ({ reportEngagement: vi.fn() }));
const pixel = vi.fn();
vi.mock("../lib/metaPixel", () => ({ trackPixel: (...a) => pixel(...a) }));
vi.mock("../components/RequirePhoneFirst", () => ({
  default: ({ open, onDone }) => (open ? <button type="button" onClick={() => { lead.phone = "9845012345"; onDone("9845012345"); }}>Give number</button> : null),
}));
const VisitAdPage = (await import("./VisitAdPage")).default;

let root, host;
afterEach(() => { act(() => root?.unmount()); host?.remove(); lead.phone = ""; booked.mockClear(); pixel.mockClear(); });
async function mount(path = "/visit/MZ-1?utm_source=facebook&utm_campaign=MZ-1") {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/visit/:id" element={<VisitAdPage kind="flat" />} />
        <Route path="/tenant" element={<div>Find my home</div>} />
      </Routes></MemoryRouter>);
  });
  await act(async () => {});
  return document.body;
}
const button = (el, re) => [...el.querySelectorAll("button")].find((b) => re.test(b.textContent));

describe("Visit ad page", () => {
  it("photos, details and one button — no links away", async () => {
    const el = await mount();
    expect(el.textContent).toContain("2 BHK · Semi-furnished");
    expect(el.textContent).toContain("₹25,000");
    expect(el.textContent).toContain("HSR Layout · Near BDA Complex");
    expect(el.textContent).toContain("Maintenance");
    expect(el.textContent).not.toMatch(/rented|occupied|taken/i);
    expect(host.querySelectorAll("a").length).toBe(0);
    expect(button(el, /Schedule a visit/)).toBeTruthy();
  });

  it("mobile first, then a day and an hour, then booked", async () => {
    const el = await mount();
    await act(async () => button(el, /Schedule a visit/).click());
    await act(async () => button(el, /Give number/).click());
    const sheet = el.querySelector("[role=dialog]");
    expect(sheet.textContent).toContain("9845012345");
    const slot = [...sheet.querySelectorAll(".va-slots button")][0];
    await act(async () => slot.click());
    const name = sheet.querySelector("input");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(name, "Ravi");
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => button(sheet, /^Book · /).click());
    expect(booked).toHaveBeenCalledTimes(1);
    const arg = booked.mock.calls[0][0];
    expect(arg).toMatchObject({ kind: "flat", ref: "MZ-1", phone: "9845012345", name: "Ravi", utm: { utm_source: "facebook", utm_campaign: "MZ-1" } });
    const done = el.querySelector("[role=dialog]");
    expect(done.textContent).toContain("Your visit is booked");
    expect(done.textContent).toContain("exact location on WhatsApp");
    expect(done.querySelector('a[href^="https://calendar.google.com"]')).toBeTruthy();
  });

  it("/visit/<building code>, the earlier address, opens the building's page", async () => {
    const { fetchAdPage } = await import("../lib/visitAds");
    fetchAdPage.mockClear();
    await mount("/visit/H33PSH");
    expect(fetchAdPage).toHaveBeenCalledWith("building", "H33PSH");
  });

  it("a number already given goes straight to the times", async () => {
    lead.phone = "9811122233";
    const el = await mount();
    await act(async () => button(el, /Schedule a visit/).click());
    expect(button(el, /Give number/)).toBeFalsy();
    expect(el.querySelector("[role=dialog]").textContent).toContain("Pick a time");
  });

  it("Explore more: the mobile first, then the find-a-home flow, with the ad's UTM", async () => {
    const el = await mount();
    await act(async () => button(el, /Explore more/).click());
    expect(pixel).toHaveBeenCalledWith("ExploreMoreClick", expect.objectContaining({ content_ids: ["MZ-1"] }), { custom: true });
    await act(async () => button(el, /Give number/).click());
    expect(pixel).toHaveBeenCalledWith("PhoneSubmitted", expect.objectContaining({ content_name: "explore" }),
      expect.objectContaining({ custom: true, user: { phone: "9845012345" } }));
    expect(el.textContent).toContain("Find my home");
  });

  it("Explore more with a number already given goes straight there", async () => {
    lead.phone = "9845012345";
    const el = await mount();
    await act(async () => button(el, /Explore more/).click());
    expect(button(el, /Give number/)).toBeFalsy();
    expect(el.textContent).toContain("Find my home");
  });

  it("Schedule a visit is counted on the click, and the number by which button asked", async () => {
    const el = await mount();
    await act(async () => button(el, /Schedule a visit/).click());
    expect(pixel).toHaveBeenCalledWith("ScheduleVisitClick", expect.objectContaining({ content_ids: ["MZ-1"] }), { custom: true });
    await act(async () => button(el, /Give number/).click());
    expect(pixel).toHaveBeenCalledWith("PhoneSubmitted", expect.objectContaining({ content_name: "schedule" }), expect.anything());
  });
});
