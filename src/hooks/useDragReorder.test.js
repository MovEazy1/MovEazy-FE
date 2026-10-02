import { describe, expect, it } from "vitest";
import { moveByKey } from "./useDragReorder";
import { orderMediaItems } from "../lib/mediaItems";

describe("moveByKey", () => {
  it("moves an item to where another is", () => {
    expect(moveByKey(["a", "b", "c", "d"], "d", "a")).toEqual(["d", "a", "b", "c"]);
    expect(moveByKey(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "c", "a", "d"]);
  });
  it("leaves the list alone for an unknown key", () => {
    const list = ["a", "b"];
    expect(moveByKey(list, "a", "z")).toBe(list);
  });
  it("works on objects through keyOf", () => {
    const list = [{ key: "x" }, { key: "y" }];
    expect(moveByKey(list, "y", "x", (m) => m.key).map((m) => m.key)).toEqual(["y", "x"]);
  });
});

describe("orderMediaItems", () => {
  it("keeps the photos in the order given and puts a video after the fourth photo", () => {
    const items = ["p1.jpg", "v.mp4", "p2.jpg", "p3.jpg", "p4.jpg", "p5.jpg"].map((url) => ({ key: url, url }));
    expect(orderMediaItems(items).map((m) => m.url)).toEqual(["p1.jpg", "p2.jpg", "p3.jpg", "p4.jpg", "v.mp4", "p5.jpg"]);
  });
  it("reads a new file's type, not its preview URL", () => {
    const video = { key: "n1", url: "blob:x", file: { name: "walk.mp4", type: "video/mp4" } };
    const photo = { key: "n2", url: "blob:y", file: { name: "a.jpg", type: "image/jpeg" } };
    expect(orderMediaItems([video, photo]).map((m) => m.key)).toEqual(["n2", "n1"]);
  });
});
