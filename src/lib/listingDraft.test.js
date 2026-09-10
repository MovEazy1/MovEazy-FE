/**
 * Listings went out titled "2 BHK in HSR" with a flat type of 3 BHK: the title
 * was generated as soon as an address resolved — while the flat type was still
 * its default — and then never updated. Three real listings on the live map had
 * a title and a badge that disagreed.
 */
import { describe, expect, it } from "vitest";
import { autoTitle, bedroomsForFlatType, flatmatesForFlatType } from "./listingDraft";

describe("bedrooms implied by the flat type", () => {
  it("reads the number off an N BHK", () => {
    expect(bedroomsForFlatType("1 BHK")).toBe(1);
    expect(bedroomsForFlatType("2 BHK")).toBe(2);
    expect(bedroomsForFlatType("3 BHK")).toBe(3);
  });

  it("counts a studio and a shared room as one", () => {
    expect(bedroomsForFlatType("1 RK")).toBe(1);
    expect(bedroomsForFlatType("Room in Preoccupied flat")).toBe(1);
  });

  it("declines to guess where the type doesn't say", () => {
    // A villa has bedrooms, but not a number anyone can read off the label.
    expect(bedroomsForFlatType("Villa")).toBeNull();
    expect(bedroomsForFlatType("")).toBeNull();
  });
});

describe("the title we write for a poster", () => {
  it("names the type and the area", () => {
    expect(autoTitle("3 BHK", "HSR")).toBe("3 BHK in HSR");
  });

  it("follows the type, rather than freezing at whatever was default", () => {
    expect(autoTitle("3 BHK", "HSR")).not.toBe(autoTitle("2 BHK", "HSR"));
  });

  it("writes nothing until there's an area to name", () => {
    expect(autoTitle("2 BHK", "")).toBe("");
  });
});

describe("flatmates implied by the flat type", () => {
  it("gives a whole flat none", () => {
    // The old flat default of 1 had every entire-flat listing claiming a
    // flatmate its poster never mentioned.
    expect(flatmatesForFlatType("2 BHK")).toBe(0);
    expect(flatmatesForFlatType("Villa")).toBe(0);
    expect(flatmatesForFlatType("1 RK")).toBe(0);
  });

  it("gives a room in an occupied flat at least one", () => {
    expect(flatmatesForFlatType("Room in Preoccupied flat")).toBe(1);
  });
});
