import { describe, expect, it } from "vitest";
import { POSTER_DESIGNS, posterRating, toLetNumber } from "./qrPoster";

describe("To-Let poster", () => {
  it("is the first, default design", () => expect(POSTER_DESIGNS[0]).toMatchObject({ id: "tolet", orientation: "landscape" }));
  it("shows the CRM's rating until 10 tenants have rated", () => {
    expect(posterRating({ display_rating: 4.8, tenant_ratings: 9, tenant_rating: 3.2 })).toBe(4.8);
    expect(posterRating({ display_rating: "4.7", tenant_ratings: 0 })).toBe(4.7);
  });
  it("then the tenants' average", () => expect(posterRating({ display_rating: 4.8, tenant_ratings: 10, tenant_rating: 4.1 })).toBe(4.1));
  it("nothing to show: null", () => expect(posterRating({})).toBeNull());
  it("the number: ten digits, no country code or spaces", () => {
    expect(toLetNumber("+91 98765 43210")).toBe("9876543210");
    expect(toLetNumber("080-4567")).toBe("080-4567");
    expect(toLetNumber("")).toBe("");
  });
});
