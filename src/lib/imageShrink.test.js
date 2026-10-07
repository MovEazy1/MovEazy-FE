import { describe, expect, it } from "vitest";
import { fitWithin, jpegName, thumbPath, thumbUrl } from "./imageShrink";

const BASE = "https://yspladsmazxklcfehimi.supabase.co/storage/v1/object/public/listings/";

describe("fitWithin", () => {
  it("shrinks the long side to the limit, keeping the shape", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(4032, 3024, 480)).toEqual({ width: 480, height: 360 });
  });
  it("never enlarges a small photo", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

describe("thumbUrl", () => {
  it("points a stored photo at its thumbnail", () => {
    expect(thumbUrl(`${BASE}inventory/MZ-1/123-a.jpg`)).toBe(`${BASE}thumbs/inventory/MZ-1/123-a.jpg`);
    expect(thumbUrl(`${BASE}inventory/MZ-1/123-a.JPEG?v=2`)).toBe(`${BASE}thumbs/inventory/MZ-1/123-a.JPEG?v=2`);
  });
  it("leaves videos, thumbnails, other hosts and local files alone", () => {
    expect(thumbUrl(`${BASE}inventory/MZ-1/walk.mp4`)).toBe(`${BASE}inventory/MZ-1/walk.mp4`);
    expect(thumbUrl(`${BASE}thumbs/inventory/MZ-1/a.jpg`)).toBe(`${BASE}thumbs/inventory/MZ-1/a.jpg`);
    expect(thumbUrl("https://images.unsplash.com/x.jpg")).toBe("https://images.unsplash.com/x.jpg");
    expect(thumbUrl("/home.png")).toBe("/home.png");
    expect(thumbUrl("")).toBe("");
  });
  it("and the storage path follows the same rule", () => {
    expect(thumbPath("inventory/MZ-1/a.jpg")).toBe("thumbs/inventory/MZ-1/a.jpg");
  });
});

describe("jpegName", () => {
  it("gives the copy a .jpg name", () => {
    expect(jpegName("IMG_1234.HEIC")).toBe("IMG_1234.jpg");
    expect(jpegName("flat.png")).toBe("flat.jpg");
    expect(jpegName("")).toBe("photo.jpg");
  });
});
