/**
 * Brokers → Partners → Trial Premium (partner_trial.sql): add brokers by email
 * for 30 days of every Premium feature, free (not unlimited MovEazy leads).
 * Someone not signed up yet waits as "Invited" and starts — approved — the
 * day they sign in with that email. Days left can be typed, or +10 / +20; any
 * increase pops up on their app the next time they open it.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Btn, C, Chip, Empty, shortDate } from "./crmUi";
import { formatForDisplay } from "../../lib/mobile";
import { friendlyError } from "../../lib/partners";
import { addTrialDays, addTrials, endTrial, fetchTrials, parseEmails, setTrialDays } from "../../lib/partnerTrial";

const STATUS = {
  invited: { label: "Invited · not joined yet", tone: C.gold },
  active: { label: "Active", tone: C.accent },
  ended: { label: "Ended", tone: C.coral },
  paid: { label: "Took paid Premium", tone: C.textMute },
};

/** Days left, editable in place. */
function DaysCell({ row, disabled, onSave }) {
  const [v, setV] = useState(String(row.days_left));
  useEffect(() => setV(String(row.days_left)), [row.days_left]);
  const save = () => {
    const n = Number(v);
    if (String(n) === String(row.days_left)) return;
    if (!Number.isInteger(n) || n < 0 || n > 365) { setV(String(row.days_left)); onSave(null, "Days left must be 0–365"); return; }
    onSave(n);
  };
  return (
    <input className="crm-input crm-num" type="number" min={row.status === "invited" ? 1 : 0} max={365} value={v} disabled={disabled}
      aria-label={`Days left for ${row.email}`} style={{ width: 70, padding: "4px 6px" }}
      onChange={(e) => setV(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
  );
}

export default function CrmTrialPanel({ canManage, onToast, onChanged }) {
  const [rows, setRows] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState("live");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { setRows(await fetchTrials()); setError(""); } catch (e) { setRows([]); setError(friendlyError(e, "Could not load trials.")); }
  }, []);
  useEffect(() => { if (canManage) load(); }, [canManage, load]);

  const act = async (key, fn, ok) => {
    setBusy(key);
    try {
      const r = await fn();
      await load();
      onChanged?.();
      if (ok) onToast(typeof ok === "function" ? ok(r) : ok);
    } catch (e) {
      onToast(friendlyError(e), "error");
    } finally {
      setBusy("");
    }
  };

  const add = () => {
    const emails = parseEmails(text);
    if (!emails.length) { onToast("Paste one or more emails", "error"); return; }
    act("add", () => addTrials(emails), (r) => {
      setText("");
      const skipped = (r?.skipped ?? []).map((s) => `${s.email} (${s.why})`).join(", ");
      return `${r?.added ?? 0} added · ${r?.started ?? 0} started now${r?.added - r?.started > 0 ? ` · ${r.added - r.started} waiting to sign up` : ""}${skipped ? ` · skipped: ${skipped}` : ""}`;
    });
  };

  const counts = useMemo(() => {
    const c = { live: 0, invited: 0, active: 0, ended: 0, paid: 0, all: rows?.length ?? 0 };
    for (const r of rows ?? []) { c[r.status] += 1; if (r.status === "invited" || r.status === "active") c.live += 1; }
    return c;
  }, [rows]);
  const shown = (rows ?? []).filter((r) => filter === "all" || (filter === "live" ? ["invited", "active"].includes(r.status) : r.status === filter));

  if (!canManage) {
    return <div className="crm-mute" style={{ fontSize: 12 }}>Trial Premium needs the partners.manage permission.</div>;
  }

  return (
    <div className="crm-card" style={{ display: "grid", gap: 10, background: C.bg }}>
      <div>
        <span style={{ fontWeight: 800, fontSize: 14 }}>Trial Premium</span>
        <span className="crm-mute" style={{ display: "block", fontSize: 11.5, lineHeight: 1.5 }}>
          30 days of every Premium feature, free — except unlimited MovEazy leads (they get the free 10 and the ₹2,000 pack like
          any free partner). Not signed up yet? They start the day they sign in with that email. Any days you add pop up on their app.
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
        <textarea className="crm-input" rows={2} style={{ flex: "1 1 260px", resize: "vertical" }}
          placeholder="Partner emails — one or many, separated by commas or new lines"
          value={text} onChange={(e) => setText(e.target.value)} />
        <Btn variant="primary" disabled={busy === "add" || !text.trim()} onClick={add}>{busy === "add" ? "Adding…" : "Start Trial Premium"}</Btn>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[["live", "Invited + active"], ["active", "Active"], ["invited", "Invited"], ["ended", "Ended"], ["paid", "Took paid"], ["all", "All"]].map(([k, label]) => (
          <Chip key={k} on={filter === k} onClick={() => setFilter(k)}>{label} · {counts[k]}</Chip>
        ))}
      </div>

      {rows === null ? <Empty pad={16}>Loading…</Empty> : error ? <Empty pad={16}>{error}</Empty> : shown.length === 0 ? (
        <Empty pad={16}>{rows.length ? "Nobody here." : "No trials yet — add a partner's email above."}</Empty>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="crm-table">
            <thead>
              <tr><th>Partner</th><th>Status</th><th>Started</th><th>Ends</th><th>Days left</th><th /></tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const st = STATUS[r.status];
                const live = r.status === "invited" || r.status === "active" || r.status === "ended";
                return (
                  <tr key={r.email}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.name || r.email}</div>
                      <div className="crm-mute" style={{ fontSize: 11 }}>{[r.name ? r.email : "", r.phone ? formatForDisplay(r.phone) : "", r.agency].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td><span style={{ color: st.tone, fontWeight: 700 }}>{st.label}</span></td>
                    <td className="crm-mute crm-num">{r.started_at ? shortDate(r.started_at) : "—"}</td>
                    <td className="crm-mute crm-num">{r.ends_at && r.status !== "invited" ? shortDate(r.ends_at) : "—"}</td>
                    <td>
                      {r.status === "paid" ? <span className="crm-mute">—</span> : (
                        <DaysCell row={r} disabled={!!busy}
                          onSave={(n, err) => (err ? onToast(err, "error")
                            : act(r.email, () => setTrialDays(r.email, n), `${r.name || r.email}: ${n} day${n === 1 ? "" : "s"} left`))} />
                      )}
                    </td>
                    <td>
                      {live && (
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          <Btn sm disabled={!!busy} onClick={() => act(r.email, () => addTrialDays(r.email, 10), `+10 days for ${r.name || r.email}`)}>+10</Btn>
                          <Btn sm disabled={!!busy} onClick={() => act(r.email, () => addTrialDays(r.email, 20), `+20 days for ${r.name || r.email}`)}>+20</Btn>
                          {r.status !== "ended" && (
                            <Btn sm disabled={!!busy}
                              onClick={() => window.confirm(r.status === "invited" ? `Remove ${r.email} from the trial list?` : `End ${r.name || r.email}'s Trial Premium now?`)
                                && act(r.email, () => endTrial(r.email), r.status === "invited" ? "Invite removed" : "Trial ended")}>
                              {r.status === "invited" ? "Remove" : "End trial"}
                            </Btn>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
