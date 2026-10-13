/**
 * The details a partner gives when posting a flat (pages/partners/AddProperty.jsx):
 * deposit suggestions from the rent, who may live there, and the amenity chips —
 * each saved under the name tenants' searches already use, so they match.
 */

export const DEPOSIT_MULTIPLES = [2, 2.5, 3, 4];

/** 2x, 2.5x, 3x and 4x the rent, each rounded to the nearest ₹10,000 (never below it). → [{ m, amount }] */
export function depositOptions(rent) {
  const r = Number(rent);
  if (!(r >= 1000)) return [];
  const seen = new Set();
  return DEPOSIT_MULTIPLES.map((m) => ({ m, amount: Math.max(10000, Math.round((r * m) / 10000) * 10000) }))
    .filter((o) => (seen.has(o.amount) ? false : seen.add(o.amount)));
}

/** "Only Family" | "Only Bachelors" | neither (open to both). → occupants_allowed */
export function occupantsFor(choice) {
  if (choice === "Family") return ["Family"];
  if (choice === "Bachelor") return ["Bachelor"];
  return ["Family", "Bachelor"];
}

/** Blank maintenance is none: 0. */
export const maintenanceValue = (v) => (String(v ?? "").trim() === "" ? 0 : Number(String(v).replace(/\D/g, "")) || 0);

/** The chips, as brokers say them; `value` is what's saved (tenants' must-have names where one means the same). */
export const POSTING_AMENITIES = [
  { label: "Lift", value: "Lift" },
  { label: "Power Back up", value: "Power Backup" },
  { label: "Security", value: "Security" },
  { label: "Outside Car Parking", value: "Outside Car Parking" },
  { label: "Indoor Car Parking", value: "Covered Parking" },
  { label: "Pet Friendly", value: "Pet Friendly" },
  { label: "Veg Only", value: "Veg Only" },
  { label: "Gym", value: "Gym" },
  { label: "Swimming Pool", value: "Swimming Pool" },
  { label: "Club Area", value: "Club Area" },
  { label: "Walkable Neighbourhood", value: "Walkable Neighbourhood" },
  { label: "Green Area", value: "Green Area" },
];

/** Ticked before the partner touches anything; they untick what doesn't apply. */
export const DEFAULT_PARTNER_AMENITIES = ["Outside Car Parking", "Pet Friendly", "Walkable Neighbourhood"];

/** The floor chips: Ground, 1–4, then 5+ opens a dropdown up to 30. */
export const FLOOR_CHIPS = [["0", "Ground"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]];
