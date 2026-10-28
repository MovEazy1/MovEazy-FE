/**
 * Tenant views — every tenant we can name who opened a property, and how it
 * went for them (MovEazy-BE/supabase/tenant_views.sql decides who counts and
 * keeps every answer; this file calls it and words it).
 *
 * The response is BR Homes' labels everywhere: visit pending / done, liked
 * (negotiating, exploring, will pay token, paid token) or not (reasons, typed
 * ones offered on every property). The team's answer wins over a partner's,
 * a partner's over the tenant's own swipe or booking.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { visitorId } from "./storefront";
import { LIKED_STATUSES, reasonLabel } from "./buildings";

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

/* ── Words ───────────────────────────────────────────────────────────────── */
export const VIEW_SOURCES = { share: "Link we sent", website: "Website", qr: "QR", team: "Team added", partner: "Partner" };
export const RESPONDERS = { team: "MovEazy team", partner: "Partner", tenant: "Tenant" };

/** "Visit done · Liked · Will pay token", "Did not like · Size is small", or "No response yet". */
export function viewSummary(v) {
  if (!v || !v.response_by) return "No response yet";
  const parts = [];
  if (v.visit === "done") parts.push("Visit done");
  else if (v.visit === "pending") parts.push("Visit pending");
  if (v.liked === "liked") parts.push("Liked", LIKED_STATUSES.find((s) => s.id === v.liked_status)?.label);
  if (v.liked === "disliked") parts.push("Did not like", (v.reasons ?? []).map(reasonLabel).join(", "));
  return parts.filter(Boolean).join(" · ") || "No response yet";
}

/** "45s", "3m 10s", "1h 5m". */
export function fmtSeconds(s) {
  const n = Math.max(0, Math.round(Number(s) || 0));
  if (n < 60) return `${n}s`;
  if (n < 3600) return `${Math.floor(n / 60)}m${n % 60 ? ` ${n % 60}s` : ""}`;
  return `${Math.floor(n / 3600)}h ${Math.floor((n % 3600) / 60)}m`;
}

/** "Opened 3× · 2m 10s · 8 photos". */
export function viewSignals(v) {
  if (!v) return "";
  return [
    v.opens > 0 ? `Opened ${v.opens}×` : "",
    v.seconds > 0 ? fmtSeconds(v.seconds) : "",
    v.photos > 0 ? `${v.photos} photo${v.photos === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(" · ");
}

export const sourcesLabel = (v) => (v?.sources ?? []).map((s) => VIEW_SOURCES[s] || s).join(", ");

/** "₹25,000". */
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/** The WhatsApp the team sends a broker about a client they have. */
export function brokerFollowUpMessage({ broker = "", clientName = "", clientPhone = "", flat = null }) {
  const who = [clientPhone, clientName].filter(Boolean).join(" - ");
  const price = flat?.rent ? `${inr(flat.rent)} ` : "";
  return `Hi ${broker || "there"}. What's the status of this client: ${who}. Did they like the ${price}flat? also inko aap similar flats aur bhejo, close krte isko.`;
}

/** The CRM's Tenant views filters: id, label, who's in (`day` is today, YYYY-MM-DD in IST). */
export const VIEW_FILTERS = [
  { id: "open", label: "Not marked by team", test: (v) => v.response_by !== "team" },
  { id: "due", label: "Follow-up due", test: (v, day) => Boolean(v.follow_up_on && v.follow_up_on <= day) },
  { id: "share", label: "Link we sent", test: (v) => (v.sources ?? []).includes("share") },
  { id: "liked", label: "Liked", test: (v) => v.liked === "liked" },
  { id: "disliked", label: "Did not like", test: (v) => v.liked === "disliked" },
  { id: "all", label: "All", test: () => true },
];
export const istDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/* ── The tenant's side (moveazy.co.in) ───────────────────────────────────── */
/** This phone opened a link the team sent: its opens are that client's from now on. Never throws. */
export function linkVisitor(token) {
  const v = visitorId();
  if (!token || String(token).length < 8 || !v || !isSupabaseConfigured || !supabase) return Promise.resolve();
  return supabase.rpc("tenant_visitor_link", { p_token: String(token), p_visitor: v }).then(() => {}, () => {});
}

/** How long a property's page was open and how many photos they saw. Never throws. */
export function reportEngagement(propertyId, seconds, photos) {
  if (!propertyId || !isSupabaseConfigured || !supabase) return Promise.resolve();
  return supabase.rpc("flat_view_engage", {
    p_property: String(propertyId), p_visitor: visitorId() || "anonymous-visitor",
    p_seconds: Math.round(seconds || 0), p_photos: Math.round(photos || 0),
  }).then(() => {}, () => {});
}

/* ── The CRM ─────────────────────────────────────────────────────────────── */
/** { views: [view + client], reasons } */
export const fetchPropertyTenantViews = (propertyId) => rpc("crm_property_tenant_views", { p_property: propertyId });
/** { views: [view + property], reasons } */
export const fetchClientTenantViews = (clientId) => rpc("crm_client_tenant_views", { p_client: clientId });
/** { views: [view + client + property], reasons } — the latest 1,500. */
export const fetchTenantViews = () => rpc("crm_tenant_views");
/** { open, due } for the bar on the CRM's home. */
export const fetchTenantViewsSummary = () => rpc("crm_tenant_views_summary");
export const fetchTenantViewHistory = (viewId) => rpc("crm_tenant_view_history", { p_view: viewId }).then((r) => r ?? []);
/** The team's answer: { visit, liked, liked_status, reasons, note, follow_up_on }. → the view. */
export const saveTenantView = (propertyId, clientId, f) =>
  rpc("crm_tenant_view_save", { p_property: propertyId, p_client: clientId, p: { ...f, follow_up_on: f.follow_up_on || null } });
/** The brokers who have this client, and all they did. */
export const fetchBrokerActivity = (clientId) => rpc("crm_client_broker_activity", { p_client: clientId }).then((r) => r ?? []);
export const logBrokerFollowUp = (assignmentId) => rpc("crm_broker_follow_up_log", { p_assignment: assignmentId });

/* ── The partner app ─────────────────────────────────────────────────────── */
/** assignment_id → { follow_up_on, follow_up_note, flats: [...] } */
export const fetchPartnerLeadViews = () =>
  rpc("partner_lead_views").then((r) => new Map((r ?? []).map((x) => [x.assignment_id, x])), () => new Map());
export const setPartnerFollowUp = (assignmentId, on, note = "") =>
  rpc("partner_lead_follow_up", { p_assignment: assignmentId, p_on: on || "", p_note: note });
export const partnerRespond = (assignmentId, propertyId, f) =>
  rpc("partner_view_respond", { p_assignment: assignmentId, p_property: propertyId, p: f });
