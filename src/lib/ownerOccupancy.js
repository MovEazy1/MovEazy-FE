/**
 * Occupancy and tenancy arithmetic for the owner app. Pure, so it is tested.
 *
 * Occupancy % = the share of this financial year, so far, that a flat had at
 * least one tenant living in it. Two flatmates overlapping count once; a gap
 * between tenants counts against it. The Indian financial year runs 1 April
 * to 31 March.
 *
 * Nothing here is about rent collected: V1 keeps no payment records.
 */

const DAY = 86400000;
const toDay = (d) => {
  if (!d) return null;
  const t = new Date(String(d).length === 10 ? `${d}T00:00:00` : d);
  if (!Number.isFinite(t.getTime())) return null;
  return new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
};

/** { start, end, label } for the financial year containing `now`. */
export function financialYear(now = new Date()) {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    start: new Date(y, 3, 1),
    end: new Date(y + 1, 2, 31),
    label: `FY ${y}-${String((y + 1) % 100).padStart(2, "0")}`,
  };
}

/** The days a tenancy covers: [move-in, moved-out or today]. Null if it never started. */
export function tenancySpan(t, now = new Date()) {
  const from = toDay(t.move_in_date);
  if (from == null) return null;
  const until = toDay(t.moved_out_on) ?? toDay(now);
  return until >= from ? [from, until] : null;
}

/**
 * % of the financial year so far with someone living there, or null when no
 * tenancy has a move-in date (a number made up from nothing would mislead).
 */
export function occupancyPct(tenants = [], now = new Date()) {
  const fy = financialYear(now);
  const start = toDay(fy.start);
  const today = toDay(now);
  const spans = tenants
    .filter((t) => t.status !== "removed")
    .map((t) => tenancySpan(t, now))
    .filter(Boolean)
    .map(([a, b]) => [Math.max(a, start), Math.min(b, today)])
    .filter(([a, b]) => b >= a)
    .sort((x, y) => x[0] - y[0]);
  if (!tenants.some((t) => t.move_in_date && t.status !== "removed")) return null;

  let covered = 0;
  let cur = null;
  for (const [a, b] of spans) {
    if (!cur) { cur = [a, b]; continue; }
    if (a <= cur[1] + DAY) cur[1] = Math.max(cur[1], b);
    else { covered += (cur[1] - cur[0]) / DAY + 1; cur = [a, b]; }
  }
  if (cur) covered += (cur[1] - cur[0]) / DAY + 1;
  const total = (today - start) / DAY + 1;
  return Math.max(0, Math.min(100, Math.round((covered / total) * 100)));
}

/** "11 months" / "3 weeks" / "2 years 1 month" since move-in. */
export function tenancyLength(t, now = new Date()) {
  const span = tenancySpan(t, now);
  if (!span) return "";
  const days = Math.round((span[1] - span[0]) / DAY);
  if (days < 14) return `${Math.max(1, days)} day${days === 1 ? "" : "s"}`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30.44);
  if (months < 12) return `${months} months`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return `${y} year${y > 1 ? "s" : ""}${m ? ` ${m} month${m > 1 ? "s" : ""}` : ""}`;
}

/** Days until the lease ends (negative once past), or null. */
export function daysToLeaseEnd(t, now = new Date()) {
  const end = toDay(t.lease_end_date);
  return end == null ? null : Math.round((end - toDay(now)) / DAY);
}

export const isCurrentTenant = (t) => t.status === "active" || t.status === "invited";
