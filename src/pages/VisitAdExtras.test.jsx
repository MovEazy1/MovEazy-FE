// @vitest-environment jsdom
/**
 * The ad / WhatsApp page's extras: a building's available flats (tap for the
 * details, the time it was open kept), and the booked visit — closed until
 * its start, then the caretaker (Instant Visit) and the property manager to
 * call, every call kept, and "How did it go?" on coming back; "call not
 * picked" offers the manager at once.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const desk = vi.fn();
const events = vi.fn();
vi.mock("../lib/visitAds", async (orig) => ({ ...(await orig()), adDesk: (...a) => desk(...a), recordAdEvent: (...a) => events(...a) }));
vi.mock("../lib/flatInsights", () => ({ recordFlatView: vi.fn() }));
const { AvailableFlats, VisitCallCard } = await import("./VisitAdExtras");

let root, host;
afterEach(() => { act(() => root?.unmount()); host?.remove(); desk.mockReset(); events.mockReset(); sessionStorage.clear(); });
async function render(el) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(el));
  await act(async () => {});
  return host;
}
const Sheet = ({ title, children }) => <div role="dialog" aria-label={title}>{children}</div>;
const button = (el, re) => [...el.querySelectorAll("button")].find((b) => re.test(b.textContent));
const FLATS = [
  { property_id: "B1", unit_no: "101", flat_type: "2 BHK", rent: 22000, maintenance: 2000, deposit: 100000, furnishing: "Semi", floor_number: 1, images: [] },
  { property_id: "B4", unit_no: "403", flat_type: "2 BHK", rent: 26000, maintenance: 2000, images: [] },
];

describe("available flats", () => {
  it("cards; tap one for its details and Schedule a visit; the time it was open kept", async () => {
    const onSchedule = vi.fn();
    const el = await render(<AvailableFlats flats={FLATS} code="H33PSH" utm={{ utm_source: "whatsapp" }} onSchedule={onSchedule} Sheet={Sheet} />);
    expect(el.textContent).toContain("Available flats · 2");
    expect(el.textContent).toContain("Flat 101 · 2 BHK");
    expect(el.textContent).toContain("₹22,000");
    expect(el.textContent).toContain("₹2,000 maintenance");
    await act(async () => button(el, /Flat 101/).click());
    const sheet = el.querySelector("[role=dialog]");
    expect(sheet.textContent).toContain("Deposit");
    expect(sheet.textContent).toContain("₹1L");
    await act(async () => button(sheet, /^Schedule a visit$/).click());
    expect(onSchedule).toHaveBeenCalled();
    expect(events).toHaveBeenCalledWith("building", "H33PSH", "flat_open", expect.objectContaining({ property: "B1", utm: { utm_source: "whatsapp" } }));
  });
  it("nothing when no flat is free", async () => {
    const el = await render(<AvailableFlats flats={[]} code="H33PSH" utm={{}} onSchedule={() => {}} Sheet={Sheet} />);
    expect(el.textContent).toBe("");
  });
});

describe("the booked visit", () => {
  const at = (ms) => new Date(Date.now() + ms).toISOString();
  it("before its start: when the call options open, and no numbers", async () => {
    const el = await render(<VisitCallCard booking={{ id: "v1", phone: "9845012345", slot_at: at(3600e3), calls_until: at(10 * 3600e3) }} />);
    expect(el.textContent).toContain("Your visit");
    expect(el.textContent).toMatch(/you can call the caretaker right here/);
    expect(el.querySelector('a[href^="tel:"]')).toBeNull();
    expect(desk).not.toHaveBeenCalled();
  });

  it("from its start: caretaker and manager to call; back from the call, how it went", async () => {
    desk.mockImplementation(async (_b, o = {}) => (o.kind && o.kind !== "contacts" ? { open: true } : {
      open: true, caretaker: { name: "Raju", phone: "9812312312" }, manager: { name: null, phone: "9146969162" },
    }));
    const booking = { id: "v2", phone: "9845012345", slot_at: at(-60e3), calls_until: at(3600e3) };
    const el = await render(<VisitCallCard booking={booking} />);
    expect(el.textContent).toContain("Instant Visit");
    expect(el.textContent).toContain("Raju");
    const care = el.querySelector('a[href="tel:+919812312312"]');
    expect(care).toBeTruthy();
    care.addEventListener("click", (e) => e.preventDefault());
    await act(async () => care.click());
    expect(desk).toHaveBeenCalledWith(booking, { kind: "call", target: "caretaker" });
    // Back on the page after the call.
    const c = JSON.parse(sessionStorage.getItem("mz_ad_called:v2"));
    sessionStorage.setItem("mz_ad_called:v2", JSON.stringify({ ...c, at: Date.now() - 10e3 }));
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(el.textContent).toContain("How did it go?");
    await act(async () => button(el, /Call not picked/).click());
    expect(desk).toHaveBeenCalledWith(booking, { kind: "feedback", feedback: "call_not_picked", note: "" });
    expect(el.querySelector('a.va-btn[href="tel:+919146969162"]').textContent).toContain("Call the property manager now");
  });

  it("an issue needs a few words", async () => {
    desk.mockResolvedValue({ open: true, caretaker: null, manager: { phone: "9146969162" } });
    const booking = { id: "v3", phone: "9845012345", slot_at: at(-60e3), calls_until: at(3600e3) };
    sessionStorage.setItem("mz_ad_called:v3", JSON.stringify({ target: "manager", at: Date.now() - 10e3 }));
    const el = await render(<VisitCallCard booking={booking} />);
    await act(async () => window.dispatchEvent(new Event("focus")));
    await act(async () => button(el, /Have some issues/).click());
    const ta = el.querySelector("textarea");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(ta, "No lift");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => button(el, /^Save$/).click());
    expect(desk).toHaveBeenLastCalledWith(booking, { kind: "feedback", feedback: "issues", note: "No lift" });
  });

  it("after that day: gone", async () => {
    const el = await render(<VisitCallCard booking={{ id: "v4", phone: "9845012345", slot_at: at(-26 * 3600e3), calls_until: at(-3600e3) }} />);
    expect(el.textContent).toBe("");
  });
});
