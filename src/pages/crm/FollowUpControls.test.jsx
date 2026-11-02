// @vitest-environment jsdom
/**
 * Follow up and Assign partner: an outcome suggests the next date and saves
 * with it; no active client is saved without a next date; an outcome that
 * ends the search may go without; partners with flats in the client's areas
 * come first, and assigning can take the client off the partners they had.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const save = vi.fn();
const assign = vi.fn();
vi.mock("../../lib/followUps", async (orig) => ({
  ...(await orig()),
  saveFollowUp: (...a) => save(...a),
  assignPartners: (...a) => assign(...a),
  fetchFollowUpSettings: async () => ({ team: ["asha@moveazy.in"] }),
  fetchPartnerPicker: async () => [
    { broker_id: "b1", name: "Far Broker", agency: "", phone: "9811111111", open: 0, areas: ["Whitefield"] },
    { broker_id: "b2", name: "HSR Homes", agency: "", phone: "9822222222", open: 4, areas: ["HSR"] },
  ],
}));
vi.mock("../../lib/tenantViews", () => ({
  fetchBrokerActivity: async () => [{ assignment_id: "a1", broker_id: "b9", broker_name: "Old Partner", status: "contacted" }],
}));
vi.mock("./CrmShell", () => ({ useCrm: () => null }));
const { AssignPartnerSheet, FollowUpSheet } = await import("./FollowUpControls");

let root, host;
afterEach(() => { act(() => root?.unmount()); host?.remove(); save.mockReset(); assign.mockReset(); });
async function render(el) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(el));
  await act(async () => {});
  return host;
}
const button = (el, re) => [...el.querySelectorAll("button")].find((b) => re.test(b.textContent));
const client = { id: "c1", name: "Ravi", phone: "9845012345", assigned_to: "" };

describe("FollowUpSheet", () => {
  it("an outcome fills in the next date, and saves both", async () => {
    save.mockResolvedValue({ ...client, next_follow_up_at: "2026-11-03T04:30:00Z" });
    const onSaved = vi.fn();
    const el = await render(<FollowUpSheet client={client} onClose={() => {}} onSaved={onSaved} />);
    await act(async () => button(el, /^Not picked$/).click());
    expect(el.querySelector('input[type="date"]').value).not.toBe("");
    await act(async () => button(el, /^Save$/).click());
    expect(save).toHaveBeenCalledWith("c1", expect.objectContaining({ outcome: "not_picked", next_at: expect.any(Date) }));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }), "not_picked");
  });
  it("no next date, no save — unless the search is over", async () => {
    save.mockResolvedValue({ ...client });
    const el = await render(<FollowUpSheet client={client} onClose={() => {}} onSaved={() => {}} />);
    await act(async () => button(el, /^Save$/).click());
    expect(save).not.toHaveBeenCalled();
    expect(el.textContent).toContain("every active client needs one");
    await act(async () => button(el, /^Not interested$/).click());
    await act(async () => button(el, /^Save$/).click());
    expect(save).toHaveBeenCalledWith("c1", expect.objectContaining({ outcome: "not_interested", next_at: "" }));
  });
});

describe("AssignPartnerSheet", () => {
  it("partners in the client's areas first; take it off the old one", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    assign.mockResolvedValue({ added: [{ broker_id: "b2", name: "HSR Homes", phone: "9822222222" }], removed: 1, client: { name: "Ravi", phone: "9845012345", need: "2 BHK · HSR" } });
    const el = await render(<AssignPartnerSheet client={client} areas={["HSR"]} onClose={() => {}} />);
    const names = [...el.querySelectorAll("label b")].map((b) => b.textContent);
    expect(names).toEqual(["HSR Homes", "Far Broker"]);
    expect(el.textContent).toContain("With Old Partner now.");
    await act(async () => el.querySelectorAll('input[type="radio"]')[1].click());
    await act(async () => el.querySelectorAll('label input[type="checkbox"]')[0].click());
    await act(async () => button(el, /^Assign 1$/).click());
    expect(assign).toHaveBeenCalledWith("c1", ["b2"], { replace: true, note: "" });
    expect(el.textContent).toContain("Taken off 1 other partner");
    expect(el.querySelector('a[href^="https://wa.me/919822222222"]')).toBeTruthy();
  });
});
