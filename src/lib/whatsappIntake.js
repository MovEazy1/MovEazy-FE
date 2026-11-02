/**
 * WhatsApp → listings (MovEazy-BE whatsapp_intake.sql; api/whatsapp-*.js).
 *
 * A marked number — the CRM list or an approved partner — sends a flat to our
 * WhatsApp Business number; AI reads it into a draft; the team opens the draft
 * in the property form (?wa=<draft>), checks it and publishes. Nothing goes
 * live by itself. A "rented" message suggests which listing to close.
 *
 * Internal only: CRM pages import this, nothing customer-facing.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

export const fetchWaInbox = () => rpc("crm_wa_inbox").then((r) => r ?? { drafts: [], reading: [], pending: 0 });
export const fetchWaPendingCount = () => rpc("crm_wa_pending_count").then((n) => Number(n) || 0, () => 0);
export const fetchWaDraft = (id) => rpc("crm_wa_draft", { p_id: id });
export const markWaDraftPublished = (id, propertyId) => rpc("crm_wa_draft_published", { p_id: id, p_property: propertyId });
export const dismissWaDraft = (id) => rpc("crm_wa_draft_dismiss", { p_id: id });
export const markWaRented = (id, propertyId) => rpc("crm_wa_mark_rented", { p_id: id, p_property: propertyId });
export const retryWaBatch = (id) => rpc("crm_wa_retry", { p_batch: id });
export const fetchWaNumbers = () => rpc("crm_wa_numbers").then((r) => r ?? { marked: [], partners: [] });
export const saveWaNumber = (phone, label = "") => rpc("crm_wa_number_save", { p_phone: phone, p_label: label });
export const removeWaNumber = (phone) => rpc("crm_wa_number_remove", { p_phone: phone });

/** Read whatever is waiting now rather than at the next 2-minute tick. Never throws. */
export const pokeWaProcess = () => fetch("/api/whatsapp-process", { method: "POST" }).then((r) => r.json()).catch(() => null);

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/quicktime": "mov" };

/** A message pasted into the inbox, with its photos, read like one that came on WhatsApp. */
export async function pasteWaMessage(text, files = [], from = "") {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const urls = [];
  for (const file of files.slice(0, 30)) {
    const ext = EXT[file.type] || (file.type.startsWith("video/") ? "mp4" : "jpg");
    const path = `whatsapp/paste/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage.from("listings").upload(path, file, { contentType: file.type || undefined });
    if (error) throw error;
    urls.push(supabase.storage.from("listings").getPublicUrl(data.path).data.publicUrl);
  }
  const id = await rpc("crm_wa_paste", { p_text: text, p_images: urls, p_from: from });
  pokeWaProcess();
  return id;
}

export const SENDER_KIND = { partner: "Partner", marked: "Marked number", team: "Pasted" };
const fmt10 = (p) => (/^\d{10}$/.test(p || "") ? `${p.slice(0, 5)} ${p.slice(5)}` : p || "");
export const senderLine = (d) => [d.sender_name || SENDER_KIND[d.sender_kind] || "", fmt10(d.from10)].filter(Boolean).join(" · ");

/** A draft's one-line summary: "2 BHK · HSR · ₹32,000". */
export function draftSummary(d) {
  const f = d?.fields ?? {};
  return [f.flat_type, f.area || f.area_text, Number(f.rent) > 0 ? `₹${Number(f.rent).toLocaleString("en-IN")}` : "", f.building_name]
    .filter(Boolean).join(" · ");
}

/**
 * A draft → what the property form fills: the listing's fields, its photos,
 * the internal source / person to call, and the message itself (shown beside
 * the form, and in its "Read it" box).
 */
export function draftToForm(d) {
  const f = d?.fields ?? {};
  const v = (x) => (x === null || x === undefined ? "" : x);
  const viaBroker = d?.sender_kind === "partner" || (d?.sender_kind === "marked" && f.contact_role !== "owner");
  const contactPhone = f.contact_phone || "";
  const form = {
    area: v(f.area),
    full_address: [f.building_name, f.full_address].filter(Boolean).join(", "),
    landmark: v(f.landmark),
    rent: v(f.rent),
    deposit: v(f.deposit),
    maintenance: v(f.maintenance),
    available_from: v(f.available_from),
    flat_type: v(f.flat_type),
    bedrooms: v(f.bedrooms),
    bathrooms: v(f.bathrooms),
    floor_number: v(f.floor_number),
    total_floors: v(f.total_floors),
    furnishing: v(f.furnishing),
    gender_pref: f.gender_pref || "any",
    occupants_allowed: f.occupants_allowed ?? [],
    house_rules: f.house_rules ?? [],
    title: v(f.title),
    description: v(f.description),
    posted_by: viaBroker && f.contact_role !== "owner" ? "broker" : "owner",
    ...(f.amenities?.length ? { amenities: f.amenities } : {}),
  };
  const received = d?.received_at ? new Date(d.received_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";
  const internal = {
    source: viaBroker ? "broker" : "owner",
    ...(viaBroker && d?.crm_broker_id ? { broker_id: d.crm_broker_id } : {}),
    poc_name: f.contact_name || (contactPhone ? "" : d?.sender_name || ""),
    poc_phone: contactPhone || d?.from10 || "",
    poc_note: [`From WhatsApp${received ? ` on ${received}` : ""}: ${senderLine(d)}`, f.notes].filter(Boolean).join(". ").slice(0, 500),
    ...(f.contact_role === "owner" && contactPhone ? { owner_phone: contactPhone } : {}),
  };
  return { form, internal, images: d?.images ?? [], text: d?.text || "", buildingName: f.building_name || "" };
}

/* ── Connecting the number (Meta's Embedded Signup, coexistence) ────────── */

export const META_APP_ID = (import.meta.env.VITE_META_APP_ID || "").trim();
export const WA_CONFIG_ID = (import.meta.env.VITE_WA_CONFIG_ID || "").trim();

function loadFacebookSdk() {
  if (window.FB) return Promise.resolve(window.FB);
  return new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB.init({ appId: META_APP_ID, autoLogAppEvents: true, xfbml: false, version: "v23.0" });
      resolve(window.FB);
    };
    const s = document.createElement("script");
    s.src = "https://connect.facebook.net/en_US/sdk.js";
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onerror = () => reject(new Error("Couldn't load Facebook's sign-in. Check ad blockers and try again."));
    document.body.appendChild(s);
  });
}

/**
 * Meta's popup: sign in, pick the business, scan the QR in the WhatsApp
 * Business app. Then the server finishes (api/whatsapp-connect.js).
 */
export async function connectWhatsApp() {
  if (!META_APP_ID || !WA_CONFIG_ID) throw new Error("Add VITE_META_APP_ID and VITE_WA_CONFIG_ID in Vercel, then redeploy.");
  const FB = await loadFacebookSdk();
  let ids = null;
  const onMessage = (e) => {
    if (!/(^|\.)facebook\.com$/.test(new URL(e.origin).hostname)) return;
    try {
      const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      if (data?.type === "WA_EMBEDDED_SIGNUP" && data.data?.waba_id) ids = data.data;
    } catch { /* not ours */ }
  };
  window.addEventListener("message", onMessage);
  try {
    const code = await new Promise((resolve, reject) => {
      FB.login((res) => (res?.authResponse?.code ? resolve(res.authResponse.code) : reject(new Error("Connecting was cancelled."))), {
        config_id: WA_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
      });
    });
    // The account ids arrive by postMessage, just before or after the code.
    for (let i = 0; i < 20 && !ids; i++) await new Promise((r) => setTimeout(r, 250));
    if (!ids) throw new Error("Meta didn't say which number was connected — try again.");
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch("/api/whatsapp-connect", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token || ""}` },
      body: JSON.stringify({ code, waba_id: ids.waba_id, phone_number_id: ids.phone_number_id }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error || `Couldn't connect (${r.status})`);
    return body;
  } finally {
    window.removeEventListener("message", onMessage);
  }
}
