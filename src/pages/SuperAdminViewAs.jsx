/**
 * moveazy.co.in/unique-login-link-master-data-super-admin — the super admin's
 * private portal for viewing the site as any user (lib/viewAs.js, view_as.sql).
 *
 * Never linked from anywhere. Anyone but the super admin (signed out
 * included) is sent home, as with any address the site doesn't know.
 *
 *   search      part of an email, name or phone → accounts, with what each is
 *   open        pick one of their apps; the site becomes them, view-only
 *   after exit  ?done=<session>: what was changed, with Revert all / Keep
 *   history     every session, its changes, and Revert for ones kept
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { ArrowRight, History, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { isSuperAdminEmail } from "../lib/adminAccess";
import { isViewingAs } from "../lib/viewAsState";
import {
  appsFor, fetchViewAsChanges, fetchViewAsHistory, keepViewAsChanges, revertViewAs, searchUsers, startViewAs,
} from "../lib/viewAs";

const ROLE_LABEL = { tenant: "Tenant", owner: "Owner", partner: "Partner", society: "Society", crm: "CRM" };
const OP = { INSERT: "Added", UPDATE: "Changed", DELETE: "Removed" };

function ago(at) {
  if (!at) return "never";
  const s = (Date.now() - new Date(at).getTime()) / 1000;
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
const when = (at) => (at ? new Date(at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");
const tableLabel = (t) => String(t || "").replace(/_/g, " ");

export default function SuperAdminViewAs() {
  const { user, loading } = useAuth();
  // Nothing to see here for anyone else — and nothing while the admin is someone else.
  if (loading) return null;
  if (!user || !isSuperAdminEmail(user.email) || isViewingAs()) return <Navigate to="/" replace />;
  return <Portal />;
}

function Portal() {
  const [params, setParams] = useSearchParams();
  const done = params.get("done");
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState(null);
  const [opening, setOpening] = useState("");
  const [err, setErr] = useState("");
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex, nofollow";
    document.head.appendChild(m);
    const title = document.title;
    document.title = "MovEazy";
    return () => { m.remove(); document.title = title; };
  }, []);

  const loadHistory = useCallback(() => fetchViewAsHistory().then(setHistory, (e) => setErr(e.message)), []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return undefined; }
    let alive = true;
    setSearching(true);
    const t = setTimeout(() => {
      searchUsers(term).then((r) => { if (alive) setResults(r); }, (e) => alive && setErr(e.message))
        .finally(() => alive && setSearching(false));
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const open = async (u, path) => {
    setErr("");
    setOpening(path);
    try {
      await startViewAs(u, path);
    } catch (e) {
      setErr(e.message);
      setOpening("");
    }
  };

  return (
    <div style={S.page}>
      <div style={S.col}>
        <header style={S.header}>
          <ShieldCheck size={22} />
          <div>
            <h1 style={S.h1}>View as a user</h1>
            <p style={S.mute}>See exactly what anyone sees. View-only unless you allow actions; everything you change can be reverted.</p>
          </div>
        </header>

        {done && (
          <AfterExit session={done} idle={params.get("idle") === "1"} onDone={() => { setParams({}, { replace: true }); loadHistory(); }} />
        )}

        <section style={S.card}>
          <label style={S.search}>
            <Search size={18} color="#6B7280" />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); }}
              placeholder="Email, name or phone" style={S.input} aria-label="Find a user" />
          </label>
          {err && <div style={S.err}>{err}</div>}
          {q.trim().length >= 2 && !searching && results.length === 0 && <p style={S.mute}>No account matches “{q.trim()}”.</p>}
          <div style={{ display: "grid", gap: 6, marginTop: results.length ? 10 : 0 }}>
            {results.map((u) => (
              <div key={u.id} style={{ ...S.row, ...(picked?.id === u.id ? S.rowOn : null) }}>
                <button type="button" style={S.rowBtn} onClick={() => setPicked(picked?.id === u.id ? null : u)}>
                  <div style={{ minWidth: 0 }}>
                    <div style={S.rowName}>{u.name || u.email}</div>
                    <div style={S.mute}>{u.email}{u.phone ? ` · ${u.phone}` : ""} · active {ago(u.last_active)}</div>
                  </div>
                  <div style={S.badges}>
                    {u.roles.map((r) => <span key={r} style={{ ...S.badge, ...(BADGE[r] || null) }}>{ROLE_LABEL[r] || r}</span>)}
                  </div>
                </button>
                {picked?.id === u.id && (
                  <div style={S.launch}>
                    <span style={S.mute}>Open as {u.name || u.email}:</span>
                    <div style={S.apps}>
                      {appsFor(u.roles).map((a) => (
                        <button key={a.role} type="button" style={S.app} disabled={Boolean(opening)} onClick={() => open(u, a.path)}>
                          {opening === a.path ? "Opening…" : a.label} <ArrowRight size={14} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <HistoryList items={history} onChanged={loadHistory} />
      </div>
    </div>
  );
}

/** Back from viewing as someone: what was changed, and revert or keep it. */
function AfterExit({ session, idle, onDone }) {
  const [item, setItem] = useState(null);
  const [changes, setChanges] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetchViewAsHistory(60).then((h) => setItem(h.find((x) => x.id === session) || null), () => {});
    fetchViewAsChanges(session).then(setChanges, (e) => setErr(e.message));
  }, [session]);

  const pending = (changes || []).filter((c) => c.state === "").length;
  const uploads = item?.uploads || 0;
  if (changes && pending === 0 && uploads === 0 && !result) {
    return (
      <section style={{ ...S.card, ...S.ok }}>
        {idle ? "Switched back to your account after 30 minutes idle. " : "You're back in your own account. "}
        Nothing was changed in {item?.target_name || item?.target_email ? `${item.target_name || item.target_email}'s` : "their"} account.
        <button type="button" style={S.link} onClick={onDone}>OK</button>
      </section>
    );
  }
  if (!changes) return null;

  const revert = async () => {
    setBusy("revert");
    setErr("");
    try { setResult(await revertViewAs(session)); } catch (e) { setErr(e.message); } finally { setBusy(""); }
  };
  const keep = async () => {
    setBusy("keep");
    try { await keepViewAsChanges(session); onDone(); } catch (e) { setErr(e.message); setBusy(""); }
  };

  return (
    <section style={{ ...S.card, borderColor: "#FCA5A5" }}>
      <h2 style={S.h2}>
        {idle ? "Switched back after 30 minutes idle — " : ""}
        you changed {pending} thing{pending === 1 ? "" : "s"} in {item?.target_name || item?.target_email || "their"} account
        {uploads ? ` and uploaded ${uploads} file${uploads === 1 ? "" : "s"}` : ""}
      </h2>
      {result ? (
        <RevertResult result={result} onDone={onDone} />
      ) : (
        <>
          <ChangeList changes={changes} />
          {err && <div style={S.err}>{err}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button type="button" style={S.danger} onClick={revert} disabled={Boolean(busy)}>
              <RotateCcw size={15} /> {busy === "revert" ? "Reverting…" : "Revert all"}
            </button>
            <button type="button" style={S.ghost} onClick={keep} disabled={Boolean(busy)}>
              {busy === "keep" ? "Saving…" : "Keep changes"}
            </button>
          </div>
          <p style={S.mute}>Kept changes stay in History below, where you can still revert them later.</p>
        </>
      )}
    </section>
  );
}

function RevertResult({ result, onDone }) {
  const skipped = result.skipped || [];
  return (
    <div>
      <p style={{ margin: "6px 0" }}>
        Put back {result.reverted} change{result.reverted === 1 ? "" : "s"}
        {result.removed ? ` and removed ${result.removed} uploaded file${result.removed === 1 ? "" : "s"}` : ""}.
      </p>
      {skipped.length > 0 && (
        <div style={S.warn}>
          {skipped.length} couldn't be put back — someone changed them since. Check these by hand:
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {skipped.map((s, i) => <li key={i}>{OP[s.op]} {tableLabel(s.tbl)} {s.label ? `“${s.label}”` : ""} — {s.why}</li>)}
          </ul>
        </div>
      )}
      <button type="button" style={{ ...S.ghost, marginTop: 10 }} onClick={onDone}>Done</button>
    </div>
  );
}

function ChangeList({ changes }) {
  const [all, setAll] = useState(false);
  const shown = all ? changes : changes.slice(0, 8);
  return (
    <div style={{ marginTop: 8 }}>
      {shown.map((c) => (
        <div key={c.id} style={S.change}>
          <span style={{ ...S.op, ...(c.op === "DELETE" ? { color: "#B91C1C" } : c.op === "INSERT" ? { color: "#047857" } : null) }}>{OP[c.op]}</span>
          <span style={{ minWidth: 0 }}>
            {tableLabel(c.tbl)} {c.label ? <b>“{c.label}”</b> : null}
            {c.fields?.length ? <span style={S.mute}> · {c.fields.slice(0, 4).join(", ")}{c.fields.length > 4 ? "…" : ""}</span> : null}
            {c.state === "reverted" && <span style={S.tag}>reverted</span>}
            {c.state === "skipped" && <span style={{ ...S.tag, background: "#FEF3C7", color: "#92400E" }}>skipped</span>}
          </span>
        </div>
      ))}
      {changes.length > 8 && (
        <button type="button" style={S.link} onClick={() => setAll((a) => !a)}>{all ? "Show fewer" : `Show all ${changes.length}`}</button>
      )}
    </div>
  );
}

function HistoryList({ items, onChanged }) {
  const [openId, setOpenId] = useState(null);
  const [changes, setChanges] = useState({});
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState({});

  const toggle = async (id) => {
    setOpenId(openId === id ? null : id);
    if (!changes[id]) fetchViewAsChanges(id).then((c) => setChanges((m) => ({ ...m, [id]: c })), () => {});
  };
  const revert = async (id) => {
    if (!window.confirm("Put back everything this session changed? Rows someone changed since are left alone and listed.")) return;
    setBusy(id);
    try {
      const r = await revertViewAs(id);
      setResult((m) => ({ ...m, [id]: r }));
      setChanges((m) => ({ ...m, [id]: undefined }));
      onChanged();
    } catch (e) {
      window.alert(e.message);
    } finally {
      setBusy("");
    }
  };
  const rows = useMemo(() => items || [], [items]);

  return (
    <section style={S.card}>
      <h2 style={{ ...S.h2, display: "flex", alignItems: "center", gap: 8 }}><History size={17} /> History</h2>
      {rows.length === 0 && <p style={S.mute}>No one viewed as yet.</p>}
      {rows.map((h) => {
        const mins = h.ended_at ? Math.max(1, Math.round((new Date(h.ended_at) - new Date(h.started_at)) / 60000)) : null;
        const canRevert = h.pending > 0 || h.uploads > 0;
        return (
          <div key={h.id} style={S.hist}>
            <button type="button" style={S.histBtn} onClick={() => toggle(h.id)}>
              <div style={{ minWidth: 0 }}>
                <div style={S.rowName}>{h.target_name || h.target_email}</div>
                <div style={S.mute}>
                  {when(h.started_at)}{mins ? ` · ${mins} min` : " · open"}{h.end_reason === "idle" ? " · ended idle" : ""}
                  {" · "}{h.acted ? "actions allowed" : "view-only"}
                </div>
              </div>
              <span style={S.mute}>
                {h.changes ? `${h.changes} change${h.changes === 1 ? "" : "s"}` : "no changes"}
                {h.outcome ? ` · ${h.outcome}` : canRevert ? " · not reverted" : ""}
              </span>
            </button>
            {openId === h.id && (
              <div style={{ padding: "4px 10px 10px" }}>
                {result[h.id] ? <RevertResult result={result[h.id]} onDone={() => setResult((m) => ({ ...m, [h.id]: undefined }))} />
                  : changes[h.id] ? (changes[h.id].length ? <ChangeList changes={changes[h.id]} /> : <p style={S.mute}>Nothing was changed.</p>)
                    : <p style={S.mute}>Loading…</p>}
                {canRevert && !result[h.id] && (
                  <button type="button" style={{ ...S.danger, marginTop: 10 }} disabled={busy === h.id} onClick={() => revert(h.id)}>
                    <RotateCcw size={15} /> {busy === h.id ? "Reverting…" : "Revert this session"}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

const BADGE = {
  owner: { background: "#ECFDF5", color: "#065F46" },
  partner: { background: "#EFF6FF", color: "#1E40AF" },
  society: { background: "#F5F3FF", color: "#5B21B6" },
  crm: { background: "#FEF3C7", color: "#92400E" },
};

const S = {
  page: { minHeight: "100vh", background: "#F3F4F6", padding: "28px 16px 60px", fontFamily: "Manrope, Inter, system-ui, sans-serif", color: "#111827" },
  col: { maxWidth: 720, margin: "0 auto", display: "grid", gap: 14 },
  header: { display: "flex", gap: 12, alignItems: "flex-start" },
  h1: { margin: 0, fontSize: 22, fontWeight: 800 },
  h2: { margin: 0, fontSize: 15.5, fontWeight: 800, lineHeight: 1.4 },
  mute: { color: "#6B7280", fontSize: 12.5, margin: "4px 0 0", lineHeight: 1.45 },
  card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 14 },
  ok: { borderColor: "#A7F3D0", background: "#ECFDF5", fontSize: 14 },
  search: { display: "flex", alignItems: "center", gap: 10, border: "1.5px solid #D1D5DB", borderRadius: 12, padding: "10px 12px" },
  input: { border: 0, outline: "none", font: "inherit", fontSize: 16, flex: 1, minWidth: 0, background: "transparent" },
  err: { marginTop: 10, background: "#FEF2F2", color: "#991B1B", borderRadius: 10, padding: "8px 10px", fontSize: 13 },
  row: { border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" },
  rowOn: { borderColor: "#111827" },
  rowBtn: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", border: 0, background: "#fff", font: "inherit", textAlign: "left", cursor: "pointer", color: "inherit" },
  rowName: { fontWeight: 800, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  badges: { display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end", flex: "none", maxWidth: "45%" },
  badge: { fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 99, background: "#F3F4F6", color: "#374151" },
  launch: { borderTop: "1px solid #E5E7EB", background: "#F9FAFB", padding: "10px 12px" },
  apps: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 },
  app: { display: "inline-flex", alignItems: "center", gap: 6, border: 0, background: "#111827", color: "#fff", borderRadius: 10, padding: "8px 12px", font: "inherit", fontSize: 13, fontWeight: 800, cursor: "pointer" },
  danger: { display: "inline-flex", alignItems: "center", gap: 6, border: 0, background: "#DC2626", color: "#fff", borderRadius: 10, padding: "9px 14px", font: "inherit", fontSize: 13.5, fontWeight: 800, cursor: "pointer" },
  ghost: { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #D1D5DB", background: "#fff", borderRadius: 10, padding: "9px 14px", font: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer", color: "#111827" },
  link: { border: 0, background: "transparent", color: "#1D4ED8", font: "inherit", fontWeight: 700, cursor: "pointer", padding: "4px 6px" },
  warn: { marginTop: 8, background: "#FFFBEB", border: "1px solid #FDE68A", color: "#78350F", borderRadius: 10, padding: 10, fontSize: 13, lineHeight: 1.45 },
  change: { display: "flex", gap: 10, padding: "6px 0", borderTop: "1px solid #F3F4F6", fontSize: 13, alignItems: "baseline" },
  op: { fontWeight: 800, fontSize: 12, width: 64, flex: "none", color: "#374151" },
  tag: { marginLeft: 6, fontSize: 10.5, fontWeight: 800, padding: "1px 6px", borderRadius: 99, background: "#ECFDF5", color: "#065F46" },
  hist: { borderTop: "1px solid #F3F4F6" },
  histBtn: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 4px", border: 0, background: "transparent", font: "inherit", textAlign: "left", cursor: "pointer", color: "inherit" },
};
