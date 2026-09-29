import { describe, expect, it } from "vitest";
import { coordsFromMapsUrl, firstLink, isShortMapsLink } from "./mapLink";

describe("coordsFromMapsUrl", () => {
  it("prefers the pinned place over the map view", () => {
    expect(coordsFromMapsUrl("https://www.google.com/maps/place/HSR+Layout/@12.9100,77.6400,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d12.9121!4d77.6446"))
      .toEqual({ lat: 12.9121, lng: 77.6446 });
  });
  it("reads the view, ?q=, ?ll=, /search/ and a bare pair", () => {
    expect(coordsFromMapsUrl("https://www.google.com/maps/@12.9352,77.6245,17z")).toEqual({ lat: 12.9352, lng: 77.6245 });
    expect(coordsFromMapsUrl("https://maps.google.com/?q=12.97,77.59")).toEqual({ lat: 12.97, lng: 77.59 });
    expect(coordsFromMapsUrl("https://maps.google.com/maps?ll=12.97,77.59&z=16")).toEqual({ lat: 12.97, lng: 77.59 });
    expect(coordsFromMapsUrl("https://www.google.com/maps/search/12.9121,+77.6446?entry=tts")).toEqual({ lat: 12.9121, lng: 77.6446 });
    expect(coordsFromMapsUrl("12.9121, 77.6446")).toEqual({ lat: 12.9121, lng: 77.6446 });
  });
  it("refuses places outside India and links with no coordinates", () => {
    expect(coordsFromMapsUrl("https://www.google.com/maps/@51.5072,-0.1276,12z")).toBeNull();
    expect(coordsFromMapsUrl("https://maps.app.goo.gl/AbC123")).toBeNull();
    expect(coordsFromMapsUrl("hello")).toBeNull();
  });
});

describe("short links and pasted text", () => {
  it("spots short links and pulls the link out of a message", () => {
    expect(isShortMapsLink("https://maps.app.goo.gl/AbC123")).toBe(true);
    expect(isShortMapsLink("maps.app.goo.gl/AbC123")).toBe(true);
    expect(isShortMapsLink("https://www.google.com/maps/@12.9,77.6,15z")).toBe(false);
    expect(firstLink("Location: https://maps.app.goo.gl/AbC123, near BDA complex")).toBe("https://maps.app.goo.gl/AbC123");
  });
});
