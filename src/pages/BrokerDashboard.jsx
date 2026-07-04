/**
 * /broker — Broker / seller CRM dashboard.
 * Reads from Supabase: hunters, properties, follow_ups, tasks, visit_schedules, property_matches.
 * Falls back to empty state with setup prompts when Supabase is not configured.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/**
 * A session left open a long time can go stale without the UI noticing, so a
 * write reaches the DB effectively anonymous and trips RLS ("new row violates
 * row-level security policy") instead of a clear auth error. Try one silent
 * session refresh + retry before surfacing anything to the user.
 */
async function withSessionRetry(run) {
  let result = await run();
  if (result.error && /row-level security/i.test(result.error.message || "")) {
    const { data } = await supabase.auth.refreshSession().catch(() => ({ data: null }));
    if (data?.session) result = await run();
  }
  if (result.error && /row-level security/i.test(result.error.message || "")) {
    const { data: sessionData } = await supabase.auth.getSession().catch(() => ({ data: null }));
    const uid = sessionData?.session?.user?.id || null;
    console.error("RLS write rejected", {
      hasSession: Boolean(sessionData?.session),
      uid,
      code: result.error.code,
      details: result.error.details,
      hint: result.error.hint,
      message: result.error.message,
    });
    result = {
      ...result,
      error: {
        ...result.error,
        message: uid
          ? `Save blocked by a database permission rule (signed in as ${uid.slice(0, 8)}…). Open the browser console for details and share them.`
          : "Your session expired — please sign out and sign in again.",
      },
    };
  }
  return result;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function isOverdue(iso) {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

/* ── Design tokens ── */
const INK = "#1A2421";
const PAPER = "#F7F4ED";
const WHITE = "#FFFEFB";
const LINE = "#D9D3C4";
const MUTED = "#8B8578";
const RUST = "#C8500F";
const VERIFIED = "#2D6A4F";
const VERIFIED_BG = "#E3EEE7";

/* ── Small shared components ─────────────────────────────────────────────── */

function StatCard({ label, value, sub, accent = INK }) {
  return (
    <div style={{ background: WHITE, border: `1px solid ${LINE}`, borderRadius: 14, padding: "20px 24px" }}>
      <div style={{ fontSize: 32, fontWeight: 800, color: accent, fontFamily: "Georgia, serif", lineHeight: 1 }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, to, toLabel = "View all" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>{title}</div>
      {to && (
        <Link to={to} style={{ fontSize: 13, fontWeight: 600, color: RUST, textDecoration: "none" }}>
          {toLabel}
        </Link>
      )}
    </div>
  );
}

function Badge({ label, color = MUTED, bg = "#EFEAE0" }) {
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 700, padding: "2px 10px",
        borderRadius: 999, background: bg, color: color,
        fontFamily: "JetBrains Mono, monospace", textTransform: "uppercase", letterSpacing: "0.04em",
      }}
    >
      {label}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    overdue: { label: "Overdue", color: "#dc2626", bg: "#fef2f2" },
    pending: { label: "Pending", color: RUST,      bg: "#FBEAE0" },
    done:    { label: "Done",    color: VERIFIED,  bg: VERIFIED_BG },
    completed: { label: "Completed", color: VERIFIED, bg: VERIFIED_BG },
    high:    { label: "High",    color: "#dc2626", bg: "#fef2f2" },
    medium:  { label: "Medium",  color: RUST,      bg: "#FBEAE0" },
    urgent:  { label: "Urgent",  color: "#7c3aed", bg: "#ede9fe" },
    low:     { label: "Low",     color: MUTED,     bg: "#EFEAE0" },
    new:     { label: "New",     color: VERIFIED,  bg: VERIFIED_BG },
    active:  { label: "Active",  color: VERIFIED,  bg: VERIFIED_BG },
    available: { label: "Available", color: VERIFIED, bg: VERIFIED_BG },
    cancelled: { label: "Cancelled", color: MUTED, bg: "#EFEAE0" },
    accepted: { label: "Accepted", color: VERIFIED, bg: VERIFIED_BG },
    rejected: { label: "Rejected", color: "#dc2626", bg: "#fef2f2" },
    contacted: { label: "Contacted", color: RUST, bg: "#FBEAE0" },
    closed: { label: "Closed", color: MUTED, bg: "#EFEAE0" },
  };
  const s = map[String(status || "").toLowerCase()] || { label: status || "—", color: MUTED, bg: "#EFEAE0" };
  return <Badge label={s.label} color={s.color} bg={s.bg} />;
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "11px 16px", borderRadius: 10, width: "100%",
        background: active ? RUST : "transparent",
        color: active ? WHITE : MUTED,
        border: "none", cursor: "pointer",
        fontSize: 14, fontWeight: active ? 600 : 500,
        textAlign: "left",
        transition: "background 0.15s, color 0.15s",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/* ── Sidebar nav items ────────────────────────────────────────────────────── */
const NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: "hunters",
    label: "Hunters",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "properties",
    label: "Properties",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
        <path d="M3 9l9-6 9 6v11a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
      </svg>
    ),
  },
  {
    id: "followups",
    label: "Follow-ups",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.34 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.08 6.08l.96-1.21a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.72 15" />
      </svg>
    ),
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    id: "visits",
    label: "Visit Schedule",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    id: "matching",
    label: "Matching",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
    ),
  },
  {
    id: "whatsapp",
    label: "WhatsApp Leads",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      </svg>
    ),
  },
];

/* ── Table helpers ─────────────────────────────────────────────────────────── */
function Table({ cols, rows, emptyMsg }) {
  if (!rows.length) {
    return (
      <div
        style={{
          background: WHITE, border: `1px solid ${LINE}`,
          borderRadius: 12, padding: "32px 20px",
          textAlign: "center", color: MUTED, fontSize: 13,
        }}
      >
        {emptyMsg}
      </div>
    );
  }
  return (
    <div style={{ background: WHITE, border: `1px solid ${LINE}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {cols.map((c) => (
                <th
                  key={c.key}
                  style={{
                    padding: "10px 16px", textAlign: "left", fontSize: 11,
                    fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                    color: MUTED, background: PAPER, whiteSpace: "nowrap",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ borderTop: `1px solid #f1f5f9` }}>
                {cols.map((c) => (
                  <td
                    key={c.key}
                    style={{ padding: "11px 16px", fontSize: 13, color: c.muted ? MUTED : INK, whiteSpace: c.nowrap ? "nowrap" : undefined }}
                  >
                    {c.render ? c.render(row) : row[c.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Generic entity form modal (Hunters / Follow-ups / Tasks / Visits / Matches) ── */

function fieldOptions(field, context) {
  if (field.options) return field.options.map((o) => ({ value: o, label: o[0].toUpperCase() + o.slice(1) }));
  if (field.optionsFrom === "hunters") return (context.hunters ?? []).map((h) => ({ value: h.id, label: h.name ?? h.id }));
  if (field.optionsFrom === "properties") return (context.properties ?? []).map((p) => ({ value: p.id, label: p.title ?? p.id }));
  return [];
}

const fieldStyle = {
  width: "100%", height: 40, borderRadius: 10, border: `1px solid ${LINE}`,
  background: PAPER, padding: "0 12px", fontSize: 13, color: INK, outline: "none", fontFamily: "inherit",
};

function FormField({ field, value, onChange, context }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6 }}>
        {field.label}{field.required ? " *" : ""}
      </div>
      {field.type === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={fieldStyle}>
          <option value="">— Select —</option>
          {fieldOptions(field, context).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          style={{ ...fieldStyle, height: "auto", padding: "10px 12px", resize: "vertical" }}
        />
      ) : (
        <input
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "datetime-local" ? "datetime-local" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.hint}
          style={fieldStyle}
        />
      )}
    </label>
  );
}

function EntityFormModal({ table, title, fields, context, onClose, onSaved }) {
  const overlayRef = useRef(null);
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.key, f.default ?? ""])));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isSupabaseConfigured || !supabase) { setErr("Supabase not configured."); return; }
    for (const f of fields) {
      if (f.required && !String(values[f.key] ?? "").trim()) {
        setErr(`${f.label} is required.`);
        return;
      }
    }
    setSaving(true);
    setErr("");
    const payload = {};
    for (const f of fields) {
      const raw = values[f.key];
      if (raw === "" || raw == null) { payload[f.key] = null; continue; }
      payload[f.key] = f.transform ? f.transform(raw) : (f.type === "number" ? Number(raw) : raw);
    }
    const { error } = await withSessionRetry(() => supabase.from(table).insert([payload]));
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      style={{
        position: "fixed", inset: 0, background: "rgba(26,36,33,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 200, padding: 16,
      }}
    >
      <div style={{
        background: WHITE, borderRadius: 16, width: 560, height: 520,
        boxShadow: "0 12px 48px rgba(0,0,0,0.22)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${LINE}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700, color: INK }}>{title}</div>
          <button type="button" onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid ${LINE}`, background: PAPER, cursor: "pointer", fontSize: 18, color: MUTED, display: "flex", alignItems: "center", justifyContent: "center" }}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px", overflowY: "auto", flex: 1, minHeight: 0 }}>
          {fields.map((f) => (
            <FormField
              key={f.key}
              field={f}
              value={values[f.key]}
              onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
              context={context}
            />
          ))}
          {err && (
            <div style={{ background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", fontSize: 14, color: "#b91c1c", marginBottom: 16 }}>
              {err}
            </div>
          )}
          <button
            type="submit"
            disabled={saving}
            style={{
              width: "100%", height: 48, borderRadius: 10, border: "none",
              background: saving ? "#ccc" : INK, color: WHITE,
              fontSize: 15, fontWeight: 600, cursor: saving ? "default" : "pointer",
              marginTop: 8,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}

const HUNTER_FIELDS = [
  { key: "name", label: "Name", type: "text", required: true },
  { key: "phone", label: "Phone", type: "text", required: true },
  { key: "type", label: "Type", type: "select", options: ["Tenant", "Buyer", "Owner"], default: "Tenant", transform: (v) => v.toLowerCase() },
  { key: "budget_min", label: "Budget min (₹)", type: "number" },
  { key: "budget_max", label: "Budget max (₹)", type: "number" },
  { key: "preferred_areas", label: "Preferred areas (comma-separated)", type: "text", hint: "e.g. HSR Layout, Koramangala", transform: (v) => v.split(",").map((s) => s.trim()).filter(Boolean) },
  { key: "status", label: "Status", type: "select", options: ["New", "Contacted", "Active", "Closed"], default: "New", transform: (v) => v.toLowerCase() },
  { key: "move_in_date", label: "Move-in date", type: "date" },
];

const FOLLOWUP_FIELDS = [
  { key: "hunter_id", label: "Hunter", type: "select", optionsFrom: "hunters", required: true },
  { key: "type", label: "Type", type: "select", options: ["Call", "Visit", "Email", "Whatsapp"], default: "Call", transform: (v) => v.toLowerCase() },
  { key: "scheduled_at", label: "Scheduled at", type: "datetime-local", required: true },
  { key: "notes", label: "Notes", type: "textarea" },
  { key: "status", label: "Status", type: "select", options: ["Pending", "Done"], default: "Pending", transform: (v) => v.toLowerCase() },
];

const TASK_FIELDS = [
  { key: "title", label: "Title", type: "text", required: true },
  { key: "priority", label: "Priority", type: "select", options: ["Low", "Medium", "High", "Urgent"], default: "Medium", transform: (v) => v.toLowerCase() },
  { key: "due_date", label: "Due date", type: "date" },
  { key: "status", label: "Status", type: "select", options: ["Pending", "Done"], default: "Pending", transform: (v) => v.toLowerCase() },
];

const VISIT_FIELDS = [
  { key: "hunter_id", label: "Hunter", type: "select", optionsFrom: "hunters", required: true },
  { key: "property_id", label: "Property", type: "select", optionsFrom: "properties", required: true },
  { key: "scheduled_at", label: "Date & time", type: "datetime-local", required: true },
  { key: "notes", label: "Notes", type: "textarea" },
  { key: "status", label: "Status", type: "select", options: ["Pending", "Done", "Cancelled"], default: "Pending", transform: (v) => v.toLowerCase() },
];

const MATCH_FIELDS = [
  { key: "hunter_id", label: "Hunter", type: "select", optionsFrom: "hunters", required: true },
  { key: "property_id", label: "Property", type: "select", optionsFrom: "properties", required: true },
  { key: "match_score", label: "Match score (0-100)", type: "number" },
  { key: "notes", label: "Notes", type: "textarea" },
  { key: "status", label: "Status", type: "select", options: ["Pending", "Accepted", "Rejected"], default: "Pending", transform: (v) => v.toLowerCase() },
];

/* ── Row action buttons ────────────────────────────────────────────────────── */
function RowActions({ actions }) {
  if (!actions.length) return "—";
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={a.onClick}
          style={{
            fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 7,
            border: `1px solid ${a.tone === "danger" ? "#dc2626" : a.tone === "success" ? VERIFIED : LINE}`,
            background: a.tone === "danger" ? "#fef2f2" : a.tone === "success" ? VERIFIED_BG : WHITE,
            color: a.tone === "danger" ? "#dc2626" : a.tone === "success" ? VERIFIED : INK,
            cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

/* ── Section header with an "Add" button ─────────────────────────────────────── */
function SectionHeaderWithAdd({ title, addLabel, onAdd }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>{title}</div>
      <button
        type="button"
        onClick={onAdd}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          background: RUST, color: WHITE,
          border: "none", borderRadius: 8, padding: "8px 16px",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {addLabel}
      </button>
    </div>
  );
}

/* ── Tab panels ─────────────────────────────────────────────────────────────── */
function DashboardPanel({ stats, followups, tasks, whatsappLeads }) {
  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Hunters" value={stats.hunters} sub={`${stats.newHunters ?? 0} new leads`} accent={INK} />
        <StatCard label="Properties" value={stats.properties} sub={`${stats.activeProperties ?? 0} available`} accent={INK} />
        <StatCard label="WhatsApp Leads" value={stats.whatsappLeads} sub={`${stats.whatsappLeadsWeek ?? 0} this week`} accent={VERIFIED} />
        <StatCard label="Pending Follow-ups" value={stats.pendingFollowups} accent={RUST} />
        <StatCard label="Active Tasks" value={stats.activeTasks} accent="#7c3aed" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
        {/* Upcoming follow-ups */}
        <div>
          <SectionHeader title="Upcoming Follow-ups" to="/broker?tab=followups" />
          {followups.slice(0, 5).length === 0 ? (
            <div style={{ background: WHITE, border: `1px solid ${LINE}`, borderRadius: 12, padding: "24px 16px", textAlign: "center", color: MUTED, fontSize: 13 }}>
              No pending follow-ups
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {followups.slice(0, 5).map((f, i) => (
                <div
                  key={i}
                  style={{
                    background: WHITE, border: `1px solid ${LINE}`, borderRadius: 12,
                    padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>
                      {f.hunters?.name ?? f.hunter_id ?? "—"}
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2, textTransform: "capitalize" }}>
                      {f.type ?? "Follow-up"}
                    </div>
                  </div>
                  <StatusBadge status={isOverdue(f.scheduled_at) ? "overdue" : "pending"} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active tasks */}
        <div>
          <SectionHeader title="Active Tasks" to="/broker?tab=tasks" />
          {tasks.slice(0, 5).length === 0 ? (
            <div style={{ background: WHITE, border: `1px solid ${LINE}`, borderRadius: 12, padding: "24px 16px", textAlign: "center", color: MUTED, fontSize: 13 }}>
              No active tasks
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tasks.slice(0, 5).map((t, i) => (
                <div
                  key={i}
                  style={{
                    background: WHITE, border: `1px solid ${LINE}`, borderRadius: 12,
                    padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>{t.title ?? "—"}</div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                      {fmtDate(t.due_date)}
                    </div>
                  </div>
                  <StatusBadge status={t.priority ?? t.status ?? "medium"} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <SectionHeader title="Recent WhatsApp Leads" to="/broker?tab=whatsapp" />
        {whatsappLeads.slice(0, 5).length === 0 ? (
          <div style={{ background: WHITE, border: `1px solid ${LINE}`, borderRadius: 12, padding: "24px 16px", textAlign: "center", color: MUTED, fontSize: 13 }}>
            No WhatsApp contacts yet — they appear when renters click WhatsApp on your listings.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {whatsappLeads.slice(0, 5).map((row) => (
              <div
                key={row.id}
                style={{
                  background: WHITE, border: `1px solid ${LINE}`, borderRadius: 12,
                  padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>
                    {row.customer_name || row.customer_email || "Unknown renter"}
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                    {row.property_title || "Listing"} · {fmtDateTime(row.created_at)}
                  </div>
                </div>
                <Badge label="WhatsApp" color={VERIFIED} bg={VERIFIED_BG} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WhatsAppLeadsPanel({ leads }) {
  function customerWaUrl(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length < 10) return null;
    return `https://wa.me/${digits}`;
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>WhatsApp Leads ({leads.length})</div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 4, lineHeight: 1.5 }}>
          Renters who clicked WhatsApp on your listings. Each row includes the prefilled message they sent.
        </div>
      </div>
      <Table
        emptyMsg="No WhatsApp leads yet. They appear when signed-in renters contact you from a listing."
        cols={[
          {
            key: "when",
            label: "When",
            nowrap: true,
            render: (r) => fmtDateTime(r.created_at),
          },
          {
            key: "customer",
            label: "Renter",
            render: (r) => (
              <div>
                <div style={{ fontWeight: 600 }}>{r.customer_name || "—"}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{r.customer_email || "—"}</div>
                {r.customer_phone ? (
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{r.customer_phone}</div>
                ) : null}
              </div>
            ),
          },
          {
            key: "property",
            label: "Property",
            render: (r) => (
              <div>
                <div style={{ fontWeight: 600 }}>{r.property_title || "—"}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                  {[r.property_area, r.rent_amount ? `₹${Number(r.rent_amount).toLocaleString("en-IN")}/mo` : null]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
              </div>
            ),
          },
          {
            key: "message",
            label: "Message",
            render: (r) => {
              const text = String(r.message || "").trim();
              if (!text) return "—";
              return text.length > 90 ? `${text.slice(0, 90)}…` : text;
            },
          },
          {
            key: "source",
            label: "Source",
            render: (r) => <Badge label={String(r.source || "whatsapp").replace(/_/g, " ")} />,
          },
          {
            key: "actions",
            label: "",
            render: (r) => {
              const href = customerWaUrl(r.customer_phone);
              if (!href) return "—";
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "5px 12px",
                    borderRadius: 7,
                    border: `1px solid ${VERIFIED}`,
                    background: VERIFIED_BG,
                    color: VERIFIED,
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Reply on WhatsApp
                </a>
              );
            },
          },
        ]}
        rows={leads}
      />
    </div>
  );
}

function HuntersPanel({ hunters, onAdd, onUpdateStatus }) {
  return (
    <div>
      <SectionHeaderWithAdd title={`Hunters (${hunters.length})`} addLabel="Add hunter" onAdd={onAdd} />
      <Table
        emptyMsg="No hunters yet. They'll appear here when leads are added."
        cols={[
          { key: "name", label: "Name" },
          { key: "phone", label: "Phone" },
          { key: "type", label: "Type", render: (r) => <Badge label={r.type ?? "—"} /> },
          { key: "budget_min", label: "Budget", render: (r) => r.budget_min ? `₹${Number(r.budget_min).toLocaleString("en-IN")} – ₹${Number(r.budget_max || 0).toLocaleString("en-IN")}` : "—" },
          { key: "preferred_areas", label: "Areas", render: (r) => (r.preferred_areas ?? []).slice(0, 2).join(", ") || "—" },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status ?? "new"} /> },
          { key: "move_in_date", label: "Move-in", muted: true, render: (r) => fmtDate(r.move_in_date) },
          {
            key: "actions", label: "Actions", render: (r) => (
              <RowActions
                actions={
                  r.status === "closed"
                    ? []
                    : [{ label: "Mark closed", tone: "success", onClick: () => onUpdateStatus("hunters", r.id, "closed") }]
                }
              />
            ),
          },
        ]}
        rows={hunters}
      />
    </div>
  );
}

/* ── Add Listing Chat Wizard ────────────────────────────────────────────────── */

const LISTING_STEPS = [
  {
    key: "area",
    question: "Which area is this property in?",
    hint: "e.g. HSR Layout, Koramangala, Whitefield",
    required: true,
    quickReplies: ["HSR Layout", "Koramangala", "Indiranagar", "Whitefield", "Bellandur", "BTM Layout", "Hebbal"],
  },
  {
    key: "bhk_type",
    question: "How many bedrooms?",
    required: true,
    quickReplies: ["1 RK", "1 BHK", "2 BHK", "3 BHK", "3+ BHK", "Villa", "PG"],
  },
  {
    key: "rent_amount",
    question: "Monthly rent? (₹)",
    hint: "Just the number, e.g. 25000",
    required: true,
    quickReplies: ["15000", "20000", "25000", "30000", "40000", "50000"],
  },
  {
    key: "deposit_amount",
    question: "Security deposit? (₹)",
    hint: "Usually 2–3 months rent",
    required: false,
    quickReplies: ["1 month", "2 months", "3 months", "Skip"],
  },
  {
    key: "furnishing",
    question: "Furnishing status?",
    required: false,
    quickReplies: ["Furnished", "Semi-furnished", "Unfurnished", "Skip"],
  },
  {
    key: "full_address",
    question: "Full address or landmark?",
    hint: "e.g. 5th Cross, HSR Layout, near EGL",
    required: false,
    quickReplies: ["Skip"],
  },
  {
    key: "floor_number",
    question: "Which floor is the unit on?",
    required: false,
    quickReplies: ["Ground", "1st", "2nd", "3rd", "4th", "5th+", "Skip"],
  },
  {
    key: "description",
    question: "Any extra details? (amenities, rules, parking…)",
    hint: "Or tap Skip",
    required: false,
    quickReplies: ["Parking available", "Pet friendly", "Power backup", "Skip"],
  },
  {
    key: "size_sqft",
    question: "Built-up area? (sqft)",
    hint: "Just the number, or Skip",
    required: false,
    quickReplies: ["Skip"],
  },
  {
    key: "total_floors",
    question: "How many floors does the building have in total?",
    required: false,
    quickReplies: ["Skip"],
  },
  {
    key: "amenities",
    question: "Any amenities?",
    hint: "Comma-separated, e.g. Gym, Lift, Security, Swimming Pool",
    required: false,
    quickReplies: ["Gym, Lift, Security", "Parking, Power backup", "Skip"],
  },
  {
    key: "water_timings",
    question: "Water supply timings?",
    hint: "e.g. 6-9 AM & 6-9 PM",
    required: false,
    quickReplies: ["24x7", "Skip"],
  },
  {
    key: "society_rules",
    question: "Any society rules to mention?",
    required: false,
    quickReplies: ["No pets", "Bachelors not allowed", "No brokers", "Skip"],
  },
  {
    key: "deposit_terms",
    question: "Any deposit terms or conditions?",
    hint: "e.g. Refundable, 1 month notice",
    required: false,
    quickReplies: ["Fully refundable", "Skip"],
  },
  {
    key: "landlord_info",
    question: "Anything to note about the landlord/owner?",
    hint: "Contact preferences, availability, etc. — or Skip",
    required: false,
    quickReplies: ["Skip"],
  },
  {
    key: "is_handover",
    question: "Is this a handover listing? (current tenant passing the flat directly to the next tenant)",
    required: false,
    quickReplies: ["Yes", "No"],
  },
  {
    key: "photos",
    question: "Add photos of the property?",
    hint: "Upload up to 5 images (JPG/PNG). Tap Skip to skip.",
    required: false,
    quickReplies: ["Skip"],
    isPhotoStep: true,
  },
];

function buildTitle(data) {
  const bhk = data.bhk_type || "Flat";
  const area = data.area || "Bengaluru";
  return `${bhk} in ${area}`;
}

function resolveDeposit(raw, rent) {
  const t = String(raw || "").toLowerCase();
  const r = Number(String(rent || "0").replace(/\D/g, ""));
  if (t.includes("1 month")) return r || null;
  if (t.includes("2 month")) return r ? r * 2 : null;
  if (t.includes("3 month")) return r ? r * 3 : null;
  return Number(raw.replace(/\D/g, "")) || null;
}

function resolveFurnishing(raw) {
  const t = String(raw || "").toLowerCase().replace(/[-\s]/g, "");
  if (t.includes("semi")) return "semi_furnished";
  if (t.includes("unfurnish") || t === "unfurnished") return "unfurnished";
  if (t.includes("furnish")) return "furnished";
  return null;
}

function resolveFloor(raw) {
  const t = String(raw || "").toLowerCase();
  if (t === "ground") return 0;
  if (t.includes("5th+")) return 5;
  const n = parseInt(t);
  return isNaN(n) ? null : n;
}

function AddListingModal({ onClose, onSaved }) {
  const overlayRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const photoInputRef = useRef(null);
  const didInit = useRef(false);

  const [stepIdx, setStepIdx] = useState(0);
  const [data, setData] = useState({});
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [done, setDone] = useState(false);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);

  // Push the first question on mount (guard against StrictMode double-mount)
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    pushBot(LISTING_STEPS[0].question, LISTING_STEPS[0].quickReplies);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function pushBot(text, quickReplies = []) {
    setMessages((m) => [...m, { role: "bot", text, quickReplies, id: Date.now() + Math.random() }]);
  }
  function pushUser(text) {
    setMessages((m) => [...m, { role: "user", text, id: Date.now() + Math.random() }]);
  }

  async function saveProperty(finalData) {
    if (!isSupabaseConfigured || !supabase) {
      setSaveErr("Supabase not configured."); return;
    }
    setSaving(true); setSaveErr("");

    // Upload photos to Supabase Storage
    const uploadedUrls = [];
    for (const file of photoFiles) {
      const path = `listings/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("listings")
        .upload(path, file, { upsert: false });
      if (uploadErr) {
        setSaveErr(`Photo upload failed: ${uploadErr.message}`);
        setSaving(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("listings").getPublicUrl(uploadData.path);
      uploadedUrls.push(publicUrl);
    }

    const rent = Number(String(finalData.rent_amount || "").replace(/\D/g, "")) || null;
    const sizeSqft = finalData.size_sqft === "Skip" ? null : parseInt(finalData.size_sqft, 10);
    const totalFloors = finalData.total_floors === "Skip" ? null : parseInt(finalData.total_floors, 10);
    const amenitiesList = finalData.amenities && finalData.amenities !== "Skip"
      ? finalData.amenities.split(",").map((s) => s.trim()).filter(Boolean)
      : null;
    const payload = {
      title: buildTitle(finalData),
      area: finalData.area || null,
      bhk_type: finalData.bhk_type || null,
      rent_amount: rent,
      deposit_amount: resolveDeposit(finalData.deposit_amount, rent),
      furnishing: finalData.furnishing === "Skip" ? null : resolveFurnishing(finalData.furnishing),
      full_address: finalData.full_address === "Skip" ? null : finalData.full_address || null,
      floor_number: finalData.floor_number === "Skip" ? null : resolveFloor(finalData.floor_number),
      description: finalData.description === "Skip" ? null : finalData.description || null,
      size_sqft: Number.isFinite(sizeSqft) ? sizeSqft : null,
      total_floors: Number.isFinite(totalFloors) ? totalFloors : null,
      amenities: amenitiesList,
      water_timings: finalData.water_timings === "Skip" ? null : finalData.water_timings || null,
      society_rules: finalData.society_rules === "Skip" ? null : finalData.society_rules || null,
      deposit_terms: finalData.deposit_terms === "Skip" ? null : finalData.deposit_terms || null,
      landlord_info: finalData.landlord_info === "Skip" ? null : finalData.landlord_info || null,
      is_handover: finalData.is_handover === "Yes",
      status: "available",
      city: "Bengaluru",
      ...(uploadedUrls.length > 0 && { images: uploadedUrls }),
    };
    const { error } = await withSessionRetry(() => supabase.from("properties").insert([payload]));
    setSaving(false);
    if (error) { setSaveErr(error.message); return; }
    setDone(true);
    onSaved();
  }

  function handlePhotoSelect(e) {
    const files = Array.from(e.target.files || []).slice(0, 5);
    setPhotoFiles(files);
    setPhotoPreviews(files.map((f) => URL.createObjectURL(f)));
  }

  async function handleAnswer(answer) {
    const step = LISTING_STEPS[stepIdx];
    const text = String(answer || "").trim();

    // Photo step — only responds to "Skip" quick reply or "done-photos" from button
    if (step.isPhotoStep) {
      if (text !== "Skip" && text !== "done-photos") return;
      if (photoFiles.length > 0) {
        pushUser(`${photoFiles.length} photo${photoFiles.length > 1 ? "s" : ""} selected`);
      } else {
        pushUser("Skipped photos");
      }
      const newData = { ...data };
      setData(newData);
      setInput("");
      const summary = [
        `Area: ${newData.area}`,
        `BHK: ${newData.bhk_type}`,
        `Rent: ₹${Number(String(newData.rent_amount).replace(/\D/g,"")).toLocaleString("en-IN")}/mo`,
        newData.furnishing && newData.furnishing !== "Skip" ? `Furnishing: ${newData.furnishing}` : null,
        photoFiles.length > 0 ? `${photoFiles.length} photo${photoFiles.length > 1 ? "s" : ""}` : null,
      ].filter(Boolean).join(" · ");
      pushBot(`Got it — saving "${buildTitle(newData)}" now.\n${summary}`);
      await saveProperty(newData);
      return;
    }

    // Validate required fields
    if (step.required && (!text || text.toLowerCase() === "skip")) {
      pushBot(`This one is required — ${step.hint || "please enter a value"}.`);
      return;
    }

    pushUser(text);
    const newData = { ...data, [step.key]: text === "Skip" ? "" : text };
    setData(newData);
    setInput("");

    const nextIdx = stepIdx + 1;

    if (nextIdx >= LISTING_STEPS.length) {
      const summary = [
        `Area: ${newData.area}`,
        `BHK: ${newData.bhk_type}`,
        `Rent: ₹${Number(String(newData.rent_amount).replace(/\D/g,"")).toLocaleString("en-IN")}/mo`,
        newData.furnishing && newData.furnishing !== "Skip" ? `Furnishing: ${newData.furnishing}` : null,
      ].filter(Boolean).join(" · ");
      pushBot(`Got it — saving "${buildTitle(newData)}" now.\n${summary}`);
      await saveProperty(newData);
    } else {
      setStepIdx(nextIdx);
      const next = LISTING_STEPS[nextIdx];
      pushBot(next.question + (next.hint ? `\n${next.hint}` : ""), next.quickReplies);
    }
  }

  const step = LISTING_STEPS[Math.min(stepIdx, LISTING_STEPS.length - 1)];
  const progress = Math.round(((stepIdx) / LISTING_STEPS.length) * 100);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      style={{
        position: "fixed", inset: 0, background: "rgba(26,36,33,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 200, padding: 16,
      }}
    >
      <div style={{
        background: WHITE, borderRadius: 16, width: 560, height: 560,
        boxShadow: "0 12px 48px rgba(0,0,0,0.22)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${LINE}`, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700, color: INK }}>
              Add Listing
            </div>
            <button type="button" onClick={onClose}
              style={{ width: 32, height: 32, borderRadius: "50%", border: `1px solid ${LINE}`, background: PAPER, cursor: "pointer", fontSize: 20, color: MUTED, display: "flex", alignItems: "center", justifyContent: "center" }}>
              ×
            </button>
          </div>
          {/* Progress bar */}
          <div style={{ height: 5, background: "#E8E4DC", borderRadius: 99 }}>
            <div style={{ height: "100%", background: RUST, borderRadius: 99, width: `${progress}%`, transition: "width 0.4s" }} />
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 6, fontFamily: "JetBrains Mono, monospace" }}>
            Step {stepIdx + 1} of {LISTING_STEPS.length}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "82%", borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                padding: "12px 16px", fontSize: 14, lineHeight: 1.55,
                background: msg.role === "user" ? INK : PAPER,
                color: msg.role === "user" ? WHITE : INK,
                border: msg.role === "user" ? "none" : `1px solid ${LINE}`,
                whiteSpace: "pre-wrap",
              }}>
                {msg.text}
              </div>
            </div>
          ))}

          {saving && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: "14px 14px 14px 4px", padding: "10px 14px", fontSize: 13, color: MUTED }}>
                Saving…
              </div>
            </div>
          )}

          {done && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{ background: VERIFIED_BG, border: `1px solid ${VERIFIED}`, borderRadius: 12, padding: "12px 16px", fontSize: 13, color: VERIFIED, fontWeight: 600 }}>
                ✓ Listing saved! Switching to Properties tab…
              </div>
            </div>
          )}

          {saveErr && (
            <div style={{ background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#b91c1c" }}>
              {saveErr}
            </div>
          )}
        </div>

        {/* Quick replies */}
        {!done && !saving && step.quickReplies?.length > 0 && (
          <div style={{ padding: "0 20px 10px", display: "flex", flexWrap: "wrap", gap: 8, flexShrink: 0 }}>
            {step.quickReplies.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleAnswer(r)}
                style={{
                  fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 99,
                  border: `1.5px solid ${r === "Skip" ? LINE : RUST}`,
                  background: r === "Skip" ? PAPER : "#FBEAE0",
                  color: r === "Skip" ? MUTED : RUST,
                  cursor: "pointer",
                }}
              >
                {r}
              </button>
            ))}
          </div>
        )}

        {/* Photo upload UI */}
        {!done && !saving && step.isPhotoStep && (
          <div style={{ padding: "0 20px 12px", flexShrink: 0 }}>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={handlePhotoSelect}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              style={{
                width: "100%", padding: "12px", borderRadius: 10,
                border: `2px dashed ${RUST}`, background: "#FBEAE0",
                color: RUST, fontSize: 14, fontWeight: 600, cursor: "pointer",
                marginBottom: photoPreviews.length > 0 ? 10 : 0,
              }}
            >
              {photoPreviews.length > 0 ? `✓ ${photoPreviews.length} photo${photoPreviews.length > 1 ? "s" : ""} selected — click to change` : "📷  Choose photos (up to 5)"}
            </button>
            {photoPreviews.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {photoPreviews.map((src, i) => (
                  <img key={i} src={src} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: `1px solid ${LINE}` }} />
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => handleAnswer("done-photos")}
              style={{
                width: "100%", marginTop: 10, padding: "12px", borderRadius: 10,
                border: "none", background: INK, color: WHITE,
                fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              {photoPreviews.length > 0 ? "Save listing with photos →" : "Save listing without photos →"}
            </button>
          </div>
        )}

        {/* Input bar */}
        {!done && !step.isPhotoStep && (
          <form
            onSubmit={(e) => { e.preventDefault(); if (input.trim()) handleAnswer(input); }}
            style={{ padding: "12px 16px 18px", borderTop: `1px solid ${LINE}`, display: "flex", gap: 10, flexShrink: 0 }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your answer…"
              style={{
                flex: 1, height: 46, borderRadius: 10, border: `1px solid ${LINE}`,
                background: PAPER, padding: "0 16px", fontSize: 14, color: INK,
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={!input.trim()}
              style={{
                width: 46, height: 46, borderRadius: 10, border: "none",
                background: input.trim() ? INK : "#ccc", color: WHITE,
                cursor: input.trim() ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
              </svg>
            </button>
          </form>
        )}

        {done && (
          <div style={{ padding: "14px 20px 22px", borderTop: `1px solid ${LINE}`, flexShrink: 0 }}>
            <button type="button" onClick={onClose}
              style={{ width: "100%", height: 48, borderRadius: 10, background: INK, color: WHITE, fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer" }}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function fmtFurnishing(v) {
  if (!v) return "—";
  return String(v).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function EditPropertyModal({ property, onClose, onSaved }) {
  const overlayRef = useRef(null);
  const photoInputRef = useRef(null);
  const [form, setForm] = useState({
    title: property.title || "",
    area: property.area || "",
    city: property.city || "Bengaluru",
    bhk_type: property.bhk_type || "",
    rent_amount: property.rent_amount ? String(property.rent_amount) : "",
    deposit_amount: property.deposit_amount ? String(property.deposit_amount) : "",
    furnishing: property.furnishing || "",
    full_address: property.full_address || "",
    floor_number: property.floor_number != null ? String(property.floor_number) : "",
    description: property.description || "",
    status: property.status || "available",
    size_sqft: property.size_sqft != null ? String(property.size_sqft) : "",
    total_floors: property.total_floors != null ? String(property.total_floors) : "",
    lat: property.lat != null ? String(property.lat) : "",
    lng: property.lng != null ? String(property.lng) : "",
    amenities: Array.isArray(property.amenities) ? property.amenities.join(", ") : "",
    water_timings: property.water_timings || "",
    society_rules: property.society_rules || "",
    deposit_terms: property.deposit_terms || "",
    landlord_info: property.landlord_info || "",
    is_handover: Boolean(property.is_handover),
    trust_passport: Boolean(property.trust_passport),
  });
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const existingPhotos = Array.isArray(property.images) ? property.images : [];
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function handlePhotoSelect(e) {
    const files = Array.from(e.target.files || []).slice(0, 5);
    setPhotoFiles(files);
    setPhotoPreviews(files.map((f) => URL.createObjectURL(f)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isSupabaseConfigured || !supabase) { setErr("Supabase not configured."); return; }
    setSaving(true); setErr("");

    const uploadedUrls = [...existingPhotos];
    for (const file of photoFiles) {
      const path = `listings/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("listings")
        .upload(path, file, { upsert: false });
      if (uploadErr) { setErr(`Photo upload failed: ${uploadErr.message}`); setSaving(false); return; }
      const { data: { publicUrl } } = supabase.storage.from("listings").getPublicUrl(uploadData.path);
      uploadedUrls.push(publicUrl);
    }

    const payload = {
      title: form.title || null,
      area: form.area || null,
      city: form.city || "Bengaluru",
      bhk_type: form.bhk_type || null,
      rent_amount: form.rent_amount ? Number(form.rent_amount) : null,
      deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : null,
      furnishing: form.furnishing || null,
      full_address: form.full_address || null,
      floor_number: form.floor_number ? Number(form.floor_number) : null,
      description: form.description || null,
      status: form.status || "available",
      size_sqft: form.size_sqft ? Number(form.size_sqft) : null,
      total_floors: form.total_floors ? Number(form.total_floors) : null,
      lat: form.lat ? Number(form.lat) : null,
      lng: form.lng ? Number(form.lng) : null,
      amenities: form.amenities
        ? form.amenities.split(",").map((s) => s.trim()).filter(Boolean)
        : null,
      water_timings: form.water_timings || null,
      society_rules: form.society_rules || null,
      deposit_terms: form.deposit_terms || null,
      landlord_info: form.landlord_info || null,
      is_handover: form.is_handover,
      trust_passport: form.trust_passport,
      ...(uploadedUrls.length > 0 && { images: uploadedUrls }),
    };

    const { error } = await withSessionRetry(() => supabase.from("properties").update(payload).eq("id", property.id));
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  }

  const inputSt = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: `1px solid ${LINE}`, fontSize: 14, background: PAPER,
    boxSizing: "border-box", color: INK, outline: "none",
  };
  const labelSt = { display: "block", fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(26,36,33,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}
    >
      <div style={{ background: WHITE, borderRadius: 16, width: "min(640px, 100%)", maxHeight: "min(90vh, 720px)", boxShadow: "0 12px 48px rgba(0,0,0,0.22)", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${LINE}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700, color: INK }}>Edit Property</div>
            {property.created_at && (
              <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                Listed {fmtDate(property.created_at)}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", border: `1px solid ${LINE}`, background: PAPER, cursor: "pointer", fontSize: 20, color: MUTED, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelSt}>Title</label>
              <input style={inputSt} value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label style={labelSt}>Area</label>
              <input style={inputSt} value={form.area} onChange={(e) => setForm(p => ({ ...p, area: e.target.value }))} />
            </div>
            <div>
              <label style={labelSt}>City</label>
              <input style={inputSt} value={form.city} onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))} />
            </div>
            <div>
              <label style={labelSt}>BHK Type</label>
              <select style={inputSt} value={form.bhk_type} onChange={(e) => setForm(p => ({ ...p, bhk_type: e.target.value }))}>
                <option value="">Select…</option>
                {["1 RK","1 BHK","2 BHK","3 BHK","3+ BHK","Villa","PG"].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>Status</label>
              <select style={inputSt} value={form.status} onChange={(e) => setForm(p => ({ ...p, status: e.target.value }))}>
                {["available","rented","unavailable"].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>Monthly Rent (₹)</label>
              <input style={inputSt} type="number" value={form.rent_amount} onChange={(e) => setForm(p => ({ ...p, rent_amount: e.target.value }))} />
            </div>
            <div>
              <label style={labelSt}>Security Deposit (₹)</label>
              <input style={inputSt} type="number" value={form.deposit_amount} onChange={(e) => setForm(p => ({ ...p, deposit_amount: e.target.value }))} />
            </div>
            <div>
              <label style={labelSt}>Furnishing</label>
              <select style={inputSt} value={form.furnishing} onChange={(e) => setForm(p => ({ ...p, furnishing: e.target.value }))}>
                <option value="">Select…</option>
                {["furnished","semi_furnished","unfurnished"].map(v => <option key={v} value={v}>{fmtFurnishing(v)}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>Floor Number</label>
              <input style={inputSt} type="number" value={form.floor_number} onChange={(e) => setForm(p => ({ ...p, floor_number: e.target.value }))} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Full Address</label>
            <input style={inputSt} value={form.full_address} onChange={(e) => setForm(p => ({ ...p, full_address: e.target.value }))} placeholder="Building, street, landmark…" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Description</label>
            <textarea style={{ ...inputSt, minHeight: 72, resize: "vertical" }} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Pet friendly, parking, society rules…" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelSt}>Built-up Area (sqft)</label>
              <input style={inputSt} type="number" value={form.size_sqft} onChange={(e) => setForm(p => ({ ...p, size_sqft: e.target.value }))} />
            </div>
            <div>
              <label style={labelSt}>Total Floors (building)</label>
              <input style={inputSt} type="number" value={form.total_floors} onChange={(e) => setForm(p => ({ ...p, total_floors: e.target.value }))} />
            </div>
            <div>
              <label style={labelSt}>Latitude</label>
              <input style={inputSt} type="number" step="any" value={form.lat} onChange={(e) => setForm(p => ({ ...p, lat: e.target.value }))} />
            </div>
            <div>
              <label style={labelSt}>Longitude</label>
              <input style={inputSt} type="number" step="any" value={form.lng} onChange={(e) => setForm(p => ({ ...p, lng: e.target.value }))} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Amenities</label>
            <input style={inputSt} value={form.amenities} onChange={(e) => setForm(p => ({ ...p, amenities: e.target.value }))} placeholder="Gym, Lift, Security, Swimming Pool…" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelSt}>Water Timings</label>
              <input style={inputSt} value={form.water_timings} onChange={(e) => setForm(p => ({ ...p, water_timings: e.target.value }))} placeholder="e.g. 24x7 or 6-9 AM & 6-9 PM" />
            </div>
            <div>
              <label style={labelSt}>Deposit Terms</label>
              <input style={inputSt} value={form.deposit_terms} onChange={(e) => setForm(p => ({ ...p, deposit_terms: e.target.value }))} placeholder="e.g. Fully refundable" />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Society Rules</label>
            <textarea style={{ ...inputSt, minHeight: 60, resize: "vertical" }} value={form.society_rules} onChange={(e) => setForm(p => ({ ...p, society_rules: e.target.value }))} placeholder="e.g. No pets, bachelors not allowed…" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Landlord Info</label>
            <textarea style={{ ...inputSt, minHeight: 60, resize: "vertical" }} value={form.landlord_info} onChange={(e) => setForm(p => ({ ...p, landlord_info: e.target.value }))} placeholder="Contact preferences, availability…" />
          </div>

          <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: INK, cursor: "pointer" }}>
              <input type="checkbox" checked={form.is_handover} onChange={(e) => setForm(p => ({ ...p, is_handover: e.target.checked }))} />
              Handover listing
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: INK, cursor: "pointer" }}>
              <input type="checkbox" checked={form.trust_passport} onChange={(e) => setForm(p => ({ ...p, trust_passport: e.target.checked }))} />
              Trust Passport verified
            </label>
          </div>

          {/* Photos */}
          <div style={{ marginBottom: 0 }}>
            <label style={labelSt}>Photos</label>
            {existingPhotos.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                {existingPhotos.map((src, i) => (
                  <img key={i} src={src} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: `1px solid ${LINE}` }} />
                ))}
                <div style={{ fontSize: 11, color: MUTED, alignSelf: "center" }}>{existingPhotos.length} existing photo{existingPhotos.length > 1 ? "s" : ""}</div>
              </div>
            )}
            <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handlePhotoSelect} />
            <button type="button" onClick={() => photoInputRef.current?.click()}
              style={{ width: "100%", padding: "10px", borderRadius: 8, border: `2px dashed ${RUST}`, background: "#FBEAE0", color: RUST, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {photoPreviews.length > 0 ? `✓ ${photoPreviews.length} new photo${photoPreviews.length > 1 ? "s" : ""} selected` : "📷  Add / replace photos"}
            </button>
            {photoPreviews.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {photoPreviews.map((src, i) => (
                  <img key={i} src={src} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: `1px solid ${LINE}` }} />
                ))}
              </div>
            )}
          </div>
          </div>

          <div style={{ flexShrink: 0, padding: "16px 24px 20px", borderTop: `1px solid ${LINE}`, background: WHITE }}>
          {err && <div style={{ background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#b91c1c", marginBottom: 12 }}>{err}</div>}

          <button type="submit" disabled={saving}
            style={{ width: "100%", height: 48, borderRadius: 10, border: "none", background: saving ? "#ccc" : INK, color: WHITE, fontSize: 15, fontWeight: 600, cursor: saving ? "default" : "pointer" }}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PropertiesPanel({ properties, onAdd, onEdit }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>Properties ({properties.length})</div>
        <button
          type="button"
          onClick={onAdd}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: RUST, color: WHITE,
            border: "none", borderRadius: 8, padding: "8px 16px",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add listing
        </button>
      </div>
      <Table
        emptyMsg="No properties yet. Click 'Add listing' to add your first one."
        cols={[
          {
            key: "cover", label: "", render: (r) => {
              const src = Array.isArray(r.images) ? r.images[0] : null;
              return src
                ? <img src={src} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, border: `1px solid ${LINE}` }} />
                : <div style={{ width: 48, height: 48, borderRadius: 8, background: PAPER, border: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: MUTED }}>No img</div>;
            }
          },
          { key: "title", label: "Title" },
          { key: "area", label: "Area" },
          { key: "city", label: "City", render: (r) => r.city ?? "—" },
          { key: "bhk_type", label: "BHK", render: (r) => r.bhk_type ?? "—" },
          { key: "rent_amount", label: "Rent", render: (r) => r.rent_amount ? `₹${Number(r.rent_amount).toLocaleString("en-IN")}` : "—" },
          { key: "deposit_amount", label: "Deposit", render: (r) => r.deposit_amount ? `₹${Number(r.deposit_amount).toLocaleString("en-IN")}` : "—" },
          { key: "floor_number", label: "Floor", render: (r) => r.floor_number != null ? r.floor_number : "—" },
          { key: "full_address", label: "Address", render: (r) => {
            const addr = String(r.full_address || "").trim();
            if (!addr) return "—";
            return addr.length > 36 ? `${addr.slice(0, 36)}…` : addr;
          }},
          { key: "furnishing", label: "Furnishing", render: (r) => fmtFurnishing(r.furnishing) },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status ?? "active"} /> },
          {
            key: "actions", label: "", render: (r) => (
              <button
                type="button"
                onClick={() => onEdit(r)}
                style={{
                  fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 7,
                  border: `1px solid ${LINE}`, background: WHITE, color: INK, cursor: "pointer",
                }}
              >
                Edit
              </button>
            )
          },
        ]}
        rows={properties}
      />
    </div>
  );
}

function FollowupsPanel({ followups, onAdd, onUpdateStatus }) {
  return (
    <div>
      <SectionHeaderWithAdd title={`Follow-ups (${followups.length})`} addLabel="Add follow-up" onAdd={onAdd} />
      <Table
        emptyMsg="No follow-ups scheduled."
        cols={[
          { key: "hunter", label: "Hunter", render: (r) => r.hunters?.name ?? r.hunter_id ?? "—" },
          { key: "type", label: "Type", render: (r) => <Badge label={r.type ?? "—"} /> },
          { key: "scheduled_at", label: "Scheduled", nowrap: true, render: (r) => fmtDate(r.scheduled_at) },
          { key: "notes", label: "Notes", render: (r) => r.notes ?? "—" },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={isOverdue(r.scheduled_at) ? "overdue" : r.status ?? "Pending"} /> },
          {
            key: "actions", label: "Actions", render: (r) => (
              <RowActions
                actions={
                  String(r.status || "").toLowerCase() === "done"
                    ? []
                    : [{ label: "Mark done", tone: "success", onClick: () => onUpdateStatus("follow_ups", r.id, "Done") }]
                }
              />
            ),
          },
        ]}
        rows={followups}
      />
    </div>
  );
}

function TasksPanel({ tasks, onAdd, onUpdateStatus }) {
  return (
    <div>
      <SectionHeaderWithAdd title={`Tasks (${tasks.length})`} addLabel="Add task" onAdd={onAdd} />
      <Table
        emptyMsg="No tasks yet."
        cols={[
          { key: "title", label: "Title" },
          { key: "priority", label: "Priority", render: (r) => <StatusBadge status={r.priority ?? "Medium"} /> },
          { key: "due_date", label: "Due", nowrap: true, render: (r) => fmtDate(r.due_date) },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status ?? "Pending"} /> },
          {
            key: "actions", label: "Actions", render: (r) => (
              <RowActions
                actions={
                  String(r.status || "").toLowerCase() === "done"
                    ? []
                    : [{ label: "Mark done", tone: "success", onClick: () => onUpdateStatus("tasks", r.id, "Done") }]
                }
              />
            ),
          },
        ]}
        rows={tasks}
      />
    </div>
  );
}

function VisitsPanel({ visits, onAdd, onUpdateStatus }) {
  return (
    <div>
      <SectionHeaderWithAdd title={`Visit Schedule (${visits.length})`} addLabel="Schedule visit" onAdd={onAdd} />
      <Table
        emptyMsg="No visits scheduled."
        cols={[
          { key: "hunter", label: "Hunter", render: (r) => r.hunters?.name ?? r.hunter_id ?? "—" },
          { key: "property", label: "Property", render: (r) => r.properties?.title ?? r.property_id ?? "—" },
          { key: "scheduled_at", label: "Date & Time", nowrap: true, render: (r) => fmtDate(r.scheduled_at) },
          { key: "notes", label: "Notes", render: (r) => r.notes ?? "—" },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status ?? "Pending"} /> },
          {
            key: "actions", label: "Actions", render: (r) => (
              <RowActions
                actions={
                  String(r.status || "").toLowerCase() === "pending"
                    ? [
                        { label: "Mark done", tone: "success", onClick: () => onUpdateStatus("visit_schedules", r.id, "Done") },
                        { label: "Cancel", tone: "danger", onClick: () => onUpdateStatus("visit_schedules", r.id, "Cancelled") },
                      ]
                    : []
                }
              />
            ),
          },
        ]}
        rows={visits}
      />
    </div>
  );
}

function MatchingPanel({ matches, onAdd, onUpdateStatus }) {
  return (
    <div>
      <SectionHeaderWithAdd title={`Property Matches (${matches.length})`} addLabel="Add match" onAdd={onAdd} />
      <Table
        emptyMsg="No matches yet. Matches are generated when the AI agent recommends properties to hunters, or add one manually."
        cols={[
          { key: "hunter", label: "Hunter", render: (r) => r.hunters?.name ?? r.hunter_id ?? "—" },
          { key: "property", label: "Property", render: (r) => r.properties?.title ?? r.property_id ?? "—" },
          { key: "match_score", label: "Score", render: (r) => r.match_score != null ? `${r.match_score}%` : "—" },
          { key: "notes", label: "Notes", render: (r) => r.notes ?? "—" },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status ?? "Pending"} /> },
          {
            key: "actions", label: "Actions", render: (r) => (
              <RowActions
                actions={
                  String(r.status || "").toLowerCase() === "pending"
                    ? [
                        { label: "Accept", tone: "success", onClick: () => onUpdateStatus("property_matches", r.id, "Accepted") },
                        { label: "Reject", tone: "danger", onClick: () => onUpdateStatus("property_matches", r.id, "Rejected") },
                      ]
                    : []
                }
              />
            ),
          },
        ]}
        rows={matches}
      />
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────────── */
export default function BrokerDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTabState] = useState(() => {
    const p = searchParams.get("tab") || new URLSearchParams(window.location.search).get("tab");
    return NAV_ITEMS.some((n) => n.id === p) ? p : "dashboard";
  });

  const setTab = useCallback((id) => {
    setTabState(id);
    if (id === "dashboard") setSearchParams({}, { replace: true });
    else setSearchParams({ tab: id }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    const p = searchParams.get("tab");
    const next = p && NAV_ITEMS.some((n) => n.id === p) ? p : "dashboard";
    setTabState(next);
  }, [searchParams]);

  const [hunters,    setHunters]    = useState([]);
  const [properties, setProperties] = useState([]);
  const [followups,  setFollowups]  = useState([]);
  const [tasks,      setTasks]      = useState([]);
  const [visits,     setVisits]     = useState([]);
  const [matches,    setMatches]    = useState([]);
  const [whatsappLeads, setWhatsappLeads] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [showAddListing, setShowAddListing] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [openForm, setOpenForm] = useState(null); // "hunter" | "followup" | "task" | "visit" | "match" | null

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [
        { data: h }, { data: p }, { data: f },
        { data: t }, { data: v }, { data: m }, { data: w },
      ] = await Promise.all([
        supabase.from("hunters").select("*").order("created_at", { ascending: false }),
        supabase.from("properties").select("*").order("created_at", { ascending: false }),
        supabase.from("follow_ups").select("*, hunters(name)").order("scheduled_at", { ascending: true }),
        supabase.from("tasks").select("*").order("due_date", { ascending: true }),
        supabase.from("visit_schedules").select("*, hunters(name), properties(title)").order("scheduled_at", { ascending: true }),
        supabase.from("property_matches").select("*, hunters(name), properties(title)").order("match_score", { ascending: false }),
        supabase.from("broker_whatsapp_contacts").select("*").order("created_at", { ascending: false }),
      ]);
      setHunters(h ?? []);
      setProperties(p ?? []);
      setFollowups(f ?? []);
      setTasks(t ?? []);
      setVisits(v ?? []);
      setMatches(m ?? []);
      setWhatsappLeads(w ?? []);
    } catch (e) {
      setError(e?.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?next=/broker");
  }, [authLoading, user, navigate]);

  const updateStatus = useCallback(async (table, id, status) => {
    if (!isSupabaseConfigured || !supabase) return;
    const { error: updateErr } = await withSessionRetry(() =>
      supabase.from(table).update({ status: String(status || "").toLowerCase() }).eq("id", id)
    );
    if (updateErr) { setError(updateErr.message); return; }
    load();
  }, [load]);

  const FORM_CONFIG = {
    hunter:   { table: "hunters",          title: "Add Hunter",      fields: HUNTER_FIELDS,   tab: "hunters" },
    followup: { table: "follow_ups",       title: "Add Follow-up",   fields: FOLLOWUP_FIELDS, tab: "followups" },
    task:     { table: "tasks",            title: "Add Task",        fields: TASK_FIELDS,     tab: "tasks" },
    visit:    { table: "visit_schedules",  title: "Schedule Visit",  fields: VISIT_FIELDS,    tab: "visits" },
    match:    { table: "property_matches", title: "Add Match",       fields: MATCH_FIELDS,    tab: "matching" },
  };

  const norm = (s) => String(s || "").toLowerCase();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const stats = {
    hunters:          hunters.length,
    newHunters:       hunters.filter((h) => norm(h.status) === "new").length,
    properties:       properties.length,
    activeProperties: properties.filter((p) => norm(p.status) === "active" || norm(p.status) === "available").length,
    pendingFollowups: followups.filter((f) => norm(f.status) !== "done" && norm(f.status) !== "completed").length,
    activeTasks:      tasks.filter((t) => norm(t.status) !== "done" && norm(t.status) !== "completed").length,
    whatsappLeads:    whatsappLeads.length,
    whatsappLeadsWeek: whatsappLeads.filter((row) => new Date(row.created_at).getTime() >= weekAgo).length,
  };

  if (authLoading || !user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", background: PAPER, color: MUTED, fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100dvh", background: PAPER, fontFamily: "Inter, sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside
        style={{
          width: 220, flexShrink: 0, background: "#111918",
          display: "flex", flexDirection: "column",
          padding: "24px 12px",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px 28px" }}>
          <div
            style={{
              width: 28, height: 28, borderRadius: "50%",
              border: "1.5px solid #FFFEFB",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#FFFEFB",
            }}
          >
            MZ
          </div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 600, color: "#FFFEFB" }}>
            Moveazy
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={tab === item.id}
              onClick={() => setTab(item.id)}
            />
          ))}
        </nav>

        {/* User info */}
        <div style={{ borderTop: "1px solid #2a3330", paddingTop: 16, marginTop: 8 }}>
          <div style={{ fontSize: 12, color: "#8B9E99", fontWeight: 500, paddingLeft: 6, marginBottom: 8 }}>
            {user?.name || user?.email || "Broker"}
          </div>
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate("/");
            }}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 16px", borderRadius: 8,
              color: "#8B9E99", fontSize: 13, fontWeight: 500,
              background: "none", border: "none", cursor: "pointer", width: "100%",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflowY: "auto" }}>
        {/* Header */}
        <div
          style={{
            borderBottom: `1px solid ${LINE}`, padding: "20px 28px",
            background: WHITE, display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: INK, fontFamily: "Georgia, serif", margin: 0 }}>
              {NAV_ITEMS.find((n) => n.id === tab)?.label ?? "Dashboard"}
            </h1>
            {tab === "dashboard" && (
              <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>Your real estate CRM overview</div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowAddListing(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                background: RUST, color: WHITE, border: "none",
                padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add listing
            </button>
            <button
              type="button"
              onClick={load}
              style={{
                fontSize: 13, fontWeight: 600, color: MUTED, background: "none",
                border: `1px solid ${LINE}`, padding: "7px 14px", borderRadius: 8, cursor: "pointer",
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        <div style={{ padding: "28px 28px" }}>
          {!isSupabaseConfigured && (
            <div
              style={{
                background: "#FBEAE0", border: `1px solid ${RUST}`, borderRadius: 12,
                padding: "16px 20px", marginBottom: 24, fontSize: 14, color: RUST,
              }}
            >
              <strong>Supabase not configured.</strong> Add <code>VITE_SUPABASE_URL</code> and{" "}
              <code>VITE_SUPABASE_ANON_KEY</code> to <code>fe/.env</code> to connect live data.
              For now, all tables will show empty.
            </div>
          )}

          {error && (
            <div
              style={{
                background: "#fef2f2", border: "1px solid #dc2626", borderRadius: 12,
                padding: "14px 20px", marginBottom: 24, fontSize: 14, color: "#dc2626",
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: "center", padding: "64px 0", color: MUTED, fontSize: 14 }}>
              Loading data…
            </div>
          ) : (
            <>
              {tab === "dashboard"  && <DashboardPanel stats={stats} followups={followups} tasks={tasks} whatsappLeads={whatsappLeads} />}
              {tab === "hunters"    && <HuntersPanel hunters={hunters} onAdd={() => setOpenForm("hunter")} onUpdateStatus={updateStatus} />}
              {tab === "properties" && <PropertiesPanel properties={properties} onAdd={() => setShowAddListing(true)} onEdit={(p) => setEditingProperty(p)} />}
              {tab === "followups"  && <FollowupsPanel followups={followups} onAdd={() => setOpenForm("followup")} onUpdateStatus={updateStatus} />}
              {tab === "tasks"      && <TasksPanel tasks={tasks} onAdd={() => setOpenForm("task")} onUpdateStatus={updateStatus} />}
              {tab === "visits"     && <VisitsPanel visits={visits} onAdd={() => setOpenForm("visit")} onUpdateStatus={updateStatus} />}
              {tab === "matching"   && <MatchingPanel matches={matches} onAdd={() => setOpenForm("match")} onUpdateStatus={updateStatus} />}
              {tab === "whatsapp"   && <WhatsAppLeadsPanel leads={whatsappLeads} />}
            </>
          )}
        </div>
      </main>

      {showAddListing && (
        <AddListingModal
          onClose={() => setShowAddListing(false)}
          onSaved={() => { load(); setTab("properties"); }}
        />
      )}

      {editingProperty && (
        <EditPropertyModal
          property={editingProperty}
          onClose={() => setEditingProperty(null)}
          onSaved={() => { load(); setEditingProperty(null); }}
        />
      )}

      {openForm && (
        <EntityFormModal
          table={FORM_CONFIG[openForm].table}
          title={FORM_CONFIG[openForm].title}
          fields={FORM_CONFIG[openForm].fields}
          context={{ hunters, properties }}
          onClose={() => setOpenForm(null)}
          onSaved={() => { load(); setTab(FORM_CONFIG[openForm].tab); setOpenForm(null); }}
        />
      )}
    </div>
  );
}
