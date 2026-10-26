import { describe, expect, it } from "vitest";
import { areaFromAddress, baseName, importRows, isSociety, mergeSocieties, nearestAgents, osmRows, rentRange, roadFor, sweepCells } from "./societyProspects";

describe("sweepCells", () => {
  it("covers the six corridors in about 130 cells of ~650 m", () => {
    const cells = sweepCells();
    expect(cells.length).toBeGreaterThan(110);
    expect(cells.length).toBeLessThan(160);
    for (const c of cells) {
      expect(c.n - c.s).toBeLessThanOrEqual(0.02);
      expect(c.e - c.w).toBeLessThanOrEqual(0.02);
    }
  });
});

describe("roadFor", () => {
  it("puts HSR inside HSR, and the rest on the nearest road", () => {
    expect(roadFor(12.9116, 77.6474)).toBe("hsr");
    expect(roadFor(12.8818, 77.7568)).toBe("sarjapur"); // Dommasandra
    expect(roadFor(12.8801, 77.6551)).toBe("haralur");
    expect(roadFor(12.8708, 77.66)).toBe("hosa");
    expect(roadFor(12.97, 77.6)).toBe(null); // MG Road
  });
});

describe("isSociety", () => {
  it("keeps apartment complexes, drops PGs, hotels and sales offices", () => {
    expect(isSociety({ name: "Prestige Lakeside Habitat", types: ["apartment_complex"] })).toBe(true);
    expect(isSociety({ name: "Zolo Stays HSR", types: ["apartment_complex"] })).toBe(false);
    expect(isSociety({ name: "Sri Sai PG for Gents", types: ["apartment_building"] })).toBe(false);
    expect(isSociety({ name: "Sobha Dream Acres Sales Office", types: ["apartment_complex"] })).toBe(false);
    expect(isSociety({ name: "Some Cafe", types: ["cafe"] })).toBe(false);
  });
});

describe("mergeSocieties", () => {
  it("folds a society's towers and gates into one row, keeping a phone", () => {
    const rows = mergeSocieties([
      { place_id: "a1", name: "Sobha Silicon Oasis Tower 4", lat: 12.8763, lng: 77.6551, phone: "" },
      { place_id: "a2", name: "Sobha Silicon Oasis", lat: 12.8768, lng: 77.6555, phone: "" },
      { place_id: "a3", name: "Sobha Silicon Oasis Main Gate", lat: 12.877, lng: 77.6549, phone: "080 1234 5678" },
      { place_id: "a2", name: "Sobha Silicon Oasis", lat: 12.8768, lng: 77.6555 },
      { place_id: "b1", name: "Purva Fountain Square", lat: 12.9461, lng: 77.701, phone: "" },
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Sobha Silicon Oasis", "Purva Fountain Square"]);
    expect(rows[0].phone).toBe("080 1234 5678");
  });
  it("keeps same-named societies far apart", () => {
    expect(mergeSocieties([
      { place_id: "x", name: "Green Residency", lat: 12.9, lng: 77.65 },
      { place_id: "y", name: "Green Residency", lat: 12.88, lng: 77.75 },
    ])).toHaveLength(2);
  });
  it("strips towers and gates from a name", () => {
    expect(baseName("Prestige Lakeside Habitat - Tower 12 (Gate 3)")).toBe("prestige lakeside habitat");
  });
});

describe("nearestAgents and import rows", () => {
  it("gives each society up to five agencies within 2 km, nearest first", () => {
    const soc = { lat: 12.9, lng: 77.65 };
    const agents = [
      { place_id: "1", name: "Far", phone: "9", lat: 12.95, lng: 77.65 },
      { place_id: "2", name: "Near", phone: "98450 00001", lat: 12.901, lng: 77.65 },
      { place_id: "3", name: "No phone", phone: "", lat: 12.9, lng: 77.65 },
    ];
    expect(nearestAgents(soc, agents).map((a) => a.name)).toEqual(["Near"]);
  });
  it("builds rows with road, area and agencies", () => {
    const rows = importRows([{
      societies: [
        { place_id: "s1", name: "Mantri Flora", types: ["apartment_complex"], lat: 12.8801, lng: 77.6551, address: "Haralur Rd, Haralur, Bengaluru, Karnataka 560102", maps_url: "https://maps.google.com/?cid=1", phone: "" },
        { place_id: "s2", name: "Zolo PG", types: ["apartment_complex"], lat: 12.8801, lng: 77.6551, address: "" },
      ],
      agents: [{ place_id: "g1", name: "Haralur Homes", phone: "098450 11111", lat: 12.881, lng: 77.6552 }],
    }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ place_id: "s1", road: "haralur", area: "Haralur" });
    expect(rows[0].agents[0].name).toBe("Haralur Homes");
  });
});

describe("words", () => {
  it("formats rent ranges", () => {
    expect(rentRange([28000, 35000])).toBe("₹28k–35k");
    expect(rentRange([120000, 150000])).toBe("₹1.2L–1.5L");
    expect(rentRange([40000])).toBe("₹40k");
    expect(rentRange([])).toBe("");
  });
  it("reads the locality out of an address", () => {
    expect(areaFromAddress("Kasavanahalli, Bengaluru, Karnataka 560035")).toBe("Kasavanahalli");
    expect(areaFromAddress("")).toBe("");
  });
});

describe("osmRows", () => {
  const way = (id, name, b, tags = {}) => ({ type: "way", id, bounds: b, tags: { landuse: "residential", name, ...tags } });
  const box = (lat, lng, d = 0.002) => ({ minlat: lat - d, maxlat: lat + d, minlon: lng - d, maxlon: lng + d });
  it("keeps societies near the roads, drops layouts, towers inside them and far places", () => {
    const rows = osmRows([
      way(1, "Sobha Silicon Oasis", box(12.8796, 77.6551)),
      way(2, "Kudlu Main Layout", box(12.89, 77.648)),
      way(3, "LOCL Colive & Work", box(12.9, 77.65)),
      { type: "way", id: 4, bounds: box(12.8797, 77.6552, 0.0002), tags: { building: "apartments", name: "Sobha Hibiscus Block A" } },
      { type: "way", id: 5, bounds: box(12.8798, 77.6553, 0.0002), tags: { building: "apartments", name: "Tower 3" } },
      { type: "way", id: 6, bounds: box(12.9116, 77.6474, 0.0002), tags: { building: "apartments", name: "Aishwarya Amaze Apartments", "addr:suburb": "HSR Layout" } },
      way(7, "Faraway Greens", box(12.97, 77.6)),
      way(8, "Adarsh Palm Retreat", box(12.9188, 77.6849)),
      way(9, "Adarsh Palm Retreat Mayberry", box(12.9192, 77.6853)),
      { type: "node", id: 10, lat: 12.8801, lon: 77.6555, tags: { office: "estate_agent", name: "Haralur Homes", phone: "+91 98450 11111" } },
    ]);
    expect(rows.map((r) => r.name).sort()).toEqual(["Adarsh Palm Retreat", "Aishwarya Amaze Apartments", "Sobha Silicon Oasis"]);
    const sobha = rows.find((r) => r.name === "Sobha Silicon Oasis");
    expect(sobha).toMatchObject({ place_id: "osm-way-1", road: "haralur", maps_url: "https://www.openstreetmap.org/way/1" });
    expect(sobha.agents[0].name).toBe("Haralur Homes");
    expect(rows.find((r) => r.name.startsWith("Aishwarya")).area).toBe("HSR Layout");
  });
});
