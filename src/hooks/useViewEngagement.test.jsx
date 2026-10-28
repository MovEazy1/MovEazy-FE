// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";

const sent = [];
vi.mock("../lib/tenantViews", () => ({ reportEngagement: (...a) => { sent.push(a); return Promise.resolve(); } }));
const { default: useViewEngagement } = await import("./useViewEngagement");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, el, setIdx;
function Probe({ id }) {
  const [idx, set] = useState(0);
  setIdx = set;
  useViewEngagement(id, idx);
  return null;
}

describe("useViewEngagement", () => {
  beforeEach(() => {
    sent.length = 0;
    vi.useFakeTimers();
    el = document.createElement("div");
    document.body.appendChild(el);
    root = createRoot(el);
  });
  afterEach(() => { vi.useRealTimers(); el.remove(); });

  it("sends the visible seconds and photos seen when the property closes", async () => {
    await act(async () => root.render(<Probe id="MZ-1" />));
    await act(async () => { setIdx(1); });
    await act(async () => { setIdx(2); });
    await act(async () => { setIdx(1); });
    vi.advanceTimersByTime(45_000);
    await act(async () => root.unmount());
    expect(sent).toEqual([["MZ-1", 45, 3]]);
  });

  it("sends nothing for a glance", async () => {
    await act(async () => root.render(<Probe id="MZ-2" />));
    vi.advanceTimersByTime(800);
    await act(async () => root.unmount());
    expect(sent).toEqual([]);
  });

  it("sends when the tab is hidden, then only what's new", async () => {
    await act(async () => root.render(<Probe id="MZ-3" />));
    vi.advanceTimersByTime(10_000);
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(60_000); // hidden: doesn't count
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(5_000);
    await act(async () => root.unmount());
    expect(sent).toEqual([["MZ-3", 10, 1], ["MZ-3", 5, 1]]);
  });
});
