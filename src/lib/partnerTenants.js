/**
 * Tenant and flat management for every partner (MovEazy-BE/supabase/
 * partner_tenant_care.sql): one board of their own clients and MovEazy's,
 * stages that move by themselves, move-in dates, reminders, notes, a timeline,
 * and per-flat interest. Pure helpers here; screens in pages/partners.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

/** { p_lead, p_assignment } for a board row (or anything with lead_id / assignment_id). */
const ids = (t) => ({ p_lead: t.lead_id || null, p_assignment: t.lead_id ? null : t.assignment_id || null });

export const fetchBoard = () => rpc("partner_tenants_board").then((r) => r ?? []);
export const updateTenant = (t, patch) => rpc("partner_tenant_update", { ...ids(t), p_patch: patch });
export const markTenantSeen = (t) => rpc("partner_tenant_seen", ids(t)).catch(() => {});
export const addReminder = (t, due, note = "") => rpc("partner_reminder_add", { ...ids(t), p_due: new Date(due).toISOString(), p_note: note });
export const reminderDone = (id) => rpc("partner_reminder_done", { p_id: id });
export const snoozeReminder = (id, due) => rpc("partner_reminder_snooze", { p_id: id, p_due: new Date(due).toISOString() });
export const fetchOpenReminders = () => rpc("partner_reminders_open").then((r) => r ?? []);
/** Due reminders into the bell; called with the notification check. */
export const fireReminders = () => rpc("partner_reminders_fire").catch(() => 0);
export const addNote = (t, body) => rpc("partner_tenant_note_add", { ...ids(t), p_body: body });
export const fetchTimeline = (t) => rpc("partner_tenant_timeline", ids(t)).then((r) => r ?? []);
export const fetchFlatInterest = (propertyId) => rpc("partner_flat_interest", { p_property: propertyId });
export const freeLeadsTopup = () => rpc("partner_free_leads_topup").catch(() => 0);

/* ── Stages ─────────────────────────────────────────────────────────────── */

export const STAGES = [
  { id: "new", label: "New", hint: "Not contacted yet" },
  { id: "contacted", label: "Contacted", hint: "WhatsApped or called" },
  { id: "list_sent", label: "List sent", hint: "Flats sent, no like yet" },
  { id: "liked", label: "Liked flats", hint: "Liked at least one flat" },
  { id: "visit", label: "Visit fixed", hint: "A visit is fixed" },
  { id: "done", label: "Deal done", hint: "Moved in" },
  { id: "lost", label: "Lost", hint: "Not going ahead" },
];
export const STAGE = Object.fromEntries(STAGES.map((s) => [s.id, s]));
export const OPEN_STAGES = new Set(["new", "contacted", "list_sent", "liked", "visit"]);

/** How many tenants sit at each stage, plus "open" (everyone still in play) and "all". */
export function stageCounts(board = []) {
  const c = Object.fromEntries([...STAGES.map((s) => [s.id, 0]), ["open", 0], ["all", board.length]]);
  for (const t of board) { c[t.stage] = (c[t.stage] || 0) + 1; if (OPEN_STAGES.has(t.stage)) c.open += 1; }
  return c;
}

/* ── Reminders ──────────────────────────────────────────────────────────── */

/** IST wall-clock → a Date. `days` from today, at `hh:mm`. */
function istAt(now, days, hh, mm = 0) {
  const ist = new Date(now.getTime() + 5.5 * 3600e3);
  const y = ist.getUTCFullYear(); const mo = ist.getUTCMonth(); const d = ist.getUTCDate() + days;
  return new Date(Date.UTC(y, mo, d, hh, mm) - 5.5 * 3600e3);
}

/** The quick picks for "Remind me", from `now`. "Later today" is 3 hours on, or 7 pm if that's sooner. */
export function reminderPresets(now = new Date()) {
  const in3h = new Date(now.getTime() + 3 * 3600e3);
  const sevenPm = istAt(now, 0, 19);
  const later = sevenPm > now && sevenPm < in3h ? sevenPm : in3h;
  return [
    { id: "later", label: "Later today", at: later },
    { id: "tomorrow", label: "Tomorrow 10 am", at: istAt(now, 1, 10) },
    { id: "3d", label: "In 3 days", at: istAt(now, 3, 10) },
    { id: "week", label: "Next week", at: istAt(now, 7, 10) },
  ];
}

/** "Tue 14 Oct, 5:00 pm" (IST); "Today, 5:00 pm" / "Tomorrow, …" when close. */
export function whenLabel(at, now = new Date()) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const day = (x) => new Date(x.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const time = d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });
  const diff = Math.round((Date.parse(day(d)) - Date.parse(day(now))) / 864e5);
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Tomorrow, ${time}`;
  if (diff === -1) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" })}, ${time}`;
}

/** Reminders due by the end of today (IST), overdue first. */
export function dueToday(reminders = [], now = new Date()) {
  const end = istAt(now, 1, 0);
  return reminders.filter((r) => new Date(r.due_at) < end).sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)));
}

/* ── Home ───────────────────────────────────────────────────────────────── */

/** Tenants who did something since the partner last looked, newest first. */
export const newActions = (board = []) =>
  board.filter((t) => t.new_actions > 0 && OPEN_STAGES.has(t.stage))
    .sort((a, b) => String(b.last_action_at).localeCompare(String(a.last_action_at)));

/** Still-open tenants moving in within `days` (or overdue by up to a week), soonest first. */
export function movingSoon(board = [], days = 15, now = new Date()) {
  const today = new Date(now.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const t0 = Date.parse(today);
  return board
    .filter((t) => t.move_in && OPEN_STAGES.has(t.stage))
    .map((t) => ({ ...t, in_days: Math.round((Date.parse(t.move_in) - t0) / 864e5) }))
    .filter((t) => t.in_days <= days && t.in_days >= -7)
    .sort((a, b) => a.in_days - b.in_days);
}

export const inDaysLabel = (n) => (n === 0 ? "today" : n === 1 ? "tomorrow" : n < 0 ? `${-n} day${n === -1 ? "" : "s"} ago` : `in ${n} days`);

/* ── Flats ──────────────────────────────────────────────────────────────── */

/** What makes a flat easy to match and to say yes to. */
export const FLAT_DETAILS = [
  ["photos", "3+ photos", (l) => [l.cover_image_url, ...(l.images ?? [])].filter(Boolean).length >= 3],
  ["rent", "Rent", (l) => Number(l.rent) > 0],
  ["bhk", "BHK", (l) => Boolean(l.flat_type || l.bedrooms)],
  ["area", "Area", (l) => Boolean(l.area)],
  ["furnishing", "Furnishing", (l) => Boolean(l.furnishing)],
  ["available", "Available from", (l) => Boolean(l.available_from)],
  ["deposit", "Deposit", (l) => Number(l.deposit) > 0],
  ["description", "Description", (l) => String(l.description || "").trim().length >= 40],
  ["amenities", "Amenities", (l) => (l.amenities ?? []).length > 0],
];

/** → { done, total, missing: [labels] } */
export function flatDetailScore(listing) {
  if (!listing) return { done: 0, total: FLAT_DETAILS.length, missing: [] };
  const missing = FLAT_DETAILS.filter(([, , ok]) => !ok(listing)).map(([, label]) => label);
  return { done: FLAT_DETAILS.length - missing.length, total: FLAT_DETAILS.length, missing };
}

/** The partner's own flats by state. */
export function myFlats(inventory = []) {
  const mine = inventory.filter((l) => l.source === "mine");
  return {
    live: mine.filter((l) => l.status === "published"),
    paused: mine.filter((l) => l.status !== "published" && l.status !== "rented"),
    letOut: mine.filter((l) => l.status === "rented"),
  };
}

/** A board row as the matcher's tenant shape. */
export const asMatcherKey = (t) => (t.lead_id ? `lead:${t.lead_id}` : `asg:${t.assignment_id}`);
