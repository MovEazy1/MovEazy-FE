/**
 * Values a posting flow fills in on the poster's behalf.
 *
 * These are suggestions, not answers. The rule for every one of them: keep
 * following what the poster picks, right up until they set it themselves, and
 * never after. Getting that backwards is how listings went out titled "2 BHK
 * in HSR" while their flat type said 3 BHK — the title was written the moment
 * an address was resolved, when the flat type was still the default, and then
 * frozen.
 */

/** Bedrooms implied by a flat type. `null` when the type doesn't imply one. */
export function bedroomsForFlatType(flatType) {
  const t = String(flatType || "").trim();
  if (/^\s*(\d+)\s*BHK/i.test(t)) return Number(t.match(/^\s*(\d+)\s*BHK/i)[1]);
  // A studio and a room in a shared flat are both one room to sleep in.
  if (/^\s*\d*\s*RK/i.test(t)) return 1;
  if (/room/i.test(t)) return 1;
  return null;
}

/** The title we write when the poster hasn't written one. */
export function autoTitle(flatType, area) {
  const type = String(flatType || "").trim() || "Home";
  const where = String(area || "").trim();
  return where ? `${type} in ${where}` : "";
}

/**
 * Flatmates implied by a flat type. A whole flat has none; a room in an
 * occupied flat has at least one, which is what makes it that.
 *
 * Left at a flat 1, every entire-flat listing claimed a flatmate nobody had
 * mentioned.
 */
export function flatmatesForFlatType(flatType) {
  return /room/i.test(String(flatType || "")) ? 1 : 0;
}
