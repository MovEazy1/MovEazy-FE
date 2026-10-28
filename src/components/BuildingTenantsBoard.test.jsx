// @vitest-environment jsdom
/**
 * A building's tenants board: the numbers, the filters, Call / WhatsApp, and
 * Update only where it's offered — and a tenant who viewed a flat through
 * MovEazy: the flats, where they stand, and for the owner no number.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import BuildingTenantsBoard from "./BuildingTenantsBoard";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const TENANTS = [
  { phone: "9822200000", name: "From QR", last_at: "2026-10-28T10:00:00Z", track: null,
    qr: { first_at: "2026-10-28T09:00:00Z", asked: 1, called: ["caretaker"], feedback: [{ kind: "call_not_picked", note: "", at: "2026-10-28T09:05:00Z" }] } },
  { phone: "9876543210", name: "Ravi", last_at: "2026-10-27T10:00:00Z", qr: null,
    track: { id: "t1", visit: "done", liked: "liked", liked_status: "will_pay_token", reasons: [], flats: ["504"], note: "Wants parking",
      follow_up_on: "2000-01-01", updated_at: "2026-10-27T10:00:00Z", updated_by: "agent@moveazy.co.in" } },
];
const VIEWER = { key: "k-neha", phone: null, name: "Neha Web", last_at: "2026-10-26T10:00:00Z", qr: null, track: null, via: "moveazy",
  views: [{ property_id: "MZ-102", unit_no: "102", opens: 3, last_at: "2026-10-26T10:00:00Z" }],
  status: { visit: "", liked: "disliked", liked_status: "", reasons: ["size_small"], follow_up_on: null } };
let root, host;
afterEach(() => { act(() => root?.unmount()); host?.remove(); });
async function mount(props) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(<BuildingTenantsBoard tenants={TENANTS} {...props} />));
  return host;
}

describe("BuildingTenantsBoard", () => {
  it("shows the numbers and every tenant with Call and WhatsApp", async () => {
    const el = await mount();
    expect(el.textContent).toContain("Tenants · 2");
    expect(el.textContent).toMatch(/1\s*From QR/);
    expect(el.textContent).toContain("Liked · Will pay token");
    expect(el.textContent).toContain("called the caretaker");
    expect(el.textContent).toContain("said: Call not picked");
    expect(el.textContent).toContain("Follow up");
    expect(el.querySelector('a[href="tel:+919822200000"]')).toBeTruthy();
    expect(el.querySelector('a[href="https://wa.me/919876543210"]')).toBeTruthy();
    expect([...el.querySelectorAll("button")].some((b) => /^(Add|Update) status$/.test(b.textContent))).toBe(false);
  });

  it("filters, and offers Add / Update status in the CRM", async () => {
    const onUpdate = vi.fn();
    const el = await mount({ onUpdate });
    const chip = [...el.querySelectorAll("button")].find((b) => b.textContent.startsWith("Follow-up due"));
    await act(async () => chip.click());
    expect(el.textContent).toContain("Ravi");
    expect(el.textContent).not.toContain("9822200000".replace(/(\d{5})(\d{5})/, "$1 $2"));
    await act(async () => [...el.querySelectorAll("button")].find((b) => b.textContent === "Update status").click());
    expect(onUpdate).toHaveBeenCalledWith(TENANTS[1]);
  });

  it("a MovEazy website viewer: the flats they viewed, how it went, no number for the owner", async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<BuildingTenantsBoard tenants={[...TENANTS, VIEWER]} />));
    expect(host.textContent).toMatch(/1\s*Via MovEazy Website/);
    expect(host.textContent).toContain("Viewed 102 ×3 on the MovEazy website");
    expect(host.textContent).toContain("Did not like · Size is small");
    const card = [...host.querySelectorAll("strong")].find((s) => s.textContent === "Neha Web").closest("div").parentElement;
    expect(card.textContent).toContain("MovEazy Website");
    expect(card.querySelector('a[href^="tel:"]')).toBeNull();
    const chip = [...host.querySelectorAll("button")].find((b) => b.textContent.startsWith("Did not like"));
    await act(async () => chip.click());
    expect(host.textContent).toContain("Neha Web");
    expect(host.textContent).not.toContain("Wants parking");
  });
});
