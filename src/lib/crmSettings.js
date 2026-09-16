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
    id: "visit_reminder",
    name: "Visit reminder (1 day before)",
    body:
      "Hi {{client_name}}, a quick reminder — your visit is tomorrow at {{visit_time}}.\n\n" +
      "{{property_title}} — {{rent}}\n{{link}}\n\n" +
      "Does that still work for you? Reply here if you'd rather move it.",
  },
  {
    id: "visit_confirmation",
    name: "Visit confirmation (2 hrs before)",
    body:
      "Hi {{client_name}}, your visit is confirmed for {{visit_time}} — about 2 hours from now.\n\n" +
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

/** Templates a feature sends by id — these have to exist or a button does
 *  nothing. Anything else in DEFAULT_TEMPLATES is a starting point the team is
 *  free to delete. */
const REQUIRED_TEMPLATE_IDS = ["send_property", "visit_reminder", "visit_confirmation"];

function normalize(data) {
  const saved = Array.isArray(data?.templates) && data.templates.length
    ? data.templates
        .map((t) => ({
          id: String(t?.id || "").trim() || `t_${Math.random().toString(36).slice(2, 8)}`,
          name: String(t?.name || "Untitled").trim().slice(0, 60),
          body: String(t?.body || "").slice(0, 4000),
        }))
        .filter((t) => t.body)
    : DEFAULT_TEMPLATES;

  // A team that saved settings before a feature shipped would otherwise never
  // see the template that feature sends. Only the required ids are filled in,
  // so a template someone deliberately deleted stays deleted.
  const have = new Set(saved.map((t) => t.id));
  const templates = [
    ...saved,
    ...DEFAULT_TEMPLATES.filter((t) => REQUIRED_TEMPLATE_IDS.includes(t.id) && !have.has(t.id)),
  ];

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

/**
 * The only way a listing link is built, anywhere in the app.
 *
 * Everything shared points at `/p/:id` — a tiny server-rendered page carrying
 * that property's own Open Graph tags, so WhatsApp previews the flat instead of
 * our logo. It forwards on to /map?listingId=…, token included, so the landing
 * behaviour is unchanged.
 *
 * Every link is attributed, because a link that escapes without parameters is
 * traffic nobody can account for:
 *
 *  - UTM parameters name the surface the share came from — the CRM, an owner
 *    sharing their own flat, a renter sending one to a friend — so those read
 *    as three different things in analytics rather than one anonymous blob.
 *  - `mz_s`, an opaque per-share token, is what ties an open back to one client
 *    and one property. The recipient is signed out when they tap a WhatsApp
 *    link, so UTMs alone can only say "someone came from the CRM". Only CRM
 *    sends carry one; there is no client to tie an owner's share to.
 *
 * `options` accepts a bare token string too, which is how the CRM's callers
 * already spell it.
 */
export function propertyLink(propertyId, options = {}) {
  const o = typeof options === "string" ? { token: options } : (options || {});
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://www.moveazy.co.in";
  const q = new URLSearchParams({
    utm_source: o.source || "crm",
    utm_medium: o.medium || "whatsapp",
    utm_campaign: o.campaign || "property_share",
    utm_content: propertyId,
  });
  if (o.token) q.set("mz_s", o.token);
  return `${origin}/p/${encodeURIComponent(propertyId)}?${q.toString()}`;
}

/**
 * Where a share came from. Named rather than spelled out at each call site, so
 * a new share button can't invent its own vocabulary — or forget to attribute
 * itself, which is how a bare /map?listingId= link reached a customer.
 */
export const SHARE_SOURCES = {
  /** An agent sending a flat from a client's record. */
  crm: { source: "crm", medium: "whatsapp", campaign: "property_share" },
  /** A poster sharing their own listing from My Properties. */
  owner: { source: "owner", medium: "share", campaign: "listing_share" },
  /** Anyone sharing a listing from the property page. */
  listing: { source: "app", medium: "share", campaign: "listing_share" },
  /** Posted to a Facebook feed, group or page from the CRM. */
  facebook: { source: "facebook", medium: "social", campaign: "property_share" },
  /** Posted to a subreddit from the CRM. */
  reddit: { source: "reddit", medium: "social", campaign: "property_share" },
};

/**
 * A social post is read by strangers, so unlike a WhatsApp send there is no one
 * client to tie it to — the UTM parameters are the whole of the attribution.
 * They survive all the way to signup because lib/attribution.js keeps the first
 * touch and stamps it onto the account, which is the only way a post made today
 * gets credited for an account created next week.
 */
function socialLink(propertyId, sourceKey) {
  return propertyLink(propertyId, SHARE_SOURCES[sourceKey]);
}

/**
 * Facebook's sharer takes a URL and nothing else — the card's title, blurb and
 * picture all come from the Open Graph tags /p/:id serves, which is why the
 * preview is the four-photo collage rather than our logo.
 */
export function facebookShareUrl(propertyId) {
  if (!propertyId) return "";
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(socialLink(propertyId, "facebook"))}`;
}

/**
 * Reddit wants a title typed by the sharer; pre-filling it from the listing
 * saves the agent the retype and keeps posts reading the same across
 * subreddits. The picture still comes from the same OG tags.
 */
export function redditShareUrl(propertyId, title) {
  if (!propertyId) return "";
  const u = encodeURIComponent(socialLink(propertyId, "reddit"));
  const t = encodeURIComponent(String(title || "").slice(0, 280));
  return `https://www.reddit.com/submit?url=${u}&title=${t}`;
}

/** "2 BHK for rent in Bellandur — ₹22,500/mo": a headline a subreddit reads well. */
export function socialShareTitle(listing) {
  if (!listing) return "Home for rent on MovEazy";
  const kind = listing.flat_type || "Home";
  const where = listing.area || listing.city || "Bengaluru";
  const rent = inr(listing.rent);
  const head = `${kind} for rent in ${where}`;
  return rent ? `${head} — ${rent}/mo` : head;
}

/**
 * The same source, distinguishing the OS share sheet from a copied link —
 * worth separating, because one lands in a chat and the other could go
 * anywhere.
 */
export function shareVia(sourceKey, method) {
  const base = SHARE_SOURCES[sourceKey] || SHARE_SOURCES.listing;
  return { ...base, medium: method === "copy" ? "copy_link" : base.medium };
}

/** Opaque, unguessable id for one send of one property to one client. */
export function generateShareToken() {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return `mz${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Build the variable bag for one send. Anything missing renders as an empty
 * string rather than a literal {{placeholder}} — a half-filled template is
 * embarrassing in a customer's WhatsApp.
 */
export function buildTemplateVars({
  client, requirement, agentName, property, matches = [], visitTime = "",
  shareToken = "", shareTokens = {},
} = {}) {
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
    // Each line carries its own tracked link, so a bulk share is as attributable
    // as a single send — otherwise "share top 5" would be the one blind path.
    match_list: matches
      .map((m) => {
        const id = m.listing?.property_id;
        const head = `• ${m.listing?.flat_type || "Home"}, ${m.listing?.area || ""} — ${inr(m.listing?.rent)}`;
        return id ? `${head}\n${propertyLink(id, shareTokens[id] || "")}` : head;
      })
      .join("\n\n"),
    property_id: property?.property_id ?? "",
    property_title: property?.title || property?.area || "",
    flat_type: property?.flat_type ?? "",
    rent: inr(property?.rent),
    area: property?.area ?? "",
    link: property?.property_id ? propertyLink(property.property_id, shareToken) : "",
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
