/**
 * Read an unstructured listing post — a Facebook group post, a WhatsApp message,
 * a broker's forward — and pull out what it can.
 *
 * This is the whole importer. Facebook links deliberately are NOT fetched: their
 * post oEmbed returns an embed widget rather than the post's content, and a
 * direct fetch returns a JS shell with no text, no images and no preview tags
 * (tested against a real group post). So the URL is captured as provenance only
 * and the text is what gets parsed.
 *
 * Everything returned is a *suggestion* — the form marks each filled field so
 * an agent can see what was guessed and correct it before publishing.
 */
import { ALL_LOCALITIES, FLAT_TYPES, FURNISHINGS, MUST_HAVES, OCCUPANTS } from "../data/preferenceOptions";

const lower = (s) => String(s || "").toLowerCase();

/**
 * "45k" / "45,000" / "₹45000" / "45 thousand" → 45000.
 * Indian listing posts use all of these, often in one sentence.
 */
function parseAmount(raw) {
  if (!raw) return null;
  const s = lower(raw).replace(/[, ]/g, "");
  const k = s.match(/([\d.]+)\s*k\b/);
  if (k) return Math.round(parseFloat(k[1]) * 1000);
  const lakh = s.match(/([\d.]+)\s*(?:lakh|lac|l)\b/);
  if (lakh) return Math.round(parseFloat(lakh[1]) * 100000);
  const plain = s.match(/(\d{4,8})/);
  if (plain) return parseInt(plain[1], 10);
  return null;
}

function findAmountNear(text, keywords, { max = 100 } = {}) {
  const t = lower(text);
  for (const kw of keywords) {
    // Amount can sit on either side of the label: "rent 45k" and "45k rent".
    const after = new RegExp(`${kw}[^\\d₹]{0,${max}}(₹?\\s*[\\d.,]+\\s*(?:k|lakh|lac|l)?)`, "i");
    const before = new RegExp(`(₹?\\s*[\\d.,]+\\s*(?:k|lakh|lac|l)?)[^\\d]{0,20}${kw}`, "i");
    const m = t.match(after) || t.match(before);
    if (m) {
      const amount = parseAmount(m[1]);
      if (amount && amount >= 1000) return amount;
    }
  }
  return null;
}

function parseFlatType(text) {
  const t = lower(text);
  if (/\b1\s*rk\b/.test(t)) return "1 RK";
  const bhk = t.match(/\b([1-5])\s*bhk\b/);
  if (bhk) {
    const guess = `${bhk[1]} BHK`;
    if (FLAT_TYPES.includes(guess)) return guess;
  }
  if (/\bvilla\b/.test(t)) return "Villa";
  if (/\b(room|sharing|flatmate)\b/.test(t)) return "Room in Preoccupied flat";
  return "";
}

function parseFurnishing(text) {
  const t = lower(text);
  if (/\b(fully|full)[\s-]*furnish/.test(t)) return "Fully Furnished";
  if (/\b(semi)[\s-]*furnish/.test(t)) return "Semi Furnished";
  if (/\bunfurnish|\bnot furnish|\bbare shell/.test(t)) return "Unfurnished";
  return "";
}

function parseLocalities(text) {
  const t = lower(text);
  return ALL_LOCALITIES.filter((loc) => t.includes(lower(loc)));
}

function parseAmenities(text) {
  const t = lower(text);
  return MUST_HAVES.filter((a) => t.includes(lower(a)));
}

function parseOccupants(text) {
  const t = lower(text);
  const found = OCCUPANTS.filter((o) => t.includes(lower(o)));
  // Posts say "bachelors allowed" / "family only" far more often than the exact term.
  if (/bachelor/.test(t) && !found.includes("Bachelor")) found.push("Bachelor");
  if (/famil/.test(t) && !found.includes("Family")) found.push("Family");
  if (/couple/.test(t) && !found.includes("Couple")) found.push("Couple");
  return found;
}

function parsePhone(text) {
  const m = String(text || "").match(/(?:\+?91[\s-]?)?([6-9]\d{9})\b/);
  return m ? m[1] : "";
}

function parseBedrooms(flatType) {
  const m = String(flatType || "").match(/^(\d)/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * A Facebook URL copied from the app carries __cft__ / __tn__ — session tokens
 * scoped to whoever copied it. They expire and mean nothing to anyone else, so
 * they're stripped before the link is stored.
 */
export function cleanSourceUrl(raw) {
  const url = String(raw || "").trim();
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith("__") || key === "refsrc" || key === "_rdr") u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return url.slice(0, 500);
  }
}

export function detectSource(url) {
  const u = lower(url);
  if (!u) return "";
  if (u.includes("facebook.com") || u.includes("fb.com")) return "facebook";
  if (u.includes("wa.me") || u.includes("whatsapp")) return "whatsapp";
  if (u.includes("magicbricks") || u.includes("99acres") || u.includes("nobroker")) return "portal";
  return "other";
}

/**
 * Parse a pasted post into a listing draft.
 *
 * @returns {{fields: object, found: string[], missing: string[]}}
 *   `found` and `missing` drive the "we filled these, you fill the rest" hint —
 *   the form requires everything in `missing` before it will publish.
 */
export function parseListingText(text) {
  const raw = String(text || "");
  const fields = {};

  const rent = findAmountNear(raw, ["rent", "rental", "monthly", "per month", "pm\\b"]) ?? null;
  const deposit = findAmountNear(raw, ["deposit", "advance", "security", "sd\\b"]) ?? null;

  // A post with exactly one money figure and no labels is almost always the rent.
  let resolvedRent = rent;
  if (resolvedRent == null) {
    const all = (raw.match(/₹\s*[\d.,]+\s*(?:k|lakh|lac)?/gi) || []).map(parseAmount).filter(Boolean);
    const plausible = all.filter((n) => n >= 3000 && n <= 500000);
    if (plausible.length === 1) resolvedRent = plausible[0];
  }

  if (resolvedRent) fields.rent = resolvedRent;
  if (deposit && deposit !== resolvedRent) fields.deposit = deposit;

  const flatType = parseFlatType(raw);
  if (flatType) {
    fields.flat_type = flatType;
    const beds = parseBedrooms(flatType);
    if (beds) fields.bedrooms = beds;
  }

  const localities = parseLocalities(raw);
  if (localities.length) {
    fields.area = localities[0];
    if (localities.length > 1) fields.nearby_areas = localities.slice(1);
  }

  const furnishing = parseFurnishing(raw);
  if (furnishing) fields.furnishing = furnishing;

  const amenities = parseAmenities(raw);
  if (amenities.length) fields.amenities = amenities;

  const occupants = parseOccupants(raw);
  if (occupants.length) fields.occupants_allowed = occupants;

  const phone = parsePhone(raw);
  if (phone) fields.phone = phone;

  // Keep the original post as the description — an agent edits it down rather
  // than retyping it, and nothing the parser missed is lost.
  const cleaned = raw.trim().slice(0, 2000);
  if (cleaned) fields.description = cleaned;

  const REQUIRED = [
    ["rent", "Rent"],
    ["flat_type", "Flat type"],
    ["area", "Locality"],
    ["furnishing", "Furnishing"],
    ["deposit", "Deposit"],
  ];
  const found = REQUIRED.filter(([k]) => fields[k] != null && fields[k] !== "").map(([, l]) => l);
  const missing = REQUIRED.filter(([k]) => fields[k] == null || fields[k] === "").map(([, l]) => l);

  return { fields, found, missing };
}

export { FURNISHINGS };
