/**
 * What clients did, as a list of people to ring back.
 *
 * The CRM knew all of this already — crm_activities has carried it since the
 * triggers were written — but nothing surfaced it. An agent found out a client
 * had asked for a visit by opening that client's record, which means finding
 * out only about clients they already had a reason to open.
 *
 * Client actions are the ones with no actor_email. Every trigger writes '' and
 * every staff note carries the staffer's address, so that one field separates
 * "the client did something" from "we did something", without a type list to
 * keep in step with the triggers.
 *
 * One task per person, not per event. An agent rings a person; a client who
 * opened a shortlist and asked for a visit twenty minutes later is one call,
 * with the most recent thing at the top.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

/** How far back the queue looks. A day's work, plus the evening before it. */
export const TASK_WINDOW_HOURS = 48;

/** Offered next to the hours box — the follow-up gaps people actually use. */
export const SNOOZE_PRESETS = [1, 3, 6, 24];

export async function fetchClientActions({ hours = TASK_WINDOW_HOURS, limit = 500 } = {}) {
  if (!isSupabaseConfigured || !supabase) return [];
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  try {
    const { data, error } = await supabase
      .from("crm_activities")
      .select("id,client_id,actor_email,type,body,meta,created_at")
      .gte("created_at", since)
      // The client's own doing, not ours.
      .or("actor_email.is.null,actor_email.eq.")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function fetchSnoozes() {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from("crm_task_snoozes")
      .select("client_id,snoozed_at,remind_at,actor_email");
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

/** Park a follow-up. Snoozing again moves the time rather than stacking. */
export async function snoozeTask(clientId, hours, actorEmail = "") {
  const h = Number(hours);
  if (!clientId || !Number.isFinite(h) || h <= 0) return false;
  if (!isSupabaseConfigured || !supabase) return false;
  const now = new Date();
  try {
    const { error } = await supabase.from("crm_task_snoozes").upsert(
      {
        client_id: clientId,
        snoozed_at: now.toISOString(),
        remind_at: new Date(now.getTime() + h * 3600 * 1000).toISOString(),
        actor_email: actorEmail,
      },
      { onConflict: "client_id" },
    );
    return !error;
  } catch {
    return false;
  }
}

/** Bring a parked follow-up straight back. */
export async function clearSnooze(clientId) {
  if (!clientId || !isSupabaseConfigured || !supabase) return false;
  try {
    const { error } = await supabase.from("crm_task_snoozes").delete().eq("client_id", clientId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Is this client's follow-up parked right now?
 *
 * Two ways back onto the list, and the second is the point of the feature: the
 * clock runs out, or they do something new. Without the second, a client who
 * replied a minute after being snoozed would stay hidden all day — which is
 * the opposite of a follow-up queue.
 */
export function isSnoozed(snooze, latestActionAt, now = Date.now()) {
  if (!snooze) return false;
  const remindAt = new Date(snooze.remind_at ?? 0).getTime();
  if (Number.isFinite(remindAt) && now >= remindAt) return false;

  const snoozedAt = new Date(snooze.snoozed_at ?? 0).getTime();
  const actedAt = new Date(latestActionAt ?? 0).getTime();
  if (Number.isFinite(actedAt) && Number.isFinite(snoozedAt) && actedAt > snoozedAt) return false;

  return true;
}

/**
 * One row per client: who they are, what they last did, and everything else
 * they did in the window underneath it.
 */
export function buildDailyTasks(actions = [], clients = [], snoozes = [], now = Date.now()) {
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const snoozeByClient = new Map(snoozes.map((s) => [s.client_id, s]));

  const byClient = new Map();
  for (const a of actions) {
    if (!a.client_id) continue;
    if (!byClient.has(a.client_id)) byClient.set(a.client_id, []);
    byClient.get(a.client_id).push(a);
  }

  const tasks = [];
  for (const [clientId, list] of byClient) {
    const client = clientById.get(clientId);
    // A client row we cannot see is one we cannot ring: no name, no number.
    if (!client) continue;

    // fetchClientActions returns newest first, so the head is the latest.
    const latest = list[0];
    const snooze = snoozeByClient.get(clientId);
    if (isSnoozed(snooze, latest.created_at, now)) continue;

    tasks.push({
      clientId,
      name: client.name || (client.email ? client.email.split("@")[0] : "Client"),
      phone: client.phone || "",
      email: client.email || "",
      status: client.status || "",
      latest,
      actions: list,
      // A client who did four things is more interesting than one who did one.
      count: list.length,
      // Set when the clock ran out rather than when they acted again, so the
      // screen can say which of the two brought them back.
      returned: Boolean(snooze),
    });
  }

  // Most recent first: the queue is read from the top and worked downwards.
  return tasks.sort(
    (a, b) => new Date(b.latest.created_at) - new Date(a.latest.created_at),
  );
}

/** "Opened your shortlist" — the activity body, trimmed for a list row. */
export function describeAction(action) {
  const body = String(action?.body || "").trim();
  if (body) return body.length > 90 ? `${body.slice(0, 89)}…` : body;
  return action?.type ? `Activity: ${action.type}` : "Activity";
}

/** "4 min ago" — a follow-up queue is about recency, not dates. */
export function timeAgo(iso, now = Date.now()) {
  const t = new Date(iso ?? 0).getTime();
  if (!Number.isFinite(t) || t <= 0) return "";
  const mins = Math.max(0, Math.round((now - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** What we open WhatsApp with — their name, and the thing they just did. */
export function followUpMessage({ name, action }) {
  const who = String(name || "").trim().split(/\s+/)[0];
  const did = String(action?.body || "").trim();
  return [
    `Hi${who ? ` ${who}` : ""}, this is MovEazy.`,
    "",
    did ? `Saw that you ${did.charAt(0).toLowerCase()}${did.slice(1)}.` : "Following up on your home search.",
    "Anything you'd like us to line up for you?",
  ].join("\n");
}
