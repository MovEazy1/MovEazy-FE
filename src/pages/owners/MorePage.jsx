/**
 * PRD 12 — More. Bank details are out with the rest of rent handling; Refer a
 * Friend waits until there is a referral programme ("only if active"); App
 * Settings has nothing worth a screen yet.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Bell, Building2, ChevronRight, FileText, LayoutDashboard, LifeBuoy, LogOut, Pencil, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useOwner } from "./OwnerApp";
import { Avatar, Confirm, Sheet, TopBar, toast } from "./ownerUi";
import { PUBLIC_ORIGIN, fmtDate, friendlyError, isOwnerHost, op, registerOwner, teamWa } from "../../lib/owners";
import { formatForDisplay } from "../../lib/mobile";

function EditName({ owner, onClose, onSaved }) {
  const [name, setName] = useState(owner?.name || "");
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await registerOwner(name.trim());
      await onSaved();
      toast("Profile updated");
      onClose();
    } catch (err) {
      toast(friendlyError(err), "error");
      setBusy(false);
    }
  };
  return (
    <Sheet title="Edit profile" onClose={onClose}>
      <form className="oz-pad" onSubmit={save}>
        <label className="oz-label" htmlFor="ep-name">Name</label>
        <input id="ep-name" className="oz-input" value={name} onChange={(e) => setName(e.target.value)} />
        <p className="oz-hint">Your mobile number is the one on your MovEazy account.</p>
        <button type="submit" className="oz-btn oz-btn--primary oz-btn--block" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </form>
    </Sheet>
  );
}

export default function MorePage() {
  const { logout } = useAuth();
  const { me, reloadMe, properties, tenants } = useOwner();
  const [edit, setEdit] = useState(false);
  const [bye, setBye] = useState(false);
  const o = me?.owner;

  const row = (to, Icon, label, sub, external) => {
    const inner = <><Icon size={19} /><span style={{ flex: 1 }}>{label}{sub && <span className="oz-sub">{sub}</span>}</span><ChevronRight size={18} color="#94A09B" /></>;
    return external
      ? <a className="oz-menurow" href={to} target="_blank" rel="noreferrer">{inner}</a>
      : <Link className="oz-menurow" to={to}>{inner}</Link>;
  };

  return (
    <>
      <TopBar title="More" />
      <div className="oz-pad">
        <div className="oz-section oz-row">
          <Avatar name={o?.name || "You"} size="lg" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: 17 }}>{o?.name || "Owner"}</strong>
            <span className="oz-meta oz-row" style={{ gap: 5 }}><BadgeCheck size={15} color="var(--em)" /> Property Owner · Verified</span>
            <span className="oz-hint" style={{ display: "block" }}>{[formatForDisplay(o?.phone), o?.email].filter(Boolean).join(" · ")}</span>
            {o?.approved_at && <span className="oz-hint">Member since {fmtDate(o.approved_at, { month: "short", year: "numeric" })}</span>}
          </div>
          <button type="button" className="oz-iconbtn" aria-label="Edit profile" onClick={() => setEdit(true)}><Pencil size={18} /></button>
        </div>

        <div className="oz-card" style={{ marginBottom: 12 }}>
          {row(op("/properties"), Building2, "My Properties", `${(properties ?? []).length} in your account`)}
          {row(op("/tenants"), Users, "My Tenants", `${tenants.filter((t) => t.status === "active" || t.status === "invited").length} current`)}
          {row(op("/documents"), FileText, "Documents", "Rental agreements, verification, move-in photos")}
          {row(op("/notifications"), Bell, "Notifications", "Visits, interest and repair updates")}
        </div>
        <div className="oz-card" style={{ marginBottom: 12 }}>
          {row(teamWa("Hi MovEazy, I need help with the owner app."), LifeBuoy, "Help & Support", "Chat with the MovEazy team on WhatsApp", true)}
          {row(teamWa("Hi MovEazy, I've listed a flat with your team before — please link it to my owner account."), Building2,
            "Link a flat MovEazy listed for you", "We'll add it to your account", true)}
          {me?.staff && row(`${isOwnerHost() ? PUBLIC_ORIGIN : ""}/crm/ops`, LayoutDashboard, "Open Inventory Ops", "Requests, owners and the service catalogue", true)}
        </div>
        <div className="oz-card">
          <button type="button" className="oz-menurow" style={{ color: "var(--red)" }} onClick={() => setBye(true)}><LogOut size={19} /> Logout</button>
        </div>
      </div>
      {edit && <EditName owner={o} onClose={() => setEdit(false)} onSaved={reloadMe} />}
      {bye && <Confirm title="Log out?" confirmLabel="Log out" danger onClose={() => setBye(false)} onConfirm={() => logout()} body="You can sign back in with Google any time." />}
    </>
  );
}
