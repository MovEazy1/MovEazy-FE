import { describe, expect, it } from "vitest";
import { defaultWashrooms } from "./partnerMatch";
import { ROOM_LABEL } from "./partnerFilters";

describe("defaultWashrooms", () => {
  it("follows the house type", () => {
    expect(defaultWashrooms("1 RK")).toBe(1);
    expect(defaultWashrooms("1 BHK")).toBe(1);
    expect(defaultWashrooms(ROOM_LABEL)).toBe(1);
    expect(defaultWashrooms("2 BHK")).toBe(2);
    expect(defaultWashrooms("3 BHK")).toBe(3);
    expect(defaultWashrooms("4 BHK")).toBe(4);
    expect(defaultWashrooms("5 BHK")).toBe(4);
  });
});
