import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * Admin database browser data layer.
 *
 * Primary path: the public.admin_list_tables() RPC (see
 * MovEazy-BE/supabase/admin_dashboard.sql) enumerates every table in the public
 * schema with a live row count. If that function hasn't been created yet, we
 * fall back to KNOWN_TABLES — the static registry of every table defined across
 * the schema files in MovEazy-BE/supabase/*.sql — and count each one directly.
 */

/** Every table defined in the backend schema files, grouped by area. */
export const KNOWN_TABLES = [
  // customer_schema.sql
  { name: "user_profiles", group: "Customer", desc: "One row per signed-in user: identity, role, seller badge." },
  { name: "customer_search_profiles", group: "Customer", desc: "A seeker's saved flat-search requirements (legacy)." },
  { name: "user_requirements", group: "Customer", desc: "Per-user Find My Flat questionnaire — everything about the user, mapped to user_id." },
  { name: "visit_requests", group: "Customer", desc: "Tour / visit requests from the listing modal." },
  { name: "saved_properties", group: "Customer", desc: "Bookmarked listings per customer." },
  { name: "listing_private", group: "Customer", desc: "Private broker/owner phone numbers per listing." },
  { name: "site_public_settings", group: "Customer", desc: "Public marketing settings (contact team, support email)." },
  // inventory_schema.sql
  { name: "inventory", group: "Inventory", desc: "Listed homes — the supply side, matched to requirements." },
  // broker_schema.sql
  { name: "hunters", group: "Broker CRM", desc: "Broker's leads / hunters." },
  { name: "properties", group: "Broker CRM", desc: "Broker-managed properties." },
  { name: "follow_ups", group: "Broker CRM", desc: "Scheduled follow-ups with hunters." },
  { name: "tasks", group: "Broker CRM", desc: "Broker to-do tasks." },
  { name: "visit_schedules", group: "Broker CRM", desc: "Scheduled property visits." },
  { name: "property_matches", group: "Broker CRM", desc: "Hunter ↔ property matches with scores." },
  { name: "broker_whatsapp_contacts", group: "Broker CRM", desc: "WhatsApp enquiry contacts captured on listings." },
  // admin_schema.sql
  { name: "admin_allowlist", group: "Admin", desc: "Emails granted admin access." },
  // chatbot_schema.sql
  { name: "chatbot_sessions", group: "Chatbot", desc: "AI flat-search chat sessions." },
  { name: "chatbot_messages", group: "Chatbot", desc: "Messages within chatbot sessions." },
];

const GROUP_FOR = Object.fromEntries(KNOWN_TABLES.map((t) => [t.name, t.group]));
const DESC_FOR = Object.fromEntries(KNOWN_TABLES.map((t) => [t.name, t.desc]));

export function groupForTable(name) {
  return GROUP_FOR[name] || "Other";
}
export function descForTable(name) {
  return DESC_FOR[name] || "";
}

/**
 * List every public table with a row count. Tries the RPC first (dynamic — picks
 * up tables the registry doesn't know about); on failure, counts the static
 * registry directly. Each entry: { name, count, group, desc, source }.
 */
export async function listTables() {
  if (!isSupabaseConfigured || !supabase) {
    return { tables: [], error: "Supabase is not configured." };
  }

  // Preferred: dynamic discovery via the admin RPC.
  try {
    const { data, error } = await supabase.rpc("admin_list_tables");
    if (!error && Array.isArray(data) && data.length) {
      const tables = data
        .map((r) => ({
          name: r.table_name,
          count: Number(r.row_count) || 0,
          group: groupForTable(r.table_name),
          desc: descForTable(r.table_name),
          source: "rpc",
        }))
        .sort(sortByGroupThenName);
      return { tables, source: "rpc" };
    }
  } catch { /* fall through to registry */ }

  // Fallback: count each known table with a HEAD request.
  const results = await Promise.all(
    KNOWN_TABLES.map(async (t) => {
      try {
        const { count, error } = await supabase
          .from(t.name)
          .select("*", { count: "exact", head: true });
        return { ...t, count: error ? null : count ?? 0, source: "registry", missing: !!error };
      } catch {
        return { ...t, count: null, source: "registry", missing: true };
      }
    })
  );
  return { tables: results.sort(sortByGroupThenName), source: "registry" };
}

function sortByGroupThenName(a, b) {
  return a.group === b.group ? a.name.localeCompare(b.name) : a.group.localeCompare(b.group);
}

/** Fetch a page of rows for one table, newest first when a created_at exists. */
export async function fetchTableRows(name, { limit = 50 } = {}) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  // Try ordering by created_at; if the column doesn't exist, retry unordered.
  let res = await supabase.from(name).select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(limit);
  if (res.error && /created_at/.test(res.error.message || "")) {
    res = await supabase.from(name).select("*", { count: "exact" }).limit(limit);
  }
  if (res.error) throw res.error;
  const rows = res.data || [];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return { rows, columns, total: res.count ?? rows.length };
}
