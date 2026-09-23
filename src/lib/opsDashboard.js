/**
 * The data layer behind /dashboard.
 *
 * One security-definer RPC returns all six series in one round trip, because
 * the whole point of the page is reading them against each other — six separate
 * queries would let one fail and leave the rest looking like the full picture.
 *
 * Nothing here enforces access. public.can_view_ops_dashboard() in
 * MovEazy-BE/supabase/ops_dashboard.sql does, and ops_daily_metrics() returns an
 * empty set to anyone it refuses. The check in this file exists so the page can
 * say "you don't have access" instead of showing a wall of zeroes.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { isMissingMigration } from "./marketing";

export { isMissingMigration };

/** The business runs on IST; a day boundary anywhere else would mis-file evening visits. */
const TZ = "Asia/Kolkata";

/**
 * The six series, in the order they are read top to bottom.
 *
 * `kind` separates the two ways a number can be true of a day. A "flow" counts
 * things that happened on that day and is meaningful to add up over a range; a
 * "level" is a snapshot at the end of that day, so summing it is nonsense and
 * the page shows the latest value instead.
 */
export const METRICS = [
  {
    key: "new_leads",
    label: "New leads",
    kind: "flow",
    hint: "Client records created that day.",
  },
  {
    key: "active_leads",
    label: "Active leads",
    kind: "level",
    hint: "Leads open at the end of that day — created by then, not yet closed either way.",
  },
  {
    key: "new_properties",
    label: "New properties",
    kind: "flow",
    hint: "Flats added to inventory that day, whoever listed them.",
  },
  {
    key: "active_properties",
    label: "Active properties",
    kind: "level",
    hint: "Flats live at the end of that day. Paused and rented are not counted.",
  },
  {
    key: "visits",
    label: "Visits",
    kind: "flow",
    hint: "Visits scheduled to happen that day, dated by the slot rather than by when it was booked.",
  },
  {
    key: "closures",
    label: "Our closures",
    kind: "flow",
    hint: "Clients who moved into a MovEazy flat — closed by us, not closed elsewhere.",
  },
];

/** Timeframe presets. `days` includes today, so 7 is today plus the six before it. */
export const RANGES = [
  { id: "7", label: "7 days", days: 7 },
  { id: "14", label: "14 days", days: 14 },
  { id: "30", label: "30 days", days: 30 },
  { id: "90", label: "90 days", days: 90 },
  { id: "custom", label: "Custom", days: null },
];

/* ── Dates ────────────────────────────────────────────────────────────────── */

/** Today in IST as YYYY-MM-DD, regardless of where the browser thinks it is. */
export function istToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso, toIso) {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** The [from, to] a preset resolves to, both inclusive. */
export function rangeFor(days, today = istToday()) {
  return { from: addDays(today, -(days - 1)), to: today };
}

export function fmtDay(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso || "—";
  return d.toLocaleDateString("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/* ── Reading the numbers ──────────────────────────────────────────────────── */

function unconfigured() {
  return new Error("Supabase is not configured — add VITE_SUPABASE_URL and the anon key.");
}

/**
 * Whether the signed-in account may open this page at all.
 *
 * A missing function means the migration hasn't been run; that is not the same
 * as "no access", so it is thrown rather than answered false — the page tells
 * the operator which SQL file to run instead of telling them they're locked out.
 */
export async function canViewOpsDashboard() {
  if (!isSupabaseConfigured || !supabase) throw unconfigured();
  const { data, error } = await supabase.rpc("can_view_ops_dashboard");
  if (error) throw error;
  return data === true;
}

/**
 * One row per calendar day between `from` and `to`, newest first, every metric
 * on each row. Days with nothing in them come back as zeroes rather than being
 * skipped — a gap in a day-on-day table reads as missing data, not as a quiet day.
 */
export async function fetchOpsDaily({ from, to }) {
  if (!isSupabaseConfigured || !supabase) throw unconfigured();
  const { data, error } = await supabase.rpc("ops_daily_metrics", { p_from: from, p_to: to });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    day: r.day,
    ...Object.fromEntries(METRICS.map((m) => [m.key, Number(r[m.key]) || 0])),
  }));
}

/* ── Reading one series out of those rows ─────────────────────────────────── */

/**
 * Headline, movement and shape for one metric.
 *
 * `headline` is a total for a flow and the most recent value for a level, which
 * is the only reading of each that means anything. `change` compares the range
 * against the equally long stretch before it, and is null when the caller hasn't
 * loaded that stretch — an unqualified "+40%" against nothing is worse than no
 * number at all.
 */
export function summarize(metric, rows, previousRows = null) {
  const values = rows.map((r) => r[metric.key] ?? 0);
  const total = values.reduce((n, v) => n + v, 0);
  // rows arrive newest first, so the latest level is the first one.
  const latest = values.length ? values[0] : 0;
  const headline = metric.kind === "level" ? latest : total;

  const peak = values.length ? Math.max(...values) : 0;
  const average = values.length ? total / values.length : 0;

  let change = null;
  if (previousRows?.length) {
    const prev = previousRows.map((r) => r[metric.key] ?? 0);
    const prevHeadline =
      metric.kind === "level"
        ? prev[0] ?? 0
        : prev.reduce((n, v) => n + v, 0);
    if (prevHeadline > 0) change = ((headline - prevHeadline) / prevHeadline) * 100;
    else if (headline > 0) change = null; // growth from zero is a ratio nobody can read
  }

  return { headline, latest, total, peak, average, change };
}

/** Day-on-day movement for one row, against the day below it in the table. */
export function dayDeltas(metric, rows) {
  return rows.map((row, i) => {
    const next = rows[i + 1];
    const value = row[metric.key] ?? 0;
    const delta = next ? value - (next[metric.key] ?? 0) : null;
    return { day: row.day, value, delta };
  });
}

/* ── Export ───────────────────────────────────────────────────────────────── */

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function toCsv(rows) {
  const header = ["Date", ...METRICS.map((m) => m.label)];
  const body = rows.map((r) => [r.day, ...METRICS.map((m) => r[m.key] ?? 0)]);
  return [header, ...body].map((r) => r.map(csvCell).join(",")).join("\n");
}

export function downloadCsv(rows, from, to) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `moveazy-dashboard-${from}-to-${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Who may open it ──────────────────────────────────────────────────────── */

/**
 * The full roster. Postgres only returns other people's rows to the super
 * admin — everyone else sees their own grant and nothing more, so this is safe
 * to call from anywhere even though only the super-admin panel does.
 */
export async function fetchDashboardGrants() {
  if (!isSupabaseConfigured || !supabase) throw unconfigured();
  const { data, error } = await supabase
    .from("dashboard_access")
    .select("id, email, notes, granted_by, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function normalizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

export async function grantDashboardAccess(email, { notes = "", grantedBy = "" } = {}) {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes("@")) throw new Error("Enter a valid email address.");
  if (!isSupabaseConfigured || !supabase) throw unconfigured();

  const { data, error } = await supabase
    .from("dashboard_access")
    .insert({
      email: normalized,
      notes: String(notes || "").trim().slice(0, 240),
      granted_by: normalizeEmail(grantedBy),
    })
    .select("id, email, notes, granted_by, created_at")
    .single();
  if (error) {
    if (String(error.message || "").toLowerCase().includes("duplicate")) {
      throw new Error(`${normalized} already has the dashboard.`);
    }
    throw error;
  }
  return data;
}

export async function revokeDashboardAccess(id) {
  if (!id) throw new Error("Missing grant id.");
  if (!isSupabaseConfigured || !supabase) throw unconfigured();
  const { error } = await supabase.from("dashboard_access").delete().eq("id", id);
  if (error) throw error;
}
