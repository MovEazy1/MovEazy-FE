/**
 * Screen 8 — Society Members: invite (managers), everyone active with their
 * role; a manager can change a role, remove someone, and set how the
 * society's share is split (equal until they do).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Phone, PieChart, Share2 } from "lucide-react";
import {
  ROLES, equalSplit, fetchSocietyMembers, setSocietySplit, societyError, sp, splitTotal, updateSocietyMember,
} from "../../lib/society";
import { useSociety } from "./SocietyApp";
import { Avatar, Loading, Sheet, TopBar, toast } from "./societyUi";

function SplitSheet({ members, onClose, onSaved }) {
  const [rows, setRows] = useState(members.map((m) => ({ member_id: m.id, name: m.name, role: m.role, pct: String(Math.round(m.pct * 100) / 100) })));
  const [busy, setBusy] = useState(false);
  const total = splitTotal(rows);
  const save = async (equal = false) => {
    setBusy(true);
    try {
      const r = await setSocietySplit(equal ? [] : rows.map((x) => ({ member_id: x.member_id, pct: Number(x.pct) || 0 })));
      toast(equal ? "Split is equal again" : "Split saved — it applies to deals closed from now");
      onSaved(r);
    } catch (e) {
      toast(societyError(e), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title="Earnings split" onClose={onClose}>
      <p className="sx-sub">How your society&apos;s share of each rental is divided. Each closed deal keeps the split it was closed with.</p>
      <div className="mb-split">
        {rows.map((x, i) => (
          <label key={x.member_id}>
            <span><b>{x.name}</b><em>{ROLES[x.role]}</em></span>
            <span className="mb-pct">
              <input inputMode="decimal" value={x.pct} aria-label={`${x.name}'s share`}
                onChange={(e) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, pct: e.target.value.replace(/[^\d.]/g, "").slice(0, 6) } : r)))} />%
            </span>
          </label>
        ))}
      </div>
      <p className={`mb-total${total === 100 ? " ok" : ""}`}>Total {total}%{total !== 100 ? " — must be 100%" : ""}</p>
      <button type="button" className="sx-btn" disabled={busy || total !== 100} onClick={() => save(false)}>{busy ? "Saving…" : "Save split"}</button>
      <button type="button" className="sx-btn sx-btn--ghost" style={{ marginTop: 10 }} disabled={busy}
        onClick={() => { const eq = equalSplit(rows.length); setRows((rs) => rs.map((r, k) => ({ ...r, pct: String(eq[k]) }))); save(true); }}>Share equally</button>
    </Sheet>
  );
}

function MemberSheet({ m, canManage, onClose, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const act = async (opts, done) => {
    setBusy(true);
    try { onChanged(await updateSocietyMember(m.id, opts)); toast(done); onClose(); } catch (e) { toast(societyError(e), "error"); } finally { setBusy(false); }
  };
  return (
    <Sheet title={m.name} onClose={onClose}>
      <p className="sx-sub">{ROLES[m.role]}{m.phone ? ` · +91 ${m.phone}` : ""}</p>
      {m.phone && !m.me && <a className="sx-btn sx-btn--ghost" style={{ marginTop: 14 }} href={`tel:+91${m.phone}`}><Phone size={18} /> Call</a>}
      {canManage && !m.me && !removing && (
        <>
          <h2 className="sx-h2">Role</h2>
          <div className="mb-roles">
            {Object.entries(ROLES).map(([k, label]) => (
              <button key={k} type="button" className={m.role === k ? "on" : ""} disabled={busy || m.role === k}
                onClick={() => act({ role: k }, `${m.name} is now ${label}`)}>{label}</button>
            ))}
          </div>
          <button type="button" className="sx-btn sx-btn--danger" style={{ marginTop: 18 }} onClick={() => setRemoving(true)}>Remove from society</button>
        </>
      )}
      {removing && (
        <>
          <p style={{ marginTop: 16, lineHeight: 1.5 }}>{m.name} loses access to the app. Flats they added and earnings they&apos;re owed stay recorded.</p>
          <button type="button" className="sx-btn sx-btn--danger" disabled={busy} onClick={() => act({ remove: true }, `${m.name} removed`)}>{busy ? "Removing…" : `Remove ${m.name}`}</button>
          <button type="button" className="sx-btn sx-btn--ghost" style={{ marginTop: 10 }} onClick={() => setRemoving(false)}>Cancel</button>
        </>
      )}
    </Sheet>
  );
}

export default function Members() {
  const { society } = useSociety();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);
  const [split, setSplit] = useState(false);

  useEffect(() => { fetchSocietyMembers().then(setData, (e) => setErr(societyError(e))); }, []);

  return (
    <div className="sx-page mb">
      <style>{CSS}</style>
      <TopBar title="Society Members" back={sp("/")} sub={`All members in ${society.name} who are part of the earnings program.`} />
      {err && <p className="sx-err">{err}</p>}
      {!data && !err ? <Loading /> : data && (
        <>
          {data.can_manage && (
            <Link to={sp("/invite")} className="sx-card mb-invite">
              <span className="mb-ic"><Share2 size={22} /></span>
              <span><b>Invite Member</b><em>Share invite link with guards and staff to join.</em></span>
              <ChevronRight size={20} className="sx-chev" />
            </Link>
          )}
          <h2 className="sx-h2" style={{ marginTop: 24 }}>Active Members ({data.members.length})</h2>
          <div className="sx-card mb-list">
            {data.members.map((m) => (
              <button key={m.id} type="button" className="mb-row" onClick={() => setOpen(m)}>
                <Avatar name={m.name} size={46} />
                <span>
                  <b>{m.name}{m.me ? " (you)" : ""}</b>
                  <em className={m.role === "manager" ? "mgr" : ""}>{ROLES[m.role]}</em>
                </span>
                <ChevronRight size={20} className="sx-chev" />
              </button>
            ))}
          </div>
          {data.can_manage && data.members.length > 1 && (
            <button type="button" className="sx-card mb-invite mb-splitbtn" onClick={() => setSplit(true)}>
              <span className="mb-ic"><PieChart size={22} /></span>
              <span><b>Earnings split</b><em>{data.split_custom ? data.members.map((m) => `${m.name.split(" ")[0]} ${Math.round(m.pct * 10) / 10}%`).join(" · ") : "Shared equally between everyone"}</em></span>
              <ChevronRight size={20} className="sx-chev" />
            </button>
          )}
        </>
      )}
      {open && <MemberSheet m={open} canManage={data?.can_manage} onClose={() => setOpen(null)} onChanged={setData} />}
      {split && data && <SplitSheet members={data.members} onClose={() => setSplit(false)} onSaved={(r) => { setData(r); setSplit(false); }} />}
    </div>
  );
}

const CSS = `
.mb-invite { display: flex; align-items: center; gap: 14px; padding: 16px; margin-top: 14px; text-decoration: none; width: 100%; text-align: left; color: inherit; cursor: pointer; }
.mb-invite > span:nth-child(2) { flex: 1; min-width: 0; }
.mb-invite b { display: block; font-size: 17px; }
.mb-invite em { font-style: normal; color: var(--dim); font-size: 14px; line-height: 1.4; }
.mb-ic { width: 52px; height: 52px; border-radius: 99px; background: var(--mint); color: var(--em); display: grid; place-items: center; flex: none; }
.mb-list { padding: 4px 0; }
.mb-row { width: 100%; display: flex; align-items: center; gap: 14px; padding: 12px 14px; border: 0; background: none; text-align: left; cursor: pointer; color: inherit; border-bottom: 1px solid #F0ECE2; }
.mb-row:last-child { border-bottom: 0; }
.mb-row > span:not(.sx-avatar) { flex: 1; min-width: 0; }
.mb-row b { display: block; font-size: 16px; }
.mb-row em { display: inline-block; margin-top: 4px; font-style: normal; font-size: 13px; font-weight: 600; padding: 3px 10px; border-radius: 99px; background: #EEEDF2; color: #575B6E; }
.mb-row em.mgr { background: var(--mint); color: var(--mintink); }
.mb-roles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.mb-roles button { min-height: 48px; border-radius: 12px; border: 1.5px solid var(--line); background: #fff; font-weight: 700; cursor: pointer; color: var(--ink); }
.mb-roles button.on { background: var(--em); color: #fff; border-color: var(--em); }
.mb-split { display: grid; gap: 8px; margin-top: 14px; }
.mb-split label { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #fff; border: 1px solid #EEE9DD; border-radius: 12px; padding: 10px 12px; }
.mb-split b { display: block; }
.mb-split em { font-style: normal; color: var(--dim); font-size: 13px; }
.mb-pct { display: flex; align-items: center; gap: 4px; font-weight: 700; }
.mb-pct input { width: 72px; min-height: 44px; border: 1.5px solid var(--line); border-radius: 10px; text-align: right; padding: 0 10px; font: inherit; font-size: 16px; }
.mb-total { text-align: right; font-weight: 700; color: #B42318; margin: 10px 0 14px; }
.mb-total.ok { color: var(--em); }
`;
