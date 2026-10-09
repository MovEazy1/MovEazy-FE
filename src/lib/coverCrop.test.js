import { describe, expect, it } from "vitest";
import { DEFAULT_CROP, clampCrop, cropRect, frameSize, galleryOf, isMadeCover } from "./coverCrop";

const close = (a, b) => Math.abs(a - b) < 1e-6;

describe("the 4:3 frame", () => {
  it("starts as the largest 4:3 that fits, centred", () => {
    // A tall phone photo: the full width, a 4:3 band across the middle.
    expect(frameSize(3000, 4000)).toEqual({ w: 3000, h: 2250 });
    expect(cropRect(3000, 4000, DEFAULT_CROP)).toEqual({ sx: 0, sy: 875, sw: 3000, sh: 2250 });
    // A wide one: the full height.
    expect(frameSize(4000, 2000)).toEqual({ w: 2000 * (4 / 3), h: 2000 });
  });
  it("zooms in around its centre", () => {
    const r = cropRect(4000, 3000, { cx: 0.5, cy: 0.5, zoom: 2 });
    expect(r).toEqual({ sx: 1000, sy: 750, sw: 2000, sh: 1500 });
  });
  it("never leaves the photo, however far it is slid", () => {
    const c = clampCrop(3000, 4000, { cx: 0.9, cy: 0.01, zoom: 1 });
    expect(c.cx).toBe(0.5); // full width: no room to slide sideways
    expect(close(c.cy, 2250 / 2 / 4000)).toBe(true);
    const r = cropRect(3000, 4000, { cx: 0.5, cy: 1, zoom: 1 });
    expect(r.sy + r.sh).toBe(4000);
  });
  it("keeps zoom between 1 and 4", () => {
    expect(clampCrop(100, 100, { cx: 0.5, cy: 0.5, zoom: 9 }).zoom).toBe(4);
    expect(clampCrop(100, 100, { cx: 0.5, cy: 0.5, zoom: 0.2 }).zoom).toBe(1);
  });
});

describe("made covers and the gallery", () => {
  const base = "https://x.supabase.co/storage/v1/object/public/listings/inventory/MZ-1/";
  it("tells a made cover from a photo", () => {
    expect(isMadeCover(`${base}cover-1791234567890.jpg`)).toBe(true);
    expect(isMadeCover(`${base}1791234567890-cover-photo.jpg`)).toBe(false);
    expect(isMadeCover("")).toBe(false);
  });
  it("leaves a made cover out of the gallery, keeps an old photo-cover first", () => {
    expect(galleryOf(`${base}cover-1.jpg`, [`${base}a.jpg`, `${base}b.jpg`])).toEqual([`${base}a.jpg`, `${base}b.jpg`]);
    expect(galleryOf(`${base}b.jpg`, [`${base}a.jpg`, `${base}b.jpg`])).toEqual([`${base}b.jpg`, `${base}a.jpg`]);
  });
});

describe("a made cover remembers its frame", async () => {
  const { coverUrlWithCrop, readCoverCrop, sameMedia } = await import("./coverCrop");
  const base = "https://x.supabase.co/storage/v1/object/public/listings/inventory/MZ-1/";
  it("round-trips the source photo and the crop", () => {
    const url = coverUrlWithCrop(`${base}cover-17.jpg`, `${base}a.jpg?x=1`, { cx: 0.3, cy: 0.62, zoom: 1.5 });
    expect(isMadeCover(url)).toBe(true);
    const r = readCoverCrop(url);
    expect(r.src).toBe(`${base}a.jpg`);
    expect(r.crop).toEqual({ cx: 0.3, cy: 0.62, zoom: 1.5 });
    expect(sameMedia(r.src, `${base}a.jpg?v=2`)).toBe(true);
  });
  it("a plain photo has no frame to read", () => {
    expect(readCoverCrop(`${base}a.jpg`)).toBeNull();
  });
});
