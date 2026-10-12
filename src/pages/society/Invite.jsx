/**
 * Screen 9 — Invite Member: a link for this society and a role. WhatsApp,
 * copy, SMS, or the phone's own share sheet. The invitee opens it, signs in
 * and joins this society with that role — never another one.
 */
import { useEffect, useState } from "react";
import { Copy, MessageSquareText, MoreHorizontal, Users } from "lucide-react";
import { ROLES, createSocietyInvite, inviteUrl, societyError } from "../../lib/society";
import { WhatsAppIcon } from "../partners/partnerUi";
import { useSociety } from "./SocietyApp";
import { FormHead, Loading, Seg, toast } from "./societyUi";

export default function Invite() {
  const { society, member } = useSociety();
  const [role, setRole] = useState("guard");
  const [links, setLinks] = useState({});
  const [err, setErr] = useState("");

  useEffect(() => {
    if (links[role]) return;
    setErr("");
    createSocietyInvite(role).then((r) => setLinks((l) => ({ ...l, [role]: inviteUrl(r.token) })), (e) => setErr(societyError(e)));
  }, [role, links]);

  if (member.role !== "manager") return <div className="sx-page"><FormHead title="Invite Member" /><p className="sx-sub">Only a manager can invite members.</p></div>;
  const url = links[role];
  const msg = `Join ${society.name} on MovEazy Society as ${ROLES[role]} — add available flats and earn when they're rented.\n${url}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast("Link copied"); } catch { toast("Couldn't copy — press and hold the link to copy it", "error"); }
  };
  const more = async () => {
    try {
      if (navigator.share) await navigator.share({ title: `Join ${society.name}`, text: msg, url });
      else copy();
    } catch { /* closed */ }
  };

  return (
    <div className="sx-page iv">
      <style>{CSS}</style>
      <FormHead title="Invite Member" />
      <div className="iv-ic"><Users size={34} /></div>
      <h2 className="iv-h">Invite via WhatsApp</h2>
      <p className="iv-p">Share this link with guards or staff to join {society.name}.</p>
      <div style={{ marginTop: 18 }}>
        <Seg label="Role" value={role} onChange={setRole} options={Object.entries(ROLES).map(([value, label]) => ({ value, label: value === "guard" ? "Guard" : label }))} />
      </div>
      {err && <p className="sx-err" style={{ marginTop: 10 }}>{err}</p>}
      {!url && !err ? <Loading label="Making the link…" /> : url && (
        <>
          <button type="button" className="iv-link" onClick={copy} aria-label="Copy link"><span>{url.replace(/^https:\/\//, "")}</span><Copy size={20} /></button>
          <a className="sx-btn sx-btn--wa" style={{ marginTop: 16 }} href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">
            <WhatsAppIcon size={22} /> Share on WhatsApp
          </a>
          <div className="iv-or"><span>Or share manually</span></div>
          <div className="iv-manual">
            <button type="button" onClick={copy}><i><Copy size={22} /></i>Copy Link</button>
            <a href={`sms:?&body=${encodeURIComponent(msg)}`}><i><MessageSquareText size={22} /></i>SMS</a>
            <button type="button" onClick={more}><i><MoreHorizontal size={22} /></i>More</button>
          </div>
          <p className="sx-hint" style={{ textAlign: "center", marginTop: 18 }}>The link works for 14 days. They&apos;ll join as {ROLES[role]}.</p>
        </>
      )}
    </div>
  );
}

const CSS = `
.iv-ic { width: 84px; height: 84px; border-radius: 99px; background: var(--mint); color: var(--em); display: grid; place-items: center; margin: 22px auto 14px; }
.iv-h { text-align: center; font-size: 22px; margin: 0; }
.iv-p { text-align: center; color: var(--dim); margin: 6px auto 0; max-width: 300px; line-height: 1.45; }
.iv-link { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 18px; min-height: 56px; padding: 0 16px;
  border-radius: 14px; border: 1.5px solid var(--line); background: #fff; font-size: 15px; color: var(--ink); cursor: pointer; }
.iv-link span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.iv-link svg { color: var(--em); flex: none; }
.iv-or { display: flex; align-items: center; gap: 12px; margin: 22px 0 14px; color: var(--dim); font-size: 14px; }
.iv-or::before, .iv-or::after { content: ""; flex: 1; height: 1px; background: var(--line); }
.iv-manual { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.iv-manual > * { display: flex; flex-direction: column; align-items: center; gap: 8px; border: 0; background: none; color: var(--dim); font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer; }
.iv-manual i { width: 60px; height: 60px; border-radius: 99px; background: #EFEBE1; color: var(--ink); display: grid; place-items: center; }
`;
