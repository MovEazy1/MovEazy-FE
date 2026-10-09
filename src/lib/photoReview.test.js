import { describe, expect, it, vi } from "vitest";

vi.mock("./inventory", () => ({ uploadCoverImage: vi.fn() }));
const { initialCoverFor, keptCover, photosChanged } = await import("./photoReview");
const { coverUrlWithCrop } = await import("./coverCrop");

const B = "https://x.supabase.co/storage/v1/object/public/listings/inventory/MZ-1/";
const items = [{ key: "a", src: `${B}a.jpg` }, { key: "b", src: `${B}b.jpg` }, { key: "v", src: `${B}walk.mp4`, isVideo: true }];

describe("initialCoverFor", () => {
  it("re-opens on the photo and frame chosen last time", () => {
    const cover = coverUrlWithCrop(`${B}cover-9.jpg`, `${B}b.jpg`, { cx: 0.4, cy: 0.6, zoom: 2 });
    expect(initialCoverFor(items, cover)).toEqual({ key: "b", crop: { cx: 0.4, cy: 0.6, zoom: 2 } });
  });
  it("an old cover that is just a photo opens on that photo, centred", () => {
    expect(initialCoverFor(items, `${B}a.jpg`)).toEqual({ key: "a", crop: { cx: 0.5, cy: 0.5, zoom: 1 } });
  });
  it("nothing to go on: none (the screen starts on the first photo)", () => {
    expect(initialCoverFor(items, "")).toBeNull();
  });
});

describe("keptCover", () => {
  it("keeps a framed cover while its photo is still on the listing", () => {
    const cover = coverUrlWithCrop(`${B}cover-9.jpg`, `${B}b.jpg`, { cx: 0.5, cy: 0.5, zoom: 1 });
    expect(keptCover(cover, [`${B}a.jpg`, `${B}b.jpg`])).toBe(cover);
  });
  it("falls back to the first photo once that photo is gone", () => {
    const cover = coverUrlWithCrop(`${B}cover-9.jpg`, `${B}gone.jpg`, { cx: 0.5, cy: 0.5, zoom: 1 });
    expect(keptCover(cover, [`${B}a.jpg`, `${B}b.jpg`])).toBe(`${B}a.jpg`);
  });
});

describe("photosChanged", () => {
  it("notices an addition, a removal or a new order", () => {
    const saved = [`${B}a.jpg`, `${B}b.jpg`];
    expect(photosChanged([{ src: `${B}a.jpg` }, { src: `${B}b.jpg` }], saved)).toBe(false);
    expect(photosChanged([{ src: `${B}b.jpg` }, { src: `${B}a.jpg` }], saved)).toBe(true);
    expect(photosChanged([{ src: `${B}a.jpg` }], saved)).toBe(true);
    expect(photosChanged([{ src: `${B}a.jpg` }, { src: `${B}b.jpg` }, { src: "blob:x", file: {} }], saved)).toBe(true);
  });
});

describe("building photos keep their cover in front", async () => {
  const { splitCover, withCover } = await import("./photoReview");
  it("splits a framed cover off and puts it back", () => {
    const cover = coverUrlWithCrop(`${B}cover-3.jpg`, `${B}b.jpg`, { cx: 0.5, cy: 0.5, zoom: 1 });
    expect(splitCover([cover, `${B}a.jpg`, `${B}b.jpg`])).toEqual({ cover, gallery: [`${B}a.jpg`, `${B}b.jpg`] });
    expect(withCover(cover, [`${B}b.jpg`, `${B}a.jpg`])).toEqual([cover, `${B}b.jpg`, `${B}a.jpg`]);
  });
  it("a building whose cover is just its first photo is left as it is", () => {
    expect(splitCover([`${B}a.jpg`, `${B}b.jpg`])).toEqual({ cover: "", gallery: [`${B}a.jpg`, `${B}b.jpg`] });
    expect(withCover(`${B}a.jpg`, [`${B}a.jpg`])).toEqual([`${B}a.jpg`]);
  });
});
