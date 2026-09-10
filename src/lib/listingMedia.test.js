/**
 * The display-order rule is a promise made to every listing, so it's tested
 * rather than eyeballed on one flat that happened to have three photos.
 */
import { describe, expect, it } from "vitest";
import {
  coverMedia, coverPhoto, describeMedia, isVideoUrl, orderListingMedia, splitMedia,
} from "./listingMedia";

const p = (n) => `https://cdn.test/inventory/MZ-1/photo-${n}.jpg`;
const v = (n) => `https://cdn.test/inventory/MZ-1/clip-${n}.mp4`;

describe("telling a video from a photo", () => {
  it("reads the extension, including through a query string", () => {
    expect(isVideoUrl(v(1))).toBe(true);
    expect(isVideoUrl(`${v(1)}?token=abc`)).toBe(true);
    expect(isVideoUrl(p(1))).toBe(false);
  });

  it("does not call a photo a video because of its filename", () => {
    // The check this replaces was `url.includes("video")`.
    expect(isVideoUrl("https://cdn.test/inventory/MZ-1/video-tour-still.jpg")).toBe(false);
  });

  it("still honours a /video/ path segment for older uploads", () => {
    expect(isVideoUrl("https://cdn.test/listings/video/walkthrough")).toBe(true);
  });
});

describe("display order", () => {
  it("puts the video after the fourth photo", () => {
    const ordered = orderListingMedia([v(1), p(1), p(2), p(3), p(4), p(5), p(6)]);
    expect(ordered).toEqual([p(1), p(2), p(3), p(4), v(1), p(5), p(6)]);
  });

  it("keeps photos first when there aren't four of them", () => {
    expect(orderListingMedia([v(1), p(1), p(2)])).toEqual([p(1), p(2), v(1)]);
  });

  it("leaves a photo-only listing exactly as the poster ordered it", () => {
    const only = [p(3), p(1), p(2)];
    expect(orderListingMedia(only)).toEqual(only);
  });

  it("keeps several videos together, in their own order", () => {
    expect(orderListingMedia([p(1), p(2), p(3), p(4), p(5), v(2), v(1)]))
      .toEqual([p(1), p(2), p(3), p(4), v(2), v(1), p(5)]);
  });

  it("is idempotent, so applying it at more than one layer is safe", () => {
    const once = orderListingMedia([v(1), p(1), p(2), p(3), p(4), p(5)]);
    expect(orderListingMedia(once)).toEqual(once);
  });

  it("drops empty slots rather than rendering a broken tile", () => {
    expect(orderListingMedia([p(1), "", null, v(1)])).toEqual([p(1), v(1)]);
  });
});

describe("cover and counts", () => {
  it("never picks a video as the cover", () => {
    expect(coverPhoto([v(1), p(1)])).toBe(p(1));
  });

  it("has no cover when a listing is video-only", () => {
    expect(coverPhoto([v(1)])).toBe("");
  });

  it("splits and describes what's there", () => {
    expect(splitMedia([p(1), v(1), p(2)])).toEqual({ photos: [p(1), p(2)], videos: [v(1)] });
    expect(describeMedia([p(1), v(1), p(2)])).toBe("2 photos · 1 video");
    expect(describeMedia([])).toBe("nothing yet");
  });
});

describe("the one thumbnail a card gets", () => {
  it("prefers a photo whenever there is one", () => {
    expect(coverMedia([v(1), p(1), v(2)])).toBe(p(1));
  });

  it("falls back to the video rather than showing an empty box", () => {
    // A listing may be video-only; requiring a photo was relaxed deliberately.
    expect(coverMedia([v(1), v(2)])).toBe(v(1));
  });

  it("is empty only when the listing has no media at all", () => {
    expect(coverMedia([])).toBe("");
    expect(coverMedia(["", null])).toBe("");
  });
});
