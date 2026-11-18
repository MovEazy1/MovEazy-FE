/** Small readers shared by the lead screens. */
import { inrShort } from "../../lib/partners";

export function budgetLabel(lead) {
  const lo = inrShort(lead.budget_min);
  const hi = inrShort(lead.budget_max);
  if (lo && hi) return `${lo} - ${hi}`;
  if (hi) return `up to ${hi}`;
  if (lo) return `from ${lo}`;
  return "";
}

/** "2 BHK • ₹25k - ₹40k" */
export function requirementLine(lead) {
  return [(lead.flat_types ?? []).join(", "), budgetLabel(lead)].filter(Boolean).join(" • ");
}

export function lastContactedLabel(at) {
  if (!at) return "Not contacted yet";
  const d = new Date(at);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  const sameDay = new Date().toDateString() === d.toDateString();
  if (sameDay) return "Last contacted: Today";
  if (days <= 1) return "Last contacted: Yesterday";
  if (days < 7) return `Last contacted: ${days} days ago`;
  return `Last contacted: ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
}

/* ── The facts on every lead row (partner_lead_details.sql) ──────────────── */

const HOUSEHOLD = { bachelor: "Bachelor", family: "Family" };

/** Who is moving in: "Family", "Bachelor", "With Roommates"… ("" if unknown). */
export function householdLabel(t) {
  const h = String(t?.household || "").trim();
  return HOUSEHOLD[h.toLowerCase()] || h;
}

const ymd = (d) => new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);

/**
 * The move-in, as exact as it can be: { text, passed }. The date is the
 * broker's own if they set one, else the day the tenant filled the form plus
 * what they picked (computed by the database). Flexible says so; nothing known
 * gives null. `passed` only while the tenant is still in play.
 */
export function moveInFact(t, now = new Date()) {
  const open = t?.stage !== "done" && t?.stage !== "lost";
  if (t?.move_in) {
    const d = new Date(`${String(t.move_in).slice(0, 10)}T00:00:00+05:30`);
    const sameYear = d.getFullYear() === now.getFullYear();
    const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), timeZone: "Asia/Kolkata" });
    const passed = open && String(t.move_in).slice(0, 10) < ymd(now);
    return { text: `Move-in ${label}${passed ? " (passed)" : ""}`, passed };
  }
  if (t?.move_in_raw === "Immediate move-in") return { text: "Immediate move-in", passed: false };
  if (t?.move_in_flexible) return { text: "Move-in flexible", passed: false };
  return null;
}

/** Line 1: Family · 2 BHK · ₹25k - ₹35k.  Line 2: HSR, Koramangala · Move-in 5 Dec. */
export function factLines(t, now = new Date()) {
  const areas = t?.localities ?? [];
  const area = areas.length > 2 ? `${areas.slice(0, 2).join(", ")} +${areas.length - 2}` : areas.join(", ");
  const mi = moveInFact(t, now);
  return {
    one: [householdLabel(t), (t?.flat_types ?? []).join(", "), budgetLabel(t ?? {})].filter(Boolean).join(" · "),
    two: [area, mi?.text].filter(Boolean).join(" · "),
    passed: Boolean(mi?.passed),
    moveIn: mi,
    area,
  };
}
