import { describe, expect, it } from "vitest";
import { isGmailAddress } from "./emailPolicy.js";

describe("isGmailAddress", () => {
  it("accepts @gmail.com and @googlemail.com", () => {
    expect(isGmailAddress("user.name+tag@gmail.com")).toBe(true);
    expect(isGmailAddress("alias@googlemail.com")).toBe(true);
  });

  it("rejects other providers", () => {
    expect(isGmailAddress("user@yahoo.com")).toBe(false);
    expect(isGmailAddress("user@company.com")).toBe(false);
  });

  it("rejects invalid shapes", () => {
    expect(isGmailAddress("not-an-email")).toBe(false);
    expect(isGmailAddress("a..b@gmail.com")).toBe(false);
  });
});
