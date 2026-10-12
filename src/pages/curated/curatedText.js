/**
 * Words for a partner's list as the tenant sees it (/c/<token>): the facts on
 * a flat's details screen, and the WhatsApp message back to the partner.
 */
import { inr } from "../../lib/partners";

export const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";

const day = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const floorName = (n) => (n === 0 ? "Ground" : n < 0 ? "Basement" : `${n}${["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`);

/** "2 BHK · HSR Layout" */
export const flatLine = (h) => [h?.flat_type, h?.area].filter(Boolean).join(" · ");

/** The facts grid: [label, value] for what the flat has filled in. */
export function factsOf(h = {}) {
  const avail = h.available_from ? (new Date(h.available_from) <= new Date() ? "Now" : day(h.available_from)) : "";
  const who = (h.occupants_allowed ?? []).join(", ");
  const gender = { male: "Men only", female: "Women only" }[h.gender_pref] || "";
  return [
    ["Deposit", h.deposit > 0 ? inr(h.deposit) : ""],
    ["Available", avail],
    ["Furnishing", h.furnishing || ""],
    ["Size", h.area_sqft > 0 ? `${h.area_sqft.toLocaleString("en-IN")} sq ft` : ""],
    ["Floor", Number.isInteger(h.floor_number) ? floorName(h.floor_number) : ""],
    ["Bathrooms", h.bathrooms > 0 ? String(h.bathrooms) : ""],
    ["Type", h.property_type || ""],
    ["Flatmates", h.max_flatmates > 0 ? `Up to ${h.max_flatmates}` : ""],
    ["Who can stay", [who, gender].filter(Boolean).join(" · ")],
  ].filter(([, v]) => v);
}

/** The message to the partner from the end screen: each liked flat, then the link back. */
export function likedMessage({ brokerName = "", liked = [], url = "" } = {}) {
  const hi = `Hi${firstName(brokerName) ? ` ${firstName(brokerName)}` : ""}`;
  if (!liked.length) {
    return `${hi}, I went through your list — none of these worked for me. Can you send me a few more options?${url ? `\n${url}` : ""}`;
  }
  const lines = liked.map((h, i) => `${i + 1}) ${[h.flat_type, h.area].filter(Boolean).join(", ")}${h.rent > 0 ? ` — ${inr(h.rent)}/month` : ""}`);
  return `${hi}, I liked ${liked.length === 1 ? "this flat" : "these flats"} from your list:\n${lines.join("\n")}\n`
    + `When can I schedule the visit${liked.length === 1 ? "" : "s"}?${url ? `\n${url}` : ""}`;
}

/**
 * Every home across the partner's lists to this tenant, once each, with the
 * list it can be answered on. `lists`: [{ token, homes }], the open one first.
 */
export function allHomes(lists = []) {
  const seen = new Set();
  const out = [];
  for (const l of lists) {
    for (const h of l.homes ?? []) {
      if (seen.has(h.property_id)) continue;
      seen.add(h.property_id);
      out.push({ ...h, token: l.token });
    }
  }
  return out;
}
