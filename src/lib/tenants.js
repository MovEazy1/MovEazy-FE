import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * Owner ↔ tenant mapping — who's actually renting each property, their
 * contact details and rent terms (see MovEazy-BE/supabase/tenants_schema.sql).
 * RLS scopes every row to poster_id = auth.uid(), so an owner only ever sees
 * their own tenants.
 */

/** { [property_id]: [tenant, ...] } for the given properties, newest first. Excludes removed tenants. */
export async function fetchTenantsFor(propertyIds = []) {
  if (!isSupabaseConfigured || !supabase || !propertyIds.length) return {};
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .in("property_id", propertyIds)
    .neq("status", "removed")
    .order("created_at", { ascending: false });
  if (error) return {};
  const out = {};
  for (const t of data || []) (out[t.property_id] ||= []).push(t);
  return out;
}

/** Add a tenant to a property. Throws with a plain-language message on bad input. */
export async function addTenant(propertyId, patch) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured");
  const row = {
    property_id: propertyId,
    name: String(patch.name || "").trim().slice(0, 120),
    phone: String(patch.phone || "").trim().slice(0, 20),
    email: String(patch.email || "").trim().toLowerCase().slice(0, 160),
    rent_amount: Number(patch.rentAmount) || 0,
    rent_due_day: Math.min(28, Math.max(1, Number(patch.rentDueDay) || 1)),
  };
  if (!row.name) throw new Error("Tenant name is required.");
  if (!row.phone && !row.email) throw new Error("Add a phone number or email so they can be invited.");
  const { data, error } = await supabase.from("tenants").insert(row).select().single();
  if (error) throw error;
  return data;
}

/** Soft-delete — keeps history, just stops it from showing. */
export async function removeTenant(id) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from("tenants")
    .update({ status: "removed", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Record that an invite went out (email sent and/or the owner copied the message themselves). */
export async function markInviteSent(id) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase
    .from("tenants")
    .update({ invited_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
}
