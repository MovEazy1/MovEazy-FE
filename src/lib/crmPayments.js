/**
 * Brokerage and payment on deals we closed.
 *
 * The two state changes go through Postgres functions rather than plain updates,
 * because the rule — anyone may mark received, only the super admin may approve,
 * and approval is terminal — depends on the value a row is moving *from*, which
 * an RLS policy cannot see. Calling the RPC is therefore the only way to move
 * either step, from the UI or from anywhere else.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

export const PAYMENT_STATES = [
  { id: "awaited", label: "Awaiting payment", hint: "Closed, money not in yet" },
  { id: "received", label: "Payment received", hint: "Marked by the team, waiting on approval" },
  { id: "approved", label: "Approved", hint: "Confirmed by the super admin — final" },
];

export const paymentLabel = (id) =>
  PAYMENT_STATES.find((p) => p.id === id)?.label ?? (id === "none" ? "—" : id);

function requireDb() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
}

/** Brokerage figures live on the client row; editing them is a normal update. */
export async function saveBrokerage(clientId, { brokerage_amount, expected_credit_date }) {
  requireDb();
  const { data, error } = await supabase
    .from("crm_clients")
    .update({
      brokerage_amount: brokerage_amount ?? null,
      expected_credit_date: expected_credit_date || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markPaymentReceived(clientId, note = "") {
  requireDb();
  const { error } = await supabase.rpc("mark_payment_received", {
    p_client_id: clientId,
    p_note: note,
  });
  if (error) throw error;
}

export async function approvePayment(clientId) {
  requireDb();
  const { error } = await supabase.rpc("approve_payment", { p_client_id: clientId });
  if (error) throw error;
}

export async function fetchNotifications({ unreadOnly = false, type = null } = {}) {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    let q = supabase
      .from("crm_notifications")
      .select("id,for_email,type,title,body,client_id,actor_email,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (unreadOnly) q = q.is("read_at", null);
    // Payments and visit alerts share this table but belong on different
    // screens; a visit that needs a time is not a payments item.
    if (type) q = q.eq("type", type);
    const { data, error } = await q;
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function markNotificationRead(id) {
  requireDb();
  const { error } = await supabase
    .from("crm_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Totals for the payments screen header. */
export function summarisePayments(rows) {
  const sum = (list) => list.reduce((t, c) => t + (Number(c.brokerage_amount) || 0), 0);
  const awaited = rows.filter((c) => c.payment_status === "awaited");
  const received = rows.filter((c) => c.payment_status === "received");
  const approved = rows.filter((c) => c.payment_status === "approved");
  return {
    awaited, received, approved,
    awaitedTotal: sum(awaited),
    receivedTotal: sum(received),
    approvedTotal: sum(approved),
    // Anything past its expected credit date and still not in.
    overdue: awaited.filter(
      (c) => c.expected_credit_date && new Date(c.expected_credit_date) < new Date(),
    ),
  };
}
