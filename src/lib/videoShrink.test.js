import { describe, expect, it } from "vitest";
import { STORAGE_LIMIT_BYTES, VIDEO_TARGET_BYTES, fitSize, pickRecorderType, targetBitrate } from "./videoShrink";

describe("video shrinking", () => {
  it("aims under the 50 MB upload limit", () => {
    expect(VIDEO_TARGET_BYTES).toBeLessThan(STORAGE_LIMIT_BYTES);
  });

  it("picks a bitrate that fits the length, within sane bounds", () => {
    // 2 minutes into ~44 MB: about 2.7 Mbps of video.
    const two = targetBitrate(120);
    expect(two).toBeGreaterThan(2_400_000);
    expect(two).toBeLessThan(2_800_000);
    expect(((two + 96_000) * 120) / 8).toBeLessThan(VIDEO_TARGET_BYTES);
    expect(targetBitrate(10)).toBe(4_000_000); // a short clip never balloons past 4 Mbps
    expect(targetBitrate(3600)).toBe(250_000); // a long one never drops below watchable
  });

  it("fits frames inside 720p, even-sized, never upscaled", () => {
    expect(fitSize(3840, 2160)).toEqual([1280, 720]);
    expect(fitSize(1080, 1920)).toEqual([720, 1280]); // a portrait phone video
    expect(fitSize(640, 360)).toEqual([640, 360]);
    expect(fitSize(1281, 721).every((n) => n % 2 === 0)).toBe(true);
  });

  it("prefers MP4, falls back to WebM, and says so when it has neither", () => {
    expect(pickRecorderType((t) => t.startsWith("video/mp4"))).toMatch(/^video\/mp4/);
    expect(pickRecorderType((t) => t === "video/webm;codecs=vp8,opus")).toBe("video/webm;codecs=vp8,opus");
    expect(pickRecorderType(() => false)).toBe("");
  });
});
