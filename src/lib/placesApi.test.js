import { describe, expect, it } from "vitest";
import { readMapsUrl } from "../../api/places";

describe("readMapsUrl", () => {
  it("a place link: its name and the pin", () => {
    expect(readMapsUrl("https://www.google.com/maps/place/Sunrise+Residency/@12.9100,77.6400,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x1!8m2!3d12.9116!4d77.6389"))
      .toEqual({ name: "Sunrise Residency", lat: 12.9116, lng: 77.6389, placeId: "" });
  });
  it("a search link with a place id", () => {
    expect(readMapsUrl("https://www.google.com/maps/search/?api=1&query=Prestige%20Shantiniketan&query_place_id=ChIJN1t_tDeuEmsRUsoyG83frY4"))
      .toMatchObject({ placeId: "ChIJN1t_tDeuEmsRUsoyG83frY4" });
  });
  it("coordinates only", () => {
    expect(readMapsUrl("https://maps.google.com/?q=12.97,77.59")).toEqual({ name: "", lat: 12.97, lng: 77.59, placeId: "" });
  });
  it("nothing outside India", () => {
    expect(readMapsUrl("https://www.google.com/maps/@51.5,-0.12,15z")).toMatchObject({ lat: null, lng: null });
  });
});
