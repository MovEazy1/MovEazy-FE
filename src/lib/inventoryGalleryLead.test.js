import { describe, expect, it } from "vitest";
import { galleryLeadPhoto } from "./inventory";

const BASE = "https://x.supabase.co/storage/v1/object/public/listings/inventory/MZ-1";

describe("the flat page's first photo, preloaded as the app starts", () => {
  it("is the first photo's 480 px thumbnail", () => {
    const row = { property_id: "MZ-1", status: "published", images: [`${BASE}/a.jpg`, `${BASE}/b.jpg`] };
    expect(galleryLeadPhoto(row)).toBe("https://x.supabase.co/storage/v1/object/public/listings/thumbs/inventory/MZ-1/a.jpg");
  });
  it("a video first: the cover photo behind it", () => {
    const row = { property_id: "MZ-1", status: "published", images: [`${BASE}/walk.mp4`, `${BASE}/b.jpg`] };
    expect(galleryLeadPhoto(row)).toMatch(/thumbs\/inventory\/MZ-1\/b\.jpg$/);
  });
  it("no photo at all: nothing to preload", () => {
    expect(galleryLeadPhoto({ property_id: "MZ-1", status: "published", images: [] })).toBe("");
    expect(galleryLeadPhoto(null)).toBe("");
  });
});
