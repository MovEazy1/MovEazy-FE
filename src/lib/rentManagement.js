import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * Simple manual rent tracker — the owner marks each rented property's month
 * as paid or due themselves. No payment processing involved; this is
 * record-keeping only. Backed by public.rent_payments (see
 * MovEazy-BE/supabase/rent_payments_schema.sql), RLS-scoped to poster_id.
 */

/** All rent records for a set of properties, most recent period first. */
export async function fetchRentPayments(propertyIds = []) {
  if (!isSupabaseConfigured || !supabase || !propertyIds.length) return [];
  const { data, error } = await supabase
    .from("rent_payments")
    .select("*")
    .in("property_id", propertyIds)
    .order("period", { ascending: false });
  if (error) return [];
  return data || [];
}

/** Create or update one property's record for one month ('YYYY-MM-01'). */
export async function upsertRentPayment(posterId, propertyId, period, patch = {}) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured");
  const row = {
    poster_id: posterId,
    property_id: propertyId,
    period,
    updated_at: new Date().toISOString(),
    ...patch,
  };
  const { data, error } = await supabase
    .from("rent_payments")
    .upsert(row, { onConflict: "property_id,period" })
    .select()
    .single();
  if (error) throw error;
  return data;
}
