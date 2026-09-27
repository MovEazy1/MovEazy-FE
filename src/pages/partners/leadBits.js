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
