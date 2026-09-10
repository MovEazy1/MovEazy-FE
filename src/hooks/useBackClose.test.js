/**
 * The bug this pins shipped, and it stopped people posting a flat.
 *
 * useBackClose took `key` as an effect dependency. A wizard passed a key that
 * changed with the step, so advancing tore the history entry down and rebuilt
 * it — and the teardown's history.back() landed, asynchronously, on the
 * listener the rebuild had just registered. The step moved forward and was
 * immediately walked back. Continue looked dead from the second step on.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { markerPlan } from "./useBackClose";

const source = readFileSync("src/hooks/useBackClose.js", "utf8");

describe("one marker, however deep the flow goes", () => {
  it("puts a marker down on the first step in", () => {
    expect(markerPlan(1, false)).toBe("push");
  });

  it("does not add another for every step after that", () => {
    // One entry per step would strand someone behind a pile of same-URL
    // entries they'd have to press back through to leave the page.
    expect(markerPlan(2, true)).toBe("none");
    expect(markerPlan(6, true)).toBe("none");
  });

  it("takes the marker back up on returning to the first step", () => {
    expect(markerPlan(0, true)).toBe("pop");
  });

  it("does nothing when there's nothing to guard", () => {
    expect(markerPlan(0, false)).toBe("none");
    expect(markerPlan(-1, false)).toBe("none");
  });
});

describe("the effect that broke", () => {
  it("does not depend on the label, only on whether the overlay is open", () => {
    // `}, [open, key]);` is the exact line that made Continue stop working.
    expect(source).toMatch(/\}, \[open\]\);/);
    expect(source).not.toMatch(/\}, \[open, key\]\);/);
  });

  it("registers the step listener once, not per step", () => {
    // The listener effect must have an empty dependency array.
    const listenerEffect = source.slice(source.indexOf("export function useHistorySteps"));
    expect(listenerEffect).toMatch(/window\.addEventListener\("popstate", onPop\);[\s\S]*?\}, \[\]\);/);
  });
});
