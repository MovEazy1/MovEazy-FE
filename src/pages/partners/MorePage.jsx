/** More — profile, QR poster, plan, saved, help, activity. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, ChevronRight, Crown, Eye, Gift, HelpCircle, LayoutDashboard, LogOut, Pencil, QrCode, TrendingUp } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePartner } from "./PartnerApp";
import { Avatar, Sheet, TopBar, WhatsAppIcon, formatPhone, toast } from "./partnerUi";
import { MOVEAZY_TEAM_WHATSAPP } from "../../config/contactChannels";
import { PUBLIC_ORIGIN, friendlyError, hasPremium, isPartnerHost, pp, registerPartner } from "../../lib/partners";

function EditProfile({ partner, onClose, onSaved }) {
  const [name, setName] = useState(partner?.name || "");
  const [agency, setAgency] = useState(partner?.agency || "");
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await registerPartner({ name, agency });
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
      <form className="pz-pad" onSubmit={save}>
        <div className="pz-field"><label className="pz-label" htmlFor="ep-n">Name</label>
          <input id="ep-n" className="pz-input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="pz-field"><label className="pz-label" htmlFor="ep-a">Agency <span className="pz-hint">(optional)</span></label>
          <input id="ep-a" className="pz-input" value={agency} onChange={(e) => setAgency(e.target.value)} placeholder="Individual broker" /></div>
        <p className="pz-hint">Your mobile number is the one on your MovEazy account. Brokers you share with see your name, agency and number.</p>
        <button type="submit" className="pz-btn pz-btn--primary pz-btn--block" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </form>
    </Sheet>
  );
}

export default function MorePage() {
  const { logout } = useAuth();
  const { me, reloadMe, inventory, leads, groups, saved, demo, status } = usePartner();
  const [edit, setEdit] = useState(false);
  const p = me?.partner;
  const mine = (inventory ?? []).filter((l) => l.source === "mine");
  const premium = hasPremium(me);

  const row = (to, icon, label, sub, external) => {
    const inner = <>{icon}<span style={{ flex: 1 }}>{label}{sub && <span className="pz-sub">{sub}</span>}</span><ChevronRight size={18} color="#9CA3AF" /></>;
    return external
      ? <a className="pz-menurow" href={to} target="_blank" rel="noreferrer">{inner}</a>
      : <Link className="pz-menurow" to={to}>{inner}</Link>;
  };

  return (
    <>
      <TopBar title="More" />
      <div className="pz-pad">
        <div className="pz-section pz-row">
          <Avatar name={p?.name || "You"} size="lg" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: 17 }}>{p?.name || "Partner"}</strong>
            <span className="pz-meta">{[p?.agency || "Individual broker", formatPhone(p?.phone)].filter(Boolean).join(" · ")}</span>
            <span className="pz-hint" style={{ display: "block" }}>{p?.email}</span>
          </div>
          <button type="button" className="pz-iconbtn" aria-label="Edit profile" onClick={() => setEdit(true)}><Pencil size={18} /></button>
        </div>

        <div className="pz-section" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", textAlign: "center", padding: 10 }}>
          {[["Listings", mine.length], ["Leads", leads.length], ["Groups", groups.length]].map(([k, v]) => (
            <div key={k}><div style={{ fontSize: 20, fontWeight: 800 }}>{v}</div><div className="pz-meta">{k}</div></div>
          ))}
        </div>

        <div className="pz-card" style={{ marginBottom: 12 }}>
          {row(pp("/qr"), <QrCode size={19} color="var(--g)" />, "My QR poster", "Print it · see who viewed and liked your flats")}
          {row(pp("/premium"), <Crown size={19} color="#8A6419" />, premium ? "MovEazy Premium — active" : "Join Premium",
            premium ? `Plans${status?.plan?.until ? ` · till ${new Date(status.plan.until).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}` : "Unlock 1000+ listings, AI matching and groups")}
          {premium && row(pp("/referrals"), <Gift size={19} color="#8A6419" />, "Refer & Earn ₹1,500", "Per broker who joins with your link")}
          {row(pp("/saved"), <Bookmark size={19} />, "Saved properties", `${saved.size} saved`)}
          {row(`${MOVEAZY_TEAM_WHATSAPP}?text=${encodeURIComponent("Hi MovEazy, I need help with the partner app.")}`,
            <HelpCircle size={19} />, "Help", "Chat with the MovEazy team", true)}
          {me?.staff && row(`${isPartnerHost() ? PUBLIC_ORIGIN : ""}/crm/brokers`, <LayoutDashboard size={19} />, "Open CRM", "Partners, approvals and premium", true)}
          {me?.staff && row(pp("/sales-funnel"), <TrendingUp size={19} />, "Sales funnel", "Sign-ups, payments, referrals")}
          {me?.staff && (
            <a className="pz-menurow" href={`${pp("/")}?demo=${demo ? "0" : "1"}`}>
              <Eye size={19} /><span style={{ flex: 1 }}>{demo ? "Leave demo preview" : "Preview demo mode"}<span className="pz-sub">What a broker without a plan sees</span></span>
            </a>
          )}
        </div>

        <div className="pz-card">
          <a className="pz-menurow" href={`https://wa.me/?text=${encodeURIComponent(`I'm using MovEazy Partners for rental inventory — join here: ${window.location.origin}${pp("/")}`)}`}
            target="_blank" rel="noreferrer"><WhatsAppIcon /> <span style={{ flex: 1 }}>Tell a broker about MovEazy Partners</span></a>
          <button type="button" className="pz-menurow" style={{ color: "var(--red)" }} onClick={() => logout()}>
            <LogOut size={19} /> Sign out
          </button>
        </div>
      </div>
      {edit && <EditProfile partner={p} onClose={() => setEdit(false)} onSaved={reloadMe} />}
    </>
  );
}
