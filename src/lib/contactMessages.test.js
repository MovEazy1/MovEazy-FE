import { describe, expect, it } from "vitest";
import { cleanMobile } from "./contactMessages";

describe("cleanMobile", () => {
  it("takes +91, spaces and dashes", () => expect(cleanMobile("+91 98765-43210")).toBe("9876543210"));
  it("a plain 10-digit mobile", () => expect(cleanMobile("8090911024")).toBe("8090911024"));
  it("not a mobile", () => {
    expect(cleanMobile("12345")).toBe("");
    expect(cleanMobile("5876543210")).toBe("");
    expect(cleanMobile("")).toBe("");
  });
});
