/**
 * CRM data access: clients, their requirement overrides, activity and shortlists.
 *
 * Reads are defensive — a table that hasn't been migrated yet resolves to an
 * empty list rather than throwing, so one missing migration can't blank the
 * whole workspace. Writes are not: if a write fails the caller must know.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

/* ── Vocabulary ───────────────────────────────────────────────────────────── */

/** The funnel. Set by hand from the CRM — never inferred after the backfill. */
export const STATUSES = [
  { id: "fresh",          label: "Fresh lead",        hint: "No contact made yet" },
  { id: "dnp",            label: "DNP",               hint: "Did not pick" },
  { id: "shared",         label: "Flats shared",      hint: "Matches sent, waiting on them" },
  { id: "need_inventory", label: "More inventory",    hint: "Nothing we have fits" },
  { id: "visit_pending",  label: "1 visit + pending", hint: "Booked, more still to book" },
  { id: "closed_by_us",   label: "Closed by us",      hint: "Moved into a MovEazy flat" },
  { id: "closed_outside", label: "Closed outside",    hint: "Found a home elsewhere" },
];

export const STATUS_IDS = STATUSES.map((s) => s.id);
export const CLOSED_STATUSES = ["closed_by_us", "closed_outside"];
export const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label ?? id ?? "—";

/** The human read on a client. Never computed — blank until someone decides. */
/** Reads as one thermometer, warm to cool. Darkened for a white ground. */
export const TEMPERATURES = [
  { id: "fire", label: "Fire", color: "#CC3F28", hint: "Closing this week" },
  { id: "hot",  label: "Hot",  color: "#B0740F", hint: "Engaged, date still soft" },
  { id: "cold", label: "Cold", color: "#2E7F99", hint: "Real requirement, no urgency" },
  { id: "ice",  label: "Ice",  color: "#8FA5A0", hint: "Dormant or unreachable" },
];
export const tempColor = (id) => TEMPERATURES.find((t) => t.id === id)?.color ?? "#3C5A54";
export const tempLabel = (id) => TEMPERATURES.find((t) => t.id === id)?.label ?? "Unset";

export const SORTS = [
  { id: "move_in",   label: "Earliest move-in" },
  { id: "time",      label: "Most time on site" },
  { id: "opens",     label: "Most opens" },
  { id: "last_seen", label: "Last seen" },
  { id: "untouched", label: "Oldest untouched" },
];

/* ── Reads ────────────────────────────────────────────────────────────────── */

async function safeSelect(table, columns, shape = (q) => q) {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await shape(supabase.from(table).select(columns));
    if (error) {
      console.warn(`[crm] ${table}: ${error.message}`);
      return [];
    }
    return data ?? [];
  } catch (e) {
    console.warn(`[crm] ${table} threw: ${e?.message}`);
    return [];
  }
}

export const fetchClients = () =>
  safeSelect(
    "crm_clients",
    "id,user_id,name,phone,email,source,status,temperature,note,note_by,note_at,dnp_count," +
      "assigned_to,next_follow_up_at,tags,closed_property_id,closed_rent,closed_reason,closed_at," +
      "brokerage_amount,expected_credit_date,payment_status,payment_marked_by,payment_marked_at," +
      "payment_approved_by,payment_approved_at,created_at,updated_at",
    (q) => q.order("updated_at", { ascending: false }).limit(4000),
  );

export const fetchClientRequirements = () =>
  safeSelect(
    "crm_client_requirements",
    "client_id,localities,budget_min,budget_max,flat_types,furnishing,must_haves,deal_breakers,occupants,move_in,min_score,updated_by,updated_at",
  );

export const fetchEngagement = () =>
  safeSelect("user_engagement", "user_id,session_count,total_seconds,longest_seconds,last_seen_at");

export const fetchShortlists = () =>
  safeSelect(
    "crm_shortlists",
    "id,client_id,property_id,status,score_at_share,shared_by,shared_at,created_at,"
      + "share_token,opened_at,last_opened_at,open_count",
    (q) => q.order("created_at", { ascending: false }).limit(6000),
  );

export const fetchActivities = (clientId) =>
  safeSelect("crm_activities", "id,client_id,actor_email,type,body,meta,created_at", (q) =>
    q.eq("client_id", clientId).order("created_at", { ascending: false }).limit(200),
  );

/** Latest activity per client — powers the "oldest untouched" sort. */
export const fetchLastTouch = () =>
  safeSelect("crm_activities", "client_id,created_at", (q) =>
    q.order("created_at", { ascending: false }).limit(8000),
  );

/* ── Writes ───────────────────────────────────────────────────────────────── */

function requireDb() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
}

export async function logActivity(clientId, { type = "note", body = "", meta = {}, actorEmail = "" }) {
  requireDb();
  const { error } = await supabase.from("crm_activities").insert({
    client_id: clientId,
    actor_email: actorEmail,
    type,
    body: String(body || "").slice(0, 4000),
    meta,
  });
  if (error) throw error;
}

async function patchClient(clientId, patch) {
  requireDb();
  const { data, error } = await supabase
    .from("crm_clients")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", clientId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Move a client through the funnel.
 *
 * Two side effects that would otherwise be forgotten every time:
 *  - DNP increments its own counter, so "DNP ×3" is real rather than a note.
 *  - Either closed status stamps closed_at and mirrors the outcome onto
 *    user_profiles, so the public site stops nudging someone who has moved.
 */
export async function setClientStatus(
  client,
  status,
  { actorEmail = "", reason = "", propertyId = "", rent = null, brokerage = null, creditDate = "" } = {},
) {
  const patch = { status };
  if (status === "dnp") patch.dnp_count = (client.dnp_count ?? 0) + 1;
  if (CLOSED_STATUSES.includes(status)) {
    patch.closed_at = new Date().toISOString();
    patch.closed_reason = reason || "";
    if (propertyId) patch.closed_property_id = propertyId;
    if (rent != null) patch.closed_rent = rent;
  }
  if (status === "closed_by_us") {
    // Landing here starts the money clock, so the deal shows up on the payments
    // list straight away rather than only once someone remembers to add it.
    patch.brokerage_amount = brokerage;
    patch.expected_credit_date = creditDate || null;
    if (client.payment_status !== "approved") patch.payment_status = "awaited";
  }

  const updated = await patchClient(client.id, patch);

  if (client.user_id) {
    const searchStatus = CLOSED_STATUSES.includes(status) ? status : "searching";
    const { error } = await supabase
      .from("user_profiles")
      .update({
        search_status: searchStatus,
        search_closed_at: CLOSED_STATUSES.includes(status) ? new Date().toISOString() : null,
        search_closed_reason: CLOSED_STATUSES.includes(status) ? reason || "" : "",
      })
      .eq("id", client.user_id);
    // A profile that refuses the write must not lose the CRM change — surface it
    // in the console and carry on; the CRM row is the one that matters here.
    if (error) console.warn(`[crm] profile search_status: ${error.message}`);
  }

  await logActivity(client.id, {
    type: "status",
    body: `${statusLabel(client.status)} → ${statusLabel(status)}${reason ? ` · ${reason}` : ""}`,
    actorEmail,
  });
  return updated;
}

export async function setClientTemperature(client, temperature, { actorEmail = "" } = {}) {
  const updated = await patchClient(client.id, { temperature: temperature || null });
  await logActivity(client.id, {
    type: "temperature",
    body: `${tempLabel(client.temperature)} → ${tempLabel(temperature)}`,
    actorEmail,
  });
  return updated;
}

/** The pinned brief. Rewritten in place; every version lands in the timeline. */
export async function setClientNote(client, note, { actorEmail = "" } = {}) {
  const trimmed = String(note || "").slice(0, 4000);
  const updated = await patchClient(client.id, {
    note: trimmed,
    note_by: actorEmail,
    note_at: new Date().toISOString(),
  });
  await logActivity(client.id, { type: "note", body: trimmed, actorEmail });
  return updated;
}

export async function setClientFields(clientId, patch) {
  return patchClient(clientId, patch);
}

export async function createClient(fields, { actorEmail = "" } = {}) {
  requireDb();
  const { data, error } = await supabase
    .from("crm_clients")
    .insert({
      name: String(fields.name || "").trim(),
      phone: String(fields.phone || "").trim(),
      email: String(fields.email || "").trim().toLowerCase(),
      source: fields.source || "manual",
      status: fields.status || "fresh",
      assigned_to: fields.assigned_to || actorEmail,
    })
    .select()
    .single();
  if (error) throw error;
  await logActivity(data.id, { type: "system", body: "Client added to the CRM", actorEmail });
  return data;
}

export async function deleteClient(clientId) {
  requireDb();
  const { error } = await supabase.from("crm_clients").delete().eq("id", clientId);
  if (error) throw error;
}

/* ── Requirement override ─────────────────────────────────────────────────── */

/**
 * Save the CRM's view of what a client wants. Deliberately a separate row from
 * public.user_requirements: the client's own answers are never overwritten, so
 * "she says ₹48k but will go to ₹52k" can be true here without lying in her app.
 */
export async function saveClientRequirement(clientId, req, { actorEmail = "" } = {}) {
  requireDb();
  const row = {
    client_id: clientId,
    localities: req.localities ?? [],
    budget_min: req.budget_min ?? null,
    budget_max: req.budget_max ?? null,
    flat_types: req.flat_types ?? [],
    furnishing: req.furnishing ?? "",
    must_haves: req.must_haves ?? [],
    deal_breakers: req.deal_breakers ?? [],
    occupants: req.occupants ?? [],
    move_in: req.move_in ?? "",
    min_score: req.min_score ?? 60,
    updated_by: actorEmail,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("crm_client_requirements")
    .upsert(row, { onConflict: "client_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Put the override back to whatever the client themselves last told us. */
export async function resetClientRequirement(clientId, userId, { actorEmail = "" } = {}) {
  requireDb();
  let source = {};
  if (userId) {
    const { data } = await supabase
      .from("user_requirements")
      .select("localities,budget_min,budget_max,flat_types,must_haves,deal_breakers,occupants")
      .eq("user_id", userId)
      .maybeSingle();
    source = data ?? {};
  }
  return saveClientRequirement(
    clientId,
    {
      localities: source.localities ?? [],
      budget_min: source.budget_min ?? null,
      budget_max: source.budget_max ?? null,
      flat_types: source.flat_types ?? [],
      must_haves: source.must_haves ?? [],
      deal_breakers: source.deal_breakers ?? [],
      occupants: source.occupants ?? [],
      furnishing: "",
      move_in: "",
      min_score: 60,
    },
    { actorEmail },
  );
}

/* ── Shortlists ───────────────────────────────────────────────────────────── */

export async function upsertShortlist(clientId, propertyId, patch = {}) {
  requireDb();
  const { data, error } = await supabase
    .from("crm_shortlists")
    .upsert({ client_id: clientId, property_id: propertyId, ...patch }, { onConflict: "client_id,property_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeShortlist(clientId, propertyId) {
  requireDb();
  const { error } = await supabase
    .from("crm_shortlists")
    .delete()
    .eq("client_id", clientId)
    .eq("property_id", propertyId);
  if (error) throw error;
}

/**
 * Record what a client replied on WhatsApp.
 *
 * Written to public.listing_reactions as well as the shortlist, so a reply an
 * agent typed in teaches the same recommendation engine as a tap in the client's
 * own app. Requires the client to have signed up — an offline lead has no
 * auth user to attach a reaction to, so that half is skipped.
 */
export async function recordClientReaction(client, propertyId, reaction, { actorEmail = "" } = {}) {
  requireDb();
  await upsertShortlist(client.id, propertyId, { status: reaction === "like" ? "liked" : reaction === "dislike" ? "disliked" : "okay" });

  if (client.user_id) {
    const { error } = await supabase.from("listing_reactions").upsert(
      {
        user_id: client.user_id,
        property_id: propertyId,
        reaction,
        recorded_by: actorEmail,
        source: "crm",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,property_id" },
    );
    if (error) console.warn(`[crm] listing_reactions: ${error.message}`);
  }

  await logActivity(client.id, {
    type: "shortlist",
    body: `Replied ${reaction} on ${propertyId}`,
    meta: { property_id: propertyId, reaction },
    actorEmail,
  });
}
