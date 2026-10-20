import { describe, expect, it } from "vitest";
import { POSTER_DESIGNS, PROPERTY_POSTER_STYLES, designOf, posterRating, toLetHeadline, toLetNumber } from "./qrPoster";

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

describe("red To-Let poster (buildings and flats)", () => {
  it("is offered for a property, A1 landscape", () => {
    expect(PROPERTY_POSTER_STYLES.map((s) => s.id)).toContain("redtolet");
    expect(designOf("redtolet")).toMatchObject({ orientation: "landscape", paper: "A1" });
  });
  it("one type: TO-LET 2BHK FLAT", () => {
    expect(toLetHeadline(["2 BHK"])).toBe("TO-LET 2BHK FLAT");
    expect(toLetHeadline(["2BHK", "2 BHK", ""])).toBe("TO-LET 2BHK FLAT");
  });
  it("mixed types: TO-LET 1, 2 BHK FLATS", () => expect(toLetHeadline(["2 BHK", "1 BHK", "2 BHK"])).toBe("TO-LET 1, 2 BHK FLATS"));
  it("an RK keeps its name", () => expect(toLetHeadline(["1 RK"])).toBe("TO-LET 1RK FLAT"));
  it("no type known: TO-LET FLAT", () => {
    expect(toLetHeadline([])).toBe("TO-LET FLAT");
    expect(toLetHeadline(undefined)).toBe("TO-LET FLAT");
  });
});
