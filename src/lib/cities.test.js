// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  CITIES, NCR_CITIES, cityBySlug, cityLabel, citySlug, isNcr, nearestCity, normalizeCity, searchCities, setIncludeNcr, setSiteCity, siteCity,
  chosenCity,
} from "./cities";
import { cityOfArea, cityOfAreas, deriveAreas } from "./areas";

describe("the seven cities", () => {
  it("names people write map to ours (same rule as normalize_city in SQL)", () => {
    expect(["Bangalore", "bengaluru", "BLR", "gurgaon", "New Delhi", "bombay", "Navi Mumbai", "Greater Noida", "Secunderabad", "pimpri chinchwad"]
      .map(normalizeCity)).toEqual(["Bengaluru", "Bengaluru", "Bengaluru", "Gurugram", "Delhi", "Mumbai", "Mumbai", "Noida", "Hyderabad", "Pune"]);
    expect(normalizeCity("Chennai")).toBe("");
    expect(normalizeCity("")).toBe("");
  });

  it("slugs and labels", () => {
    expect(CITIES).toHaveLength(7);
    expect(citySlug("Bengaluru")).toBe("bangalore");
    expect(cityLabel("Bengaluru")).toBe("Bangalore");
    expect(cityBySlug("gurugram")?.name).toBe("Gurugram");
    expect(cityBySlug("nowhere")).toBeNull();
    expect(NCR_CITIES).toEqual(["Noida", "Gurugram", "Delhi"]);
    expect(isNcr("gurgaon")).toBe(true);
    expect(isNcr("Pune")).toBe(false);
  });

  it("the nearest city to a point, or none far away", () => {
    expect(nearestCity(12.93, 77.62)).toBe("Bengaluru"); // Koramangala
    expect(nearestCity(19.12, 72.91)).toBe("Mumbai"); // Powai
    expect(nearestCity(28.47, 77.03)).toBe("Gurugram");
    expect(nearestCity(13.08, 80.27)).toBe(""); // Chennai: not one of ours
  });
});

describe("the city the site shows", () => {
  beforeEach(() => { localStorage.clear(); setIncludeNcr(false); });

  it("Bengaluru until one is picked; a pick is remembered", () => {
    setSiteCity("Pune");
    expect(siteCity()).toBe("Pune");
    expect(chosenCity()).toBe("Pune");
    expect(localStorage.getItem("mz_city")).toBe("Pune");
    expect(setSiteCity("Atlantis")).toBe("");
    expect(siteCity()).toBe("Pune");
  });

  it("NCR: the other two only when ticked, and only for an NCR city", () => {
    setSiteCity("Noida");
    expect(searchCities()).toEqual(["Noida"]);
    setIncludeNcr(true);
    expect(searchCities()).toEqual(["Noida", "Gurugram", "Delhi"]);
    setSiteCity("Mumbai");
    expect(searchCities()).toEqual(["Mumbai"]);
  });
});

describe("areas per city", () => {
  it("deriveAreas keeps one city's chips and names", () => {
    const d = deriveAreas([
      { id: "1", city: "Mumbai", name: "Powai", chip: true, sort: 10, active: true },
      { id: "2", city: "Mumbai", name: "Andheri West", chip: false, sort: 20, active: true },
    ]);
    expect(d.chips).toEqual(["Powai"]);
    expect(d.names).toEqual(["Andheri West", "Powai"]);
  });

  it("an area's city, from the list on this device (the shipped list is Bengaluru's)", () => {
    expect(cityOfArea("HSR")).toBe("Bengaluru");
    expect(cityOfArea("Nowhere Nagar")).toBe("");
    expect(cityOfAreas(["HSR", "Koramangala"])).toBe("Bengaluru");
    expect(cityOfAreas([])).toBe("");
  });
});
