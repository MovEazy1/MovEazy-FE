/**
 * Team-wide CRM settings: the WhatsApp templates everyone sends, and the
 * "closed outside" reason list.
 *
 * One row (id='default') read by every staff member, writable only with
 * crm.templates.write — so nobody quietly rewrites what the company sounds like.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

export const DEFAULT_TEMPLATES = [
  {
    id: "share_matches",
    name: "Share matches",
    body:
      "Hi {{client_name}}, this is {{agent_name}} from MovEazy 👋\n\n" +
      "Based on what you're looking for in {{localities}} around {{budget}}, " +
      "I've shortlisted {{match_count}} homes for you:\n\n{{match_list}}\n\n" +
      "Want me to book visits this weekend?",
  },
  {
    id: "send_property",
    name: "Send one property",
    body:
      "{{flat_type}} at {{rent}}. Reply with like / dislike / okay to help us " +
      "understand your preference.\n\n{{link}}",
  },
  {
    id: "first_outreach",
    name: "First outreach",
    body:
      "Hi {{client_name}}, this is {{agent_name}} from MovEazy. You were looking for a home " +
      "in {{localities}} — I have a few that fit. Is now a good time to talk?",
  },
  {
    id: "visit_confirmation",
    name: "Visit confirmation",
    body:
      "Hi {{client_name}}, your visit is confirmed for {{visit_time}}.\n\n" +
      "{{property_title}} — {{rent}}\n{{link}}\n\nI'll meet you there. Reply here if anything changes.",
  },
  {
    id: "follow_up",
    name: "Follow-up",
    body:
      "Hi {{client_name}}, just checking in — did any of the homes I sent work for you? " +
      "Happy to send more if none of them felt right.",
  },
];

export const DEFAULT_CLOSED_OUTSIDE_REASONS = [
  "Nothing in their area",
  "We were too slow",
  "Price",
  "Went with a broker",
  "Plans changed",
  "Other",
];

export const TEMPLATE_VARIABLES = [
  "client_name", "agent_name", "localities", "budget", "match_count", "match_list",
  "property_id", "property_title", "flat_type", "rent", "area", "link", "visit_time",
];

export const DEFAULT_CRM_SETTINGS = {
  defaultTemplateId: "share_matches",
  templates: DEFAULT_TEMPLATES,
  closedOutsideReasons: DEFAULT_CLOSED_OUTSIDE_REASONS,
};

function normalize(data) {
  const templates = Array.isArray(data?.templates) && data.templates.length
    ? data.templates
        .map((t) => ({
          id: String(t?.id || "").trim() || `t_${Math.random().toString(36).slice(2, 8)}`,
          name: String(t?.name || "Untitled").trim().slice(0, 60),
          body: String(t?.body || "").slice(0, 4000),
        }))
        .filter((t) => t.body)
    : DEFAULT_TEMPLATES;

  const reasons = Array.isArray(data?.closedOutsideReasons) && data.closedOutsideReasons.length
    ? data.closedOutsideReasons.map((r) => String(r).trim().slice(0, 80)).filter(Boolean)
    : DEFAULT_CLOSED_OUTSIDE_REASONS;

  const defaultTemplateId = templates.some((t) => t.id === data?.defaultTemplateId)
    ? data.defaultTemplateId
    : templates[0].id;

  return { defaultTemplateId, templates, closedOutsideReasons: reasons };
}

export async function fetchCrmSettings() {
  if (!isSupabaseConfigured || !supabase) return { ...DEFAULT_CRM_SETTINGS };
  try {
    const { data, error } = await supabase
      .from("crm_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_CRM_SETTINGS };
    return normalize(data.data);
  } catch {
    return { ...DEFAULT_CRM_SETTINGS };
  }
}

export async function saveCrmSettings(draft, actorEmail = "") {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const payload = normalize(draft);
  const { error } = await supabase.from("crm_settings").upsert(
    { id: "default", data: payload, updated_by: actorEmail, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) throw error;
  return payload;
}

/* ── Rendering ────────────────────────────────────────────────────────────── */

const inr = (n) =>
  Number.isFinite(Number(n)) && Number(n) > 0 ? `₹${Number(n).toLocaleString("en-IN")}` : "";

/** Public, shareable link to one listing — the URL the property modal shares. */
export function propertyLink(propertyId) {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://www.moveazy.co.in";
  return `${origin}/map?listingId=${encodeURIComponent(propertyId)}`;
}

/**
 * Build the variable bag for one send. Anything missing renders as an empty
 * string rather than a literal {{placeholder}} — a half-filled template is
 * embarrassing in a customer's WhatsApp.
 */
export function buildTemplateVars({ client, requirement, agentName, property, matches = [], visitTime = "" } = {}) {
  const budget =
    requirement?.budget_min || requirement?.budget_max
      ? [inr(requirement.budget_min), inr(requirement.budget_max)].filter(Boolean).join("–")
      : "";

  return {
    client_name: (client?.name || "").split(/\s+/)[0] || "there",
    agent_name: agentName || "MovEazy",
    localities: (requirement?.localities ?? []).join(", "),
    budget,
    match_count: String(matches.length || ""),
    match_list: matches
      .map((m) => `• ${m.listing?.flat_type || "Home"}, ${m.listing?.area || ""} — ${inr(m.listing?.rent)}`)
      .join("\n"),
    property_id: property?.property_id ?? "",
    property_title: property?.title || property?.area || "",
    flat_type: property?.flat_type ?? "",
    rent: inr(property?.rent),
    area: property?.area ?? "",
    link: property?.property_id ? propertyLink(property.property_id) : "",
    visit_time: visitTime,
  };
}

export function renderTemplate(body, vars) {
  return String(body || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars?.[key] ?? "");
}

/** Digits for wa.me — bare 10-digit Indian numbers get the country code. */
export function waDigits(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10) return `91${d}`;
  return d.slice(0, 15);
}

export function whatsappUrl(phone, message) {
  const digits = waDigits(phone);
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message || "")}`;
}
