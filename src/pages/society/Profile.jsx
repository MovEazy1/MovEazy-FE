/**
 * Screen 12 — My Profile: name (tap to edit) and role; society, mobile, UPI,
 * earnings, notifications, help; society details for managers; log out
 * (confirmed).
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Building2, ChevronRight, CreditCard, HelpCircle, LogOut, Pencil, Phone, Settings2, Wallet } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ROLES, saveSocietyProfile, societyError, sp } from "../../lib/society";
import { useSociety } from "./SocietyApp";
import { Avatar, Field, HELP_WHATSAPP, Sheet, TopBar, toast } from "./societyUi";

export default function Profile() {
  const { member, society, reload, me } = useSociety();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member.name);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const saveName = async () => {
    setBusy(true);
    try { await saveSocietyProfile({ name }); await reload(); toast("Name saved"); setEditing(false); } catch (e) { toast(societyError(e), "error"); } finally { setBusy(false); }
  };

  const row = (icon, label, value, to, extra = {}) => {
    const body = <>{icon}<span className="pf-l">{label}</span>{value != null && <span className="pf-v">{value}</span>}{to && <ChevronRight size={20} className="sx-chev" />}</>;
    if (!to) return <div className="pf-row">{body}</div>;
    if (extra.href) return <a className="pf-row" href={to} target="_blank" rel="noreferrer">{body}</a>;
    return <Link className="pf-row" to={to}>{body}</Link>;
  };

  return (
    <div className="sx-page pf">
      <style>{CSS}</style>
      <TopBar title="My Profile" back={sp("/")} />
      <button type="button" className="sx-card pf-me" onClick={() => setEditing(true)}>
        <Avatar name={member.name} size={64} />
        <span><b>{member.name}</b><em>{ROLES[member.role]}</em></span>
        <Pencil size={18} className="sx-chev" aria-label="Edit name" />
      </button>
      <div className="sx-card pf-list">
        {row(<Building2 size={20} />, "Society", society.name)}
        {row(<Phone size={20} />, "Mobile Number", `+91 ${String(member.phone).replace(/(\d{5})(\d{5})/, "$1 $2")}`)}
        {row(<CreditCard size={20} />, "UPI ID", member.upi_id || "Add", sp("/upi"))}
        {row(<Wallet size={20} />, "My Earnings", null, sp("/earnings"))}
        {row(<Bell size={20} />, "Notifications", me.unread ? `${me.unread} new` : null, sp("/notifications"))}
        {member.role === "manager" && row(<Settings2 size={20} />, "Society details", society.status === "rejected" ? "Needs changes" : null, sp("/setup"))}
        {row(<HelpCircle size={20} />, "Help & Support", null,
          `https://wa.me/${HELP_WHATSAPP}?text=${encodeURIComponent(`Hi MovEazy, I need help with MovEazy Society (${society.name}).`)}`, { href: true })}
        <button type="button" className="pf-row pf-out" onClick={() => setLeaving(true)}><LogOut size={20} /><span className="pf-l">Logout</span><ChevronRight size={20} className="sx-chev" /></button>
      </div>
      <p className="sx-hint" style={{ textAlign: "center", marginTop: 16 }}>Society share: {Math.round(society.pool_pct ?? 70)}% of brokerage · Joined {new Date(member.joined_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</p>
      {editing && (
        <Sheet title="Edit profile" onClose={() => setEditing(false)}>
          <Field label="Your name"><input className="sx-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          <button type="button" className="sx-btn" style={{ marginTop: 16 }} disabled={busy || name.trim().length < 2} onClick={saveName}>{busy ? "Saving…" : "Save"}</button>
        </Sheet>
      )}
      {leaving && (
        <Sheet title="Log out?" onClose={() => setLeaving(false)}>
          <p className="sx-sub">You can sign in again any time with Google.</p>
          <button type="button" className="sx-btn" style={{ marginTop: 16 }} onClick={async () => { await logout(); navigate(sp("/"), { replace: true }); }}>Log out</button>
          <button type="button" className="sx-btn sx-btn--ghost" style={{ marginTop: 10 }} onClick={() => setLeaving(false)}>Cancel</button>
        </Sheet>
      )}
    </div>
  );
}

const CSS = `
.pf-me { width: 100%; display: flex; align-items: center; gap: 16px; padding: 18px; margin-top: 10px; text-align: left; cursor: pointer; color: inherit; }
.pf-me > span:not(.sx-avatar) { flex: 1; min-width: 0; }
.pf-me b { display: block; font-size: 19px; }
.pf-me em { font-style: normal; color: var(--dim); }
.pf-list { margin-top: 14px; padding: 4px 0; }
.pf-row { width: 100%; display: flex; align-items: center; gap: 14px; padding: 16px; border: 0; border-bottom: 1px solid #F0ECE2; background: none;
  color: var(--ink); text-decoration: none; font-size: 16px; cursor: pointer; text-align: left; }
.pf-row:last-child { border-bottom: 0; }
.pf-row > svg:first-child { color: #5E6B66; flex: none; }
.pf-l { flex: 1; }
.pf-v { color: var(--dim); font-size: 14.5px; max-width: 50%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pf-out, .pf-out > svg:first-child { color: #D92D20 !important; }
div.pf-row { cursor: default; }
`;
