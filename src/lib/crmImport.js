/**
 * Bulk lead import.
 *
 * A spreadsheet is how a backlog of leads actually exists before a CRM does, so
 * the template covers everything the CRM knows — including the closed statuses
 * and brokerage, so historical deals can be entered as history rather than as
 * fresh leads that then need closing one by one.
 *
 * CSV rather than .xlsx: Excel, Numbers and Sheets all open and save it, and it
 * needs no parser dependency. Every column except one is optional.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { STATUS_IDS } from "./crmClients";

/** Column order is the template's contract — the header row is matched by name. */
export const IMPORT_COLUMNS = [
  { key: "name", label: "name", hint: "Required unless phone is given", example: "Ananya Rao" },
  { key: "phone", label: "phone", hint: "10 digits, or with +91", example: "9845012233" },
  { key: "email", label: "email", hint: "", example: "ananya@example.com" },
  { key: "status", label: "status", hint: STATUS_IDS.join(" | "), example: "closed_by_us" },
  { key: "temperature", label: "temperature", hint: "fire | hot | cold | ice | blank", example: "hot" },
  { key: "assigned_to", label: "assigned_to", hint: "Staff email", example: "kuldeep@moveazy.co.in" },
  { key: "note", label: "note", hint: "Free text", example: "Wants a 2nd bathroom, call after 2pm" },
  { key: "localities", label: "localities", hint: "Semicolon separated", example: "HSR;Koramangala" },
  { key: "budget_min", label: "budget_min", hint: "", example: "30000" },
  { key: "budget_max", label: "budget_max", hint: "", example: "50000" },
  { key: "flat_types", label: "flat_types", hint: "Semicolon separated", example: "2 BHK;3 BHK" },
  { key: "move_in", label: "move_in", hint: "Any format, or ASAP", example: "15 Oct 2026" },
  { key: "closed_property_id", label: "closed_property_id", hint: "For closed_by_us", example: "MZ-R9NAQY" },
  { key: "closed_rent", label: "closed_rent", hint: "For closed_by_us", example: "22500" },
  { key: "closed_reason", label: "closed_reason", hint: "For closed_outside", example: "Went with a broker" },
  { key: "brokerage_amount", label: "brokerage_amount", hint: "MovEazy share, for closed_by_us", example: "11250" },
  { key: "expected_credit_date", label: "expected_credit_date", hint: "YYYY-MM-DD", example: "2026-10-30" },
];

const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * The downloadable template: a header row, a row explaining each column, and one
 * filled example. Both guide rows start with "#" so the importer skips them —
 * people fill the sheet in without deleting the instructions.
 */
export function buildTemplateCsv() {
  const header = IMPORT_COLUMNS.map((c) => c.label);
  const hints = IMPORT_COLUMNS.map((c, i) => (i === 0 ? `# ${c.hint}` : c.hint));
  const example = IMPORT_COLUMNS.map((c, i) => (i === 0 ? `# ${c.example}` : c.example));
  return [header, hints, example].map((row) => row.map(csvCell).join(",")).join("\n");
}

/** RFC-4180-ish: handles quoted fields, escaped quotes and newlines inside them. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  const src = String(text || "").replace(/\r\n?/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ",") { row.push(cell); cell = ""; continue; }
    if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

const list = (v) =>
  String(v || "").split(/[;|]/).map((x) => x.trim()).filter(Boolean);

const num = (v) => {
  const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const isoDate = (v) => {
  const s = String(v || "").trim();
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
};

/**
 * Turn a parsed sheet into rows ready to insert, plus the problems found.
 * Nothing is written here — the caller shows this for confirmation first,
 * because a bad import is far more annoying to undo than to prevent.
 */
export function planImport(rows) {
  if (!rows.length) return { clients: [], errors: ["The file is empty."], skipped: 0 };

  const header = rows[0].map((h) => String(h).trim().toLowerCase());
  const known = new Set(IMPORT_COLUMNS.map((c) => c.label));
  const missing = [...known].filter((k) => !header.includes(k) && k === "name");
  if (missing.length) {
    return { clients: [], errors: [`The header row is missing: ${missing.join(", ")}`], skipped: 0 };
  }

  const at = (row, key) => {
    const i = header.indexOf(key);
    return i === -1 ? "" : String(row[i] ?? "").trim();
  };

  const clients = [];
  const errors = [];
  let skipped = 0;

  rows.slice(1).forEach((row, idx) => {
    const lineNo = idx + 2;
    // The template's own guide rows.
    if (String(row[0] ?? "").trim().startsWith("#")) { skipped += 1; return; }

    const name = at(row, "name");
    const phone = at(row, "phone").replace(/[^\d+]/g, "");
    if (!name && !phone) { skipped += 1; return; }

    const status = at(row, "status").toLowerCase().replace(/\s+/g, "_");
    if (status && !STATUS_IDS.includes(status)) {
      errors.push(`Row ${lineNo}: "${status}" is not a status. Use one of: ${STATUS_IDS.join(", ")}`);
      return;
    }
    const temperature = at(row, "temperature").toLowerCase();
    if (temperature && !["fire", "hot", "cold", "ice"].includes(temperature)) {
      errors.push(`Row ${lineNo}: "${temperature}" is not a temperature.`);
      return;
    }

    clients.push({
      _line: lineNo,
      client: {
        name: name || phone,
        phone,
        email: at(row, "email").toLowerCase(),
        status: status || "fresh",
        temperature: temperature || null,
        assigned_to: at(row, "assigned_to").toLowerCase(),
        note: at(row, "note"),
        note_at: at(row, "note") ? new Date().toISOString() : null,
        source: "import",
        closed_property_id: at(row, "closed_property_id").toUpperCase() || null,
        closed_rent: num(at(row, "closed_rent")),
        closed_reason: at(row, "closed_reason"),
        closed_at: ["closed_by_us", "closed_outside"].includes(status) ? new Date().toISOString() : null,
        brokerage_amount: num(at(row, "brokerage_amount")),
        expected_credit_date: isoDate(at(row, "expected_credit_date")),
        // A historical deal enters awaiting payment, not "nothing owed".
        payment_status: status === "closed_by_us" ? "awaited" : "none",
      },
      requirement: {
        localities: list(at(row, "localities")),
        budget_min: num(at(row, "budget_min")),
        budget_max: num(at(row, "budget_max")),
        flat_types: list(at(row, "flat_types")),
        move_in: at(row, "move_in"),
        min_score: 60,
      },
    });
  });

  return { clients, errors, skipped };
}

/** Insert in batches. Returns what landed and what didn't, per row. */
export async function runImport(planned, actorEmail = "") {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  let inserted = 0;
  const failures = [];

  for (const item of planned) {
    try {
      const { data, error } = await supabase
        .from("crm_clients")
        .insert({ ...item.client, assigned_to: item.client.assigned_to || actorEmail })
        .select("id")
        .single();
      if (error) throw error;

      const req = item.requirement;
      const hasReq =
        req.localities.length || req.flat_types.length || req.budget_min || req.budget_max || req.move_in;
      if (hasReq) {
        await supabase
          .from("crm_client_requirements")
          .upsert({ client_id: data.id, ...req, updated_by: actorEmail }, { onConflict: "client_id" });
      }

      await supabase.from("crm_activities").insert({
        client_id: data.id,
        actor_email: actorEmail,
        type: "system",
        body: "Imported from a spreadsheet",
      });
      inserted += 1;
    } catch (e) {
      failures.push(`Row ${item._line}: ${e?.message || "could not be added"}`);
    }
  }

  return { inserted, failures };
}

/** Browser download of a generated file — no server round trip. */
export function downloadCsv(filename, contents) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
