import { describe, expect, it } from "vitest";
import {
  MAX_ZOOM, NO_ZOOM, clampPan, containSize, doubleTapZoom, dragTarget, pinchTo, slideIndex, swipeDownCloses, zoomAround,
} from "./photoGestures";

describe("slideIndex", () => {
  it("rounds to the nearest slide and stays in range", () => {
    expect(slideIndex(0, 400, 5)).toBe(0);
    expect(slideIndex(590, 400, 5)).toBe(1);
    expect(slideIndex(610, 400, 5)).toBe(2);
    expect(slideIndex(99999, 400, 5)).toBe(4);
    expect(slideIndex(-30, 400, 5)).toBe(0);
  });
  it("copes with nothing to measure", () => {
    expect(slideIndex(100, 0, 5)).toBe(0);
    expect(slideIndex(100, 400, 0)).toBe(0);
  });
});

describe("dragTarget", () => {
  it("a fifth of a slide moves one photo; less springs back", () => {
    expect(dragTarget(2, -100, 400, 5)).toBe(3);
    expect(dragTarget(2, 100, 400, 5)).toBe(1);
    expect(dragTarget(2, -60, 400, 5)).toBe(2);
  });
  it("never runs off either end", () => {
    expect(dragTarget(0, 300, 400, 5)).toBe(0);
    expect(dragTarget(4, -300, 400, 5)).toBe(4);
  });
});

describe("containSize", () => {
  it("fits a landscape photo to the width of a tall box", () => {
    expect(containSize(1600, 1200, 400, 800)).toEqual({ w: 400, h: 300 });
  });
  it("fits a portrait photo to the height of a wide box", () => {
    expect(containSize(900, 1600, 1000, 800)).toEqual({ w: 450, h: 800 });
  });
  it("falls back to the box before the photo has loaded", () => {
    expect(containSize(0, 0, 400, 800)).toEqual({ w: 400, h: 800 });
  });
});

describe("clampPan", () => {
  const pic = { w: 400, h: 300 };
  const box = { w: 400, h: 800 };
  it("can't move an unzoomed photo", () => {
    expect(clampPan({ s: 1, x: 50, y: -50 }, pic, box)).toEqual({ s: 1, x: 0, y: 0 });
  });
  it("lets a zoomed photo move as far as its edge, no further", () => {
    // 2× → 800×600 in a 400×800 box: 200 px spare sideways, none up or down.
    expect(clampPan({ s: 2, x: 500, y: 100 }, pic, box)).toEqual({ s: 2, x: 200, y: 0 });
    expect(clampPan({ s: 4, x: -900, y: -900 }, pic, box)).toEqual({ s: 4, x: -600, y: -200 });
  });
});

describe("zoomAround", () => {
  it("keeps the point under the finger in place", () => {
    const z = zoomAround(NO_ZOOM, { x: 100, y: -40 }, 2);
    // That point was picture point (100, -40); at 2× it shows at x + 2·c.
    expect(z.x + 2 * 100).toBeCloseTo(100);
    expect(z.y + 2 * -40).toBeCloseTo(-40);
  });
  it("is held between 1× and the most zoom", () => {
    expect(zoomAround(NO_ZOOM, { x: 0, y: 0 }, 10).s).toBe(MAX_ZOOM);
    expect(zoomAround({ s: 2, x: 10, y: 10 }, { x: 0, y: 0 }, 0.2).s).toBe(1);
  });
});

describe("pinchTo", () => {
  it("spreading two fingers zooms about their midpoint", () => {
    const z = pinchTo(NO_ZOOM, { x: 50, y: 0 }, { x: 50, y: 0 }, 2);
    expect(z).toEqual({ s: 2, x: -50, y: 0 });
  });
  it("moving the midpoint drags the photo with it", () => {
    const z = pinchTo({ s: 2, x: 0, y: 0 }, { x: 0, y: 0 }, { x: 30, y: 20 }, 1);
    expect(z).toEqual({ s: 2, x: 30, y: 20 });
  });
});

describe("doubleTapZoom", () => {
  it("zooms in where tapped, then back out", () => {
    const zin = doubleTapZoom(NO_ZOOM, { x: 40, y: 0 });
    expect(zin.s).toBe(2.5);
    expect(zin.x + 2.5 * 40).toBeCloseTo(40);
    expect(doubleTapZoom(zin, { x: 0, y: 0 })).toEqual(NO_ZOOM);
  });
});

describe("swipeDownCloses", () => {
  it("closes on a long drag or a quick flick", () => {
    expect(swipeDownCloses(140, 900)).toBe(true);
    expect(swipeDownCloses(70, 100)).toBe(true);
  });
  it("springs back from a short slow one, or an upward one", () => {
    expect(swipeDownCloses(70, 600)).toBe(false);
    expect(swipeDownCloses(-200, 100)).toBe(false);
  });
});
