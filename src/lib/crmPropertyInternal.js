/**
 * Where a flat came from, and who to ring about it.
 *
 * Internal only. Every read here goes to public.inventory_private or
 * public.crm_brokers, which anon holds no grant on at all and which are gated
 * row-by-row behind is_crm_staff() — see MovEazy-BE/supabase/crm_property_internal.sql
 * for why this is a separate table rather than columns on `inventory`.
 *
 * The database is the boundary that matters, not this file. But nothing in a
 * customer-facing path should import this module either: keeping it out of the
 * tenant bundle means a POC number is never on a page where a stray render
 * could put it on screen. The only importers are src/pages/crm/*.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { normalizeIndianMobile } from "./mobile";

/**
 * How the flat reached us.
 *
 * Deliberately not inventory.posted_by, which is a public column the property
 * card renders to tenants as "Owner / Broker / Tenant". The two are allowed to
 * disagree: a flat listed as the owner's often arrives through a broker, and
 * that is exactly the fact worth recording.
 */
export const PROPERTY_SOURCES = [
  { id: "owner", label: "Owner" },
  { id: "broker", label: "Broker" },
  { id: "tenant", label: "Tenant" },
];

export const BLANK_INTERNAL = {
  source: "owner",
  broker_id: "",
  poc_name: "",
  poc_phone: "",
  poc_email: "",
  poc_note: "",
};

/**
 * The tables aren't there yet.
 *
 * Told apart from a real failure so the form can say which file to run instead
 * of reporting a broken save on a listing that saved fine.
 */
export const isMissingInternalTable = (error) =>
  error?.code === "PGRST205" ||
  error?.code === "42P01" ||
  /could not find the table/i.test(error?.message || "") ||
  /relation .* does not exist/i.test(error?.message || "");

const clean = (v) => String(v ?? "").trim();

/* ── Broker directory ─────────────────────────────────────────────────────── */

/** The dropdown: most recently used first, then alphabetical. */
export async function fetchBrokers() {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("crm_brokers")
    .select("id,name,phone,agency,email,notes,last_used_at,created_at")
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true })
    .limit(500);
  if (error) {
    if (isMissingInternalTable(error)) return [];
    return [];
  }
  return data ?? [];
}

/**
 * Find this broker or create them.
 *
 * Matched on the normalised number, because that is the only field two agents
 * will type identically — "Ravi" and "Ravi Kumar" are one broker, and a
 * directory that holds both of those is what the dropdown exists to avoid. A
 * broker entered without a number can't be matched, so they are always new.
 */
export async function upsertBroker(broker, actorEmail = "") {
  if (!isSupabaseConfigured || !supabase) return null;
  const name = clean(broker?.name);
  if (!name) return null;
  const phone = normalizeIndianMobile(broker?.phone);

  if (phone) {
    const { data: found } = await supabase
      .from("crm_brokers")
      .select("id,name,phone,agency,email,notes")
      .eq("phone_norm", phone)
      .maybeSingle();
    if (found?.id) {
      // Fill in what was blank before; never overwrite what somebody already
      // recorded with this upload's guess at it.
      const patch = {};
      if (!clean(found.agency) && clean(broker?.agency)) patch.agency = clean(broker.agency);
      if (!clean(found.email) && clean(broker?.email)) patch.email = clean(broker.email);
      if (Object.keys(patch).length) {
        await supabase.from("crm_brokers").update(patch).eq("id", found.id);
      }
      await touchBroker(found.id);
      return { ...found, ...patch };
    }
  }

  const { data, error } = await supabase
    .from("crm_brokers")
    .insert({
      name,
      phone,
      agency: clean(broker?.agency),
      email: clean(broker?.email),
      notes: clean(broker?.notes),
      created_by: clean(actorEmail),
      last_used_at: new Date().toISOString(),
    })
    .select("id,name,phone,agency,email,notes")
    .single();
  if (error) {
    // Two uploads racing on the same new number: the index did its job, so
    // read back the row that won rather than failing the save.
    if (phone && /duplicate|unique/i.test(error.message || "")) {
      const { data: raced } = await supabase
        .from("crm_brokers")
        .select("id,name,phone,agency,email,notes")
        .eq("phone_norm", phone)
        .maybeSingle();
      if (raced?.id) return raced;
    }
    throw error;
  }
  return data;
}

/** Keeps the dropdown ordered by who is actually being used. */
export async function touchBroker(id) {
  if (!id || !isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from("crm_brokers").update({ last_used_at: new Date().toISOString() }).eq("id", id);
  } catch { /* ordering is a convenience, not worth failing an upload over */ }
}

/* ── Per-listing internal details ─────────────────────────────────────────── */

export async function fetchInternal(propertyId) {
  if (!propertyId || !isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from("inventory_private")
    .select("property_id,source,broker_id,poc_name,poc_phone,poc_email,poc_note,updated_at")
    .eq("property_id", propertyId)
    .maybeSingle();
  if (error) return null;
  return data ?? null;
}

/** Every listing's internal row, for the Properties table. */
export async function fetchInternalMap(propertyIds = []) {
  const ids = [...new Set(propertyIds.filter(Boolean))];
  if (!ids.length || !isSupabaseConfigured || !supabase) return {};
  const out = {};
  // PostgREST puts the filter in the URL, so a few hundred listings would
  // otherwise build a request long enough for the gateway to reject.
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase
      .from("inventory_private")
      .select("property_id,source,broker_id,poc_name,poc_phone,poc_email,poc_note")
      .in("property_id", ids.slice(i, i + CHUNK));
    if (error) return out;
    for (const row of data ?? []) out[row.property_id] = row;
  }
  return out;
}

/**
 * Write the internal details for one listing.
 *
 * Upsert on property_id: a listing has one set of these, and an agent editing
 * a property is correcting what is there rather than adding a second record.
 */
export async function saveInternal(propertyId, details, actorEmail = "") {
  if (!propertyId) return { ok: false, error: new Error("No property id") };
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: new Error("Supabase is not configured") };

  const source = PROPERTY_SOURCES.some((s) => s.id === details?.source) ? details.source : "owner";
  const row = {
    property_id: propertyId,
    source,
    // A broker id only means something when the flat came via a broker.
    // Keeping one from a source that was later changed would leave a listing
    // marked "owner" pointing at an agency.
    broker_id: source === "broker" && details?.broker_id ? details.broker_id : null,
    poc_name: clean(details?.poc_name),
    poc_phone: clean(details?.poc_phone),
    poc_email: clean(details?.poc_email),
    poc_note: clean(details?.poc_note),
    updated_at: new Date().toISOString(),
    created_by: clean(actorEmail),
  };

  try {
    const { error } = await supabase
      .from("inventory_private")
      .upsert(row, { onConflict: "property_id" });
    if (error) throw error;
    if (row.broker_id) await touchBroker(row.broker_id);
    return { ok: true };
  } catch (error) {
    return { ok: false, error, missingTable: isMissingInternalTable(error) };
  }
}

/** True once there is anything here worth showing an agent. */
export function hasInternalDetail(row) {
  if (!row) return false;
  return Boolean(
    clean(row.poc_name) || clean(row.poc_phone) || clean(row.poc_email) ||
    clean(row.poc_note) || row.broker_id,
  );
}

export function sourceLabel(id) {
  return PROPERTY_SOURCES.find((s) => s.id === id)?.label ?? "Owner";
}

/**
 * What we open WhatsApp with, to the POC, about one flat.
 *
 * No rent and no tenant details: this goes to whoever holds the keys, and the
 * only thing an agent ever needs to open with is which flat they mean.
 */
export function pocMessage({ pocName, propertyId, title, area } = {}) {
  const who = clean(pocName).split(/\s+/)[0];
  const what = [clean(title), clean(area)].filter(Boolean).join(", ") || clean(propertyId);
  return [
    `Hi${who ? ` ${who}` : ""}, this is MovEazy.`,
    "",
    `About ${what}${propertyId && what !== propertyId ? ` (${propertyId})` : ""} —`,
  ].join("\n");
}
