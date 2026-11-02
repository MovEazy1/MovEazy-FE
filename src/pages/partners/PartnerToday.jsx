/**
 * Leads → Today: the MovEazy clients to call today (lib/followUps.js,
 * crm_follow_ups.sql) — overdue first, then today's, then later. Every call
 * ends in an outcome and the next date, which the MovEazy team sees at once
 * (and holds the partner to: act within 24 hours of getting a client).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Phone } from "lucide-react";
import { Chip, Empty, Loading, Sheet, WhatsAppIcon, toast } from "./partnerUi";
import { friendlyError, waLink } from "../../lib/partners";
import { logReachOut } from "../../lib/partnerLeads";
import { OUTCOMES, endsSearch, fetchPartnerFollowUps, partnerBucket, quickPicks, savePartnerFollowUp, suggestedNext } from "../../lib/followUps";

const GROUPS = [["overdue", "Overdue"], ["today", "Today"], ["later", "Later"]];
const dateOf = (d) => (d ? new Date(d).toLocaleDateString("en-CA") : "");
const dayLabel = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "");

function LogCall({ row, onClose, onSaved }) {
  const [now] = useState(() => Date.now());
  const [outcome, setOutcome] = useState("");
  const [next, setNext] = useState(row.follow_up_on || "");
  const [note, setNote] = useState(row.follow_up_note || "");
  const [busy, setBusy] = useState(false);
  const picks = useMemo(() => quickPicks(now).filter((p) => p.id !== "evening"), [now]);
  const ends = endsSearch(outcome);
  const pick = (id) => {
    setOutcome(id);
    if (endsSearch(id)) { setNext(""); return; }
    const s = suggestedNext(id, now);
    if (s) setNext(dateOf(s));
  };
  const save = async () => {
    if (!outcome) { toast("Pick how the call went", "error"); return; }
    if (!ends && !next) { toast("Pick the next follow-up date", "error"); return; }
    setBusy(true);
    try {
      await savePartnerFollowUp(row.assignment_id, outcome, ends ? "" : next, note.trim());
      toast(ends ? "Saved" : `Next follow-up ${dayLabel(next)}`);
      onSaved();
    } catch (e) {
      toast(friendlyError(e), "error");
      setBusy(false);
    }
  };
  return (
    <Sheet title={`Log call · ${row.name || "Client"}`} onClose={onClose}>
      <div style={{ padding: "4px 16px 18px", display: "grid", gap: 14 }}>
        <div>
          <span className="pz-label">How did it go?</span>
          <div className="pz-chips">{OUTCOMES.map((o) => <Chip key={o.id} on={outcome === o.id} onClick={() => pick(o.id)}>{o.label}</Chip>)}</div>
        </div>
        {!ends && (
          <div>
            <span className="pz-label">Next follow-up</span>
            <div className="pz-chips" style={{ marginBottom: 8 }}>
              {picks.map((p) => <Chip key={p.id} on={next === dateOf(p.at)} onClick={() => setNext(dateOf(p.at))}>{p.label}</Chip>)}
            </div>
            <input type="date" className="pz-input" value={next} min={dateOf(now)} onChange={(e) => setNext(e.target.value)} />
          </div>
        )}
        <div>
          <span className="pz-label">Note</span>
          <textarea className="pz-textarea" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did they say?" />
        </div>
        <button type="button" className="pz-btn pz-btn--primary pz-btn--block" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </Sheet>
  );
}

export default function PartnerToday({ me, onCount }) {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);
  const load = useCallback(() => fetchPartnerFollowUps().then((r) => { setRows(r); }, () => setRows([])), []);
  useEffect(() => { load(); }, [load]);
  const [now] = useState(() => Date.now());
  const grouped = useMemo(() => {
    const g = { overdue: [], today: [], later: [] };
    for (const r of rows ?? []) g[partnerBucket(r, now)].push(r);
    return g;
  }, [rows, now]);
  useEffect(() => { if (rows) onCount?.(grouped.overdue.length + grouped.today.length); }, [rows, grouped, onCount]);

  if (!rows) return <Loading />;
  if (!rows.length) return <div className="pz-pad"><Empty>No MovEazy clients to follow up. New ones the team gives you show up here.</Empty></div>;

  const reach = (r, channel) => {
    if (channel === "whatsapp") {
      window.open(waLink(r.phone, `Hi ${String(r.name || "").split(" ")[0] || "there"}, this is ${me?.name || "your broker"} from MovEazy Partners — following up on your flat search.`), "_blank", "noopener");
    }
    logReachOut(r.assignment_id, channel).catch(() => {});
  };

  return (
    <div className="pz-pad" style={{ display: "grid", gap: 14 }}>
      {GROUPS.map(([id, label]) => grouped[id].length > 0 && (
        <section key={id}>
          <h3 style={{ margin: "0 0 8px", fontSize: 14, color: id === "overdue" ? "#B42318" : "var(--ink)" }}>{label} · {grouped[id].length}</h3>
          <div className="pz-card">
            {grouped[id].map((r) => (
              <div key={r.assignment_id} style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", display: "grid", gap: 8 }}>
                <div>
                  <strong style={{ fontSize: 15 }}>{r.name || "Tenant"}</strong>
                  <div style={{ fontSize: 12.5, color: "var(--mute)" }}>{r.need || "Requirement not filled"}</div>
                  <div style={{ fontSize: 12.5, color: "var(--mute)", marginTop: 2 }}>
                    {[r.follow_up_on ? `Follow up ${dayLabel(r.follow_up_on)}` : r.last_action_at ? "" : "Not called yet",
                      r.last_outcome ? `Last: ${r.last_outcome}` : ""].filter(Boolean).join(" · ")}
                  </div>
                  {r.follow_up_note && <div style={{ fontSize: 13, marginTop: 2 }}>“{r.follow_up_note}”</div>}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a className="pz-btn pz-btn--sm" href={`tel:+91${String(r.phone).replace(/\D/g, "").slice(-10)}`} onClick={() => reach(r, "call")}><Phone size={15} /> Call</a>
                  <button type="button" className="pz-btn pz-btn--sm" onClick={() => reach(r, "whatsapp")}><WhatsAppIcon size={15} /> WhatsApp</button>
                  <button type="button" className="pz-btn pz-btn--sm pz-btn--primary" onClick={() => setOpen(r)}><CalendarClock size={15} /> Log call</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      {open && <LogCall row={open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load(); }} />}
    </div>
  );
}
