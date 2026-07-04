import { upsertListing } from "./store";

// This module is intentionally legal-safe: it ingests partner-provided feed JSON.
// Do not scrape third-party portals without written permission and API terms.
export function ingestPartnerListings(feedRows = [], sourceName = "partner-feed") {
  const normalizedRows = normalizePartnerListings(feedRows, sourceName);
  for (const row of normalizedRows) upsertListing(row);
  return { imported: normalizedRows.length };
}

export function normalizePartnerListings(feedRows = [], sourceName = "partner-feed") {
  if (!Array.isArray(feedRows)) return [];
  let imported = 0;
  const rows = [];
  for (const row of feedRows) {
    if (!row?.title || !row?.lat || !row?.lng) continue;
    rows.push({
      id: row.id || Date.now() + imported,
      title: row.title,
      price: row.priceLabel || `₹ ${row.monthlyRent || 0}`,
      monthlyRent: Number(row.monthlyRent || 0),
      bhk: row.bhk || "1 BHK",
      address: row.address || "Bengaluru",
      seller: row.brokerName || row.seller || "Broker",
      sellerEmail: row.brokerEmail || row.sellerEmail || "",
      contact: row.contact || "",
      lat: Number(row.lat),
      lng: Number(row.lng),
      availability: row.availability || "Immediate",
      preferredTenants: row.preferredTenants || ["Family"],
      propertyType: row.propertyType || "Apartment",
      furnishing: row.furnishing || "Semi",
      parking: row.parking || ["2 Wheeler"],
      image: row.image || row.photo || row.images?.[0] || "",
      images: Array.isArray(row.images) ? row.images : String(row.images || row.photos || "").split(/[|;]/).map((item) => item.trim()).filter(Boolean),
      description: row.description || row.details || "",
      source: sourceName,
      sourceUrl: row.sourceUrl || "",
    });
    imported += 1;
  }
  return rows;
}

function parseSeparatedText(text) {
  const rows = String(text || "").trim().split(/\r?\n/).filter(Boolean);
  if (rows.length < 2) return [];
  const delimiter = rows[0].includes("\t") ? "\t" : ",";
  const splitLine = (line) => {
    if (delimiter === "\t") return line.split("\t").map((s) => s.trim());
    const out = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === "\"") {
        if (inQuotes && line[i + 1] === "\"") {
          current += "\"";
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    out.push(current.trim());
    return out;
  };
  const header = splitLine(rows[0]).map((h) => h.toLowerCase());
  const data = [];
  for (let i = 1; i < rows.length; i += 1) {
    const values = splitLine(rows[i]);
    if (!values.some(Boolean)) continue;
    const row = {};
    for (let c = 0; c < header.length; c += 1) {
      row[header[c]] = values[c] ?? "";
    }
    data.push(row);
  }
  return data;
}

function pickValue(row, keys, fallback = "") {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return fallback;
}

function normalizeRows(rawRows, brokerName) {
  const broker = String(brokerName || "").trim();
  return rawRows
    .map((row) => ({
      id: pickValue(row, ["id", "listingid", "listing_id"]),
      title: pickValue(row, ["title", "propertytitle", "name"], "Untitled listing"),
      monthlyRent: Number(pickValue(row, ["monthlyrent", "rent", "rentprice", "price"], 0)) || 0,
      priceLabel: pickValue(row, ["pricelabel", "price_label"]),
      bhk: pickValue(row, ["bhk", "bhktype", "bedrooms"], "1 BHK"),
      address: pickValue(row, ["address", "location", "locality"], "Bengaluru"),
      brokerName: pickValue(row, ["brokername", "seller", "sellername", "agentname"], broker || "Broker"),
      brokerEmail: pickValue(row, ["brokeremail", "selleremail", "email"]),
      contact: pickValue(row, ["contact", "phone", "mobile"]),
      lat: Number(pickValue(row, ["lat", "latitude"])),
      lng: Number(pickValue(row, ["lng", "longitude", "lon"])),
      sourceUrl: pickValue(row, ["sourceurl", "url", "listingurl"]),
      availability: pickValue(row, ["availability"], "Immediate"),
      propertyType: pickValue(row, ["propertytype", "proptype"], "Apartment"),
      furnishing: pickValue(row, ["furnishing"], "Semi"),
      image: pickValue(row, ["image", "photo", "thumbnail"]),
      images: pickValue(row, ["images", "photos", "gallery"]),
      description: pickValue(row, ["description", "details", "summary"]),
    }))
    .filter((row) => row.title && Number.isFinite(row.lat) && Number.isFinite(row.lng))
    .filter((row) => {
      if (!broker) return true;
      const rowBroker = String(row.brokerName || "").trim().toLowerCase();
      return rowBroker === broker.toLowerCase();
    });
}

export function ingestBrokerListings({ brokerName, rawInput, sourceName = "broker-import" }) {
  const normalized = normalizeBrokerListings({ brokerName, rawInput });
  const result = ingestPartnerListings(normalized, `${sourceName}:${brokerName || "unknown-broker"}`);
  return { imported: result.imported, parsed: normalized.parsed || 0 };
}

export function normalizeBrokerListings({ brokerName, rawInput }) {
  if (!rawInput || !String(rawInput).trim()) return { imported: 0, parsed: 0 };
  let rows = [];
  try {
    const parsed = JSON.parse(rawInput);
    rows = Array.isArray(parsed) ? parsed : [];
  } catch {
    rows = parseSeparatedText(rawInput);
  }
  const normalized = normalizeRows(rows, brokerName);
  normalized.parsed = rows.length;
  return normalized;
}
