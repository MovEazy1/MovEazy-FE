/**
 * The data layer behind /marketing/*.
 *
 * Everything here goes through security-definer RPCs rather than table reads,
 * because the people these dashboards are built for are deliberately not
 * admins. Rishav can see the funnel for Rishav's link; he cannot see the user
 * table, the CRM, or anyone else's channel. That boundary lives in Postgres
 * (MovEazy-BE/supabase/marketing_schema.sql) — the checks in this file and in
 * the pages are a courtesy that keeps the UI honest, not the thing that
 * enforces it.
 *
 * Channel definitions live in the database, not in a constant here, so adding a
 * channel is a row in the super-admin panel rather than a deploy. The route
 * /marketing/:slug resolves against whatever is in that table.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

const PROD_ORIGIN = "https://www.moveazy.co.in";

/** The seven columns across the top of every dashboard, in funnel order. */
export const FUNNEL_STEPS = [
  { key: "link_clicks",      label: "Link clicks",      hint: "Times the link was opened" },
  { key: "visitors",         label: "Visitors",         hint: "Distinct browsers behind those opens" },
  { key: "signups",          label: "Signups",          hint: "Created an account after arriving" },
  { key: "prefs_filled",     label: "Pref filled",      hint: "Told us what they are looking for" },
  { key: "shortlisted",      label: "Prop shortlisted", hint: "Saved or liked at least one flat" },
  { key: "visits_scheduled", label: "Visit scheduled",  hint: "Booked at least one visit" },
  { key: "closed",           label: "Closed",           hint: "Search ended with a MovEazy home" },
];

function unconfigured(where) {
  return new Error(`${where}: Supabase is not configured.`);
}

/**
 * A missing function or table means the migration hasn't been run yet. Worth
 * telling the operator plainly — an empty dashboard and an unapplied migration
 * look identical otherwise, and the fix is completely different.
 */
export function isMissingMigration(error) {
  // One missing column is not a missing migration, and saying so is what sent
  // the super admin to the SQL editor when the panel could have simply dropped
  // a field and carried on.
  if (isMissingColumn(error)) return false;
  const msg = String(error?.message || "").toLowerCase();
  return (
    error?.code === "42883" ||
    error?.code === "42P01" ||
    error?.code === "PGRST202" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the function") ||
    msg.includes("schema cache")
  );
}

/**
 * A column a pending migration adds, which this build already asks for.
 *
 * Distinct from isMissingMigration() on purpose, and the distinction matters:
 * PostgREST reports both as "does not exist", so a frontend that shipped ahead
 * of its migration told the super admin the whole marketing system was
 * unavailable when in fact only one column was. That is a worse failure than
 * the missing column — the panel went dark rather than losing a field.
 */
function isMissingColumn(error) {
  const msg = String(error?.message || "").toLowerCase();
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    /column .* does not exist/.test(msg) ||
    /could not find the '.*' column/.test(msg)
  );
}

/** Columns the marketing migration adds after the frontend starts asking. */
const OPTIONAL_CHANNEL_COLS = ["platform"];

const withoutOptional = (cols) =>
  cols
    .split(",")
    .map((c) => c.trim())
    .filter((c) => !OPTIONAL_CHANNEL_COLS.includes(c))
    .join(",");

/** Defaults for whatever the retry had to drop, so callers see one shape. */
const fillOptional = (rows) => rows.map((r) => ({ platform: "other", ...r }));

async function rpc(name, args = {}) {
  if (!isSupabaseConfigured || !supabase) throw unconfigured(name);
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data ?? [];
}

/* ── Reading a dashboard ──────────────────────────────────────────────────── */

/** Every dashboard the signed-in email may open. Empty means no access. */
export const fetchMyChannels = () => rpc("my_marketing_channels");

/** One row per channel, for /marketing/head. */
export const fetchOverview = () => rpc("marketing_overview");

/** The tiles across the top of one channel's dashboard. */
export async function fetchChannelStats(slug) {
  const rows = await rpc("marketing_channel_stats", { p_slug: slug });
  return rows[0] ?? null;
}

/** The people behind those tiles, newest signup first. */
export const fetchChannelLeads = (slug) => rpc("marketing_channel_leads", { p_slug: slug });

/* ── Managing channels (super admin) ──────────────────────────────────────── */

const CHANNEL_COLS =
  "slug,label,description,utm_source,utm_medium,utm_campaign,landing_path,is_overview,active,platform,created_at";

export async function fetchAllChannels() {
  if (!isSupabaseConfigured || !supabase) throw unconfigured("marketing_channels");

  const run = (cols) =>
    supabase
      .from("marketing_channels")
      .select(cols)
      .order("is_overview", { ascending: false })
      .order("label");

  let { data, error } = await run(CHANNEL_COLS);
  if (error && isMissingColumn(error)) {
    // Frontend ahead of the migration. Drop the column and carry on — losing
    // "Posted to" is a far smaller loss than the panel refusing to open.
    console.warn(`[marketing] ${error.message} — retrying without it. Re-run marketing_schema.sql.`);
    ({ data, error } = await run(withoutOptional(CHANNEL_COLS)));
  }
  if (error) throw error;
  return fillOptional(data ?? []);
}

/**
 * The channels an agent can post a property to, grouped by where they post it.
 *
 * Deliberately forgiving: a missing table, a pending migration or an account
 * with no marketing access all resolve to an empty list rather than throwing.
 * The CRM's share menu then falls back to the plain per-platform link, which is
 * worse attribution but still a working share — a blank Facebook button because
 * analytics is unavailable would be the wrong trade.
 */
export async function fetchShareChannels() {
  if (!isSupabaseConfigured || !supabase) return [];

  const cols = "slug,label,platform,utm_source,utm_medium,utm_campaign,landing_path,is_overview,active";
  const run = (c) =>
    supabase
      .from("marketing_channels")
      .select(c)
      .eq("active", true)
      .eq("is_overview", false)
      .order("label");

  try {
    let { data, error } = await run(cols);
    if (error && isMissingColumn(error)) {
      // Without platform every channel falls into "other", which still gives
      // the agent a tracked link — just not grouped under Facebook yet.
      console.warn(`[crm] ${error.message} — retrying without it. Re-run marketing_schema.sql.`);
      ({ data, error } = await run(withoutOptional(cols)));
    }
    if (error) {
      console.warn(`[crm] marketing_channels: ${error.message}`);
      return [];
    }
    return fillOptional(data ?? []);
  } catch (e) {
    console.warn(`[crm] marketing_channels threw: ${e?.message}`);
    return [];
  }
}

/** Channels bucketed by platform, in the order the share menu should show them. */
export function groupByPlatform(channels) {
  const m = new Map();
  for (const c of channels) {
    const key = c.platform || "other";
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(c);
  }
  return m;
}

/** Slugs are the URL — normalise before they become one, not after. */
export function normalizeSlug(raw) {
  return String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "")
    .slice(0, 40);
}

/**
 * Where an agent goes to post, which decides the share menu a channel appears
 * under in the CRM. Kept apart from utm_source on purpose: Rishav's group is
 * posted to Facebook while still deserving a source of its own.
 */
export const PLATFORMS = [
  { id: "facebook", label: "Facebook — page, profile or group" },
  { id: "reddit", label: "Reddit" },
  { id: "instagram", label: "Instagram" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "twitter", label: "X / Twitter" },
  { id: "other", label: "Somewhere else — link only" },
];

export async function createChannel({
  slug, label, description = "", utmSource, utmMedium = "social", landingPath = "/",
  platform = "other",
}) {
  const s = normalizeSlug(slug);
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(s)) {
    throw new Error("Slug must be 2–41 characters: lowercase letters, numbers and dashes.");
  }
  if (!String(label || "").trim()) throw new Error("Give the channel a name.");
  if (!isSupabaseConfigured || !supabase) throw unconfigured("marketing_channels");

  const row = {
    slug: s,
    label: String(label).trim().slice(0, 80),
    description: String(description || "").trim().slice(0, 240),
    utm_source: String(utmSource || s).trim().slice(0, 60) || s,
    utm_medium: String(utmMedium || "social").trim().slice(0, 60),
    platform: PLATFORMS.some((p) => p.id === platform) ? platform : "other",
    // Derived, never typed. The campaign string is the join key every signup
    // is matched on, so letting it be edited by hand is letting a channel's
    // whole history be detached by a typo.
    utm_campaign: `mkt_${s}`,
    landing_path: String(landingPath || "/").trim().slice(0, 120) || "/",
  };

  const run = (payload, cols) =>
    supabase.from("marketing_channels").insert(payload).select(cols).single();

  let { data, error } = await run(row, CHANNEL_COLS);
  if (error && isMissingColumn(error)) {
    // Same retry as the reads: creating a channel must not be blocked by a
    // column the migration has not added yet.
    const { platform: _dropped, ...rest } = row;
    ({ data, error } = await run(rest, withoutOptional(CHANNEL_COLS)));
  }

  if (error) {
    if (String(error.message || "").toLowerCase().includes("duplicate")) {
      throw new Error(`/marketing/${s} already exists.`);
    }
    throw error;
  }
  return { platform: "other", ...data };
}

export async function setChannelActive(slug, active) {
  if (!isSupabaseConfigured || !supabase) throw unconfigured("marketing_channels");
  const { error } = await supabase
    .from("marketing_channels")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("slug", slug);
  if (error) throw error;
}

/* ── Managing access (super admin) ────────────────────────────────────────── */

export async function fetchAccessGrants() {
  if (!isSupabaseConfigured || !supabase) throw unconfigured("marketing_access");
  const { data, error } = await supabase
    .from("marketing_access")
    .select("id,email,channel_slug,notes,granted_by,created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function grantAccess(email, channelSlug, { grantedBy = "", notes = "" } = {}) {
  const normalized = String(email || "").toLowerCase().trim();
  if (!normalized.includes("@")) throw new Error("Enter a valid email address.");
  if (!channelSlug) throw new Error("Pick a dashboard.");
  if (!isSupabaseConfigured || !supabase) throw unconfigured("marketing_access");

  const { data, error } = await supabase
    .from("marketing_access")
    .insert({
      email: normalized,
      channel_slug: channelSlug,
      granted_by: String(grantedBy || "").toLowerCase().slice(0, 120),
      notes: String(notes || "").trim().slice(0, 240),
    })
    .select("id,email,channel_slug,notes,granted_by,created_at")
    .single();

  if (error) {
    if (String(error.message || "").toLowerCase().includes("duplicate")) {
      throw new Error("That email already has this dashboard.");
    }
    throw error;
  }
  return data;
}

export async function revokeAccess(id) {
  if (!id) throw new Error("Missing grant id.");
  if (!isSupabaseConfigured || !supabase) throw unconfigured("marketing_access");
  const { error } = await supabase.from("marketing_access").delete().eq("id", id);
  if (error) throw error;
}

/* ── Links ────────────────────────────────────────────────────────────────── */

/**
 * The origin a shared link should point at.
 *
 * Always production unless we are already on a MovEazy host — a link copied off
 * localhost and pasted into a Facebook group is worse than no link, and the
 * copy button is the only way most of these links will ever be created.
 */
function siteOrigin() {
  if (typeof window === "undefined") return PROD_ORIGIN;
  const { origin = "", hostname = "" } = window.location || {};
  return /(^|\.)moveazy\.co\.in$/i.test(hostname) && origin ? origin : PROD_ORIGIN;
}

/** The trackable link for a channel. This is what gets pasted into the post. */
export function channelLink(channel, { path } = {}) {
  if (!channel?.utm_campaign) return "";
  const landing = String(path || channel.landing_path || "/");
  const q = new URLSearchParams({
    utm_source: channel.utm_source || channel.slug,
    utm_medium: channel.utm_medium || "social",
    utm_campaign: channel.utm_campaign,
  });
  return `${siteOrigin()}${landing.startsWith("/") ? landing : `/${landing}`}?${q.toString()}`;
}

/** The dashboard's own URL, for the super admin to hand over. */
export const dashboardPath = (slug) => `/marketing/${slug}`;

/* ── Small shared formatters ──────────────────────────────────────────────── */

export const pct = (part, whole) =>
  !whole ? "—" : `${Math.round((Number(part || 0) / Number(whole)) * 100)}%`;

export function fmtDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
