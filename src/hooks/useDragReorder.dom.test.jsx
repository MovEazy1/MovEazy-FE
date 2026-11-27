// @vitest-environment jsdom
// The page must scroll again once a photo has been dragged to a new place —
// on the same page, and on any page opened after it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { HOLD_MS, moveByKey, useDragReorder } from "./useDragReorder";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Grid() {
  const [list, setList] = useState(["a", "b", "c"]);
  const sort = useDragReorder((from, to) => setList((cur) => moveByKey(cur, from, to)));
  return (
    <div>
      {list.map((k) => (
        <div key={k} id={`t-${k}`} {...sort.bind(k)} style={sort.dragStyle(k)}>{k}</div>
      ))}
    </div>
  );
}

const pointer = (type, el, x = 10, y = 10) => {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, "pointerType", { value: "touch" });
  Object.defineProperty(e, "pointerId", { value: 7 });
  act(() => { el.dispatchEvent(e); });
};
const pageScrolls = () => {
  const e = new Event("touchmove", { bubbles: true, cancelable: true });
  document.body.dispatchEvent(e);
  return !e.defaultPrevented;
};

let host, root;
beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<Grid />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

const holdAndMoveAOntoB = () => {
  const a = document.getElementById("t-a");
  pointer("pointerdown", a);
  act(() => { vi.advanceTimersByTime(HOLD_MS + 10); });
  expect(pageScrolls()).toBe(false); // picked up: the page holds still under the finger
  document.elementFromPoint = () => document.getElementById("t-b");
  pointer("pointermove", document.getElementById("t-a"), 10, 60);
  expect([...host.querySelectorAll("[data-sort-key]")].map((n) => n.dataset.sortKey)).toEqual(["b", "a", "c"]);
};

describe("useDragReorder — scrolling after a drag", () => {
  it("scrolls again after the photo is let go", () => {
    holdAndMoveAOntoB();
    pointer("pointerup", document.getElementById("t-a"));
    expect(pageScrolls()).toBe(true);
  });

  it("scrolls again when the finger is lifted off the photos", () => {
    holdAndMoveAOntoB();
    pointer("pointerup", document.body);
    expect(pageScrolls()).toBe(true);
  });

  it("scrolls again after leaving the page mid-drag", () => {
    holdAndMoveAOntoB();
    act(() => root.render(<p>another page</p>));
    expect(pageScrolls()).toBe(true);
  });

  it("a swipe before the hold is up never blocks scrolling", () => {
    const a = document.getElementById("t-a");
    pointer("pointerdown", a);
    pointer("pointermove", a, 10, 40);
    act(() => { vi.advanceTimersByTime(HOLD_MS + 10); });
    expect(pageScrolls()).toBe(true);
  });
});
