/**
 * One group: its inventory, its members, and the WhatsApp invite.
 *
 * Any member may invite (the association grows by word of mouth); only the
 * owner and admins remove people. An invite is a single-use link valid for 7
 * days — the invitee taps it, signs in with Google, verifies their mobile, and
 * is in.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Copy, LogOut, MoreVertical, UserPlus } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Avatar, Empty, Loading, PropertyCard, Sheet, TopBar, WhatsAppIcon, formatPhone, toast } from "./partnerUi";
import {
  createInvite, customerMessage, fetchGroupMembers, friendlyError, inviteLink, inviteMessage, pp, removeMember,
  setMemberRole, waLink,
} from "../../lib/partners";

export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { me, groups, inventory, saved, toggleSave, reloadGroups, reloadInventory } = usePartner();
  const group = groups.find((g) => g.id === id);
  const [tab, setTab] = useState("inventory");
  const [members, setMembers] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [manage, setManage] = useState(null);

  const loadMembers = useCallback(() => fetchGroupMembers(id).then(setMembers, () => setMembers([])), [id]);
  useEffect(() => { loadMembers(); }, [loadMembers]);

  const listings = useMemo(() => (inventory ?? []).filter((l) => l.group_ids.includes(id)), [inventory, id]);
  const myId = me?.partner?.user_id;
  const myRole = group?.my_role;
  const canManage = myRole === "owner" || myRole === "admin" || me?.can_manage;

  if (!group) return <><TopBar title="Group" back={pp("/groups")} />{groups.length ? <Empty>You're not in this group.</Empty> : <Loading />}</>;

  const invite = async (how) => {
    setInviting(true);
    // Opened now, inside the tap, and pointed at WhatsApp once the token exists:
    // a window.open after an await is a popup, and mobile browsers block it.
    const win = how === "wa" ? window.open("", "_blank") : null;
    try {
      const token = await createInvite(id);
      if (how === "copy") {
        try { await navigator.clipboard.writeText(inviteLink(token)); toast("Invite link copied — it works once"); }
        catch { window.prompt("Copy this invite link", inviteLink(token)); }
      } else {
        const url = waLink("", inviteMessage(group.name, token, me?.partner?.name));
        if (win) win.location.href = url; else window.location.href = url;
      }
    } catch (e) {
      win?.close();
      toast(friendlyError(e, "Could not create an invite."), "error");
    } finally {
      setInviting(false);
    }
  };

  const remove = async (m) => {
    const self = m.user_id === myId;
    if (!window.confirm(self ? `Leave ${group.name}? You'll stop seeing its inventory.` : `Remove ${m.name} from ${group.name}?`)) return;
    try {
      await removeMember(id, m.user_id);
      setManage(null);
      if (self) {
        await Promise.all([reloadGroups(), reloadInventory()]);
        navigate(pp("/groups"), { replace: true });
      } else {
        await Promise.all([loadMembers(), reloadGroups()]);
        toast(`${m.name} removed`);
      }
    } catch (e) {
      toast(friendlyError(e), "error");
    }
  };

  const toggleAdmin = async (m) => {
    try {
      await setMemberRole(id, m.user_id, m.role === "admin" ? "member" : "admin");
      setManage(null);
      loadMembers();
    } catch (e) {
      toast(friendlyError(e), "error");
    }
  };

  return (
    <>
      <TopBar title={group.name} back={pp("/groups")} />
      <div className="pz-pad" style={{ background: "var(--card)" }}>
        <p className="pz-meta" style={{ margin: "0 0 12px" }}>
          {group.member_count} members • {group.property_count} properties{group.description ? ` • ${group.description}` : ""}
        </p>
        <div className="pz-row">
          <button type="button" className="pz-btn pz-wa" style={{ flex: 1 }} disabled={inviting} onClick={() => invite("wa")}>
            <WhatsAppIcon /> Invite via WhatsApp
          </button>
          <button type="button" className="pz-btn" disabled={inviting} onClick={() => invite("copy")} aria-label="Copy invite link"><Copy size={17} /></button>
        </div>
        <p className="pz-hint" style={{ margin: "8px 0 0" }}>Each invite link works once and expires in 7 days.</p>
      </div>
      <div className="pz-tabs" role="tablist">
        {[["inventory", `Inventory (${listings.length})`], ["members", `Members (${members?.length ?? group.member_count})`]].map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`pz-tab${tab === k ? " pz-tab--on" : ""}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === "inventory" ? (
        <div className="pz-pad pz-list">
          {listings.length === 0 ? (
            <Empty>Nothing shared here yet. When adding a property, pick <strong>My Groups → {group.name}</strong>.</Empty>
          ) : listings.map((l) => (
            <PropertyCard key={l.property_id} listing={l} saved={saved.has(l.property_id)} onToggleSave={() => toggleSave(l.property_id)}
              onWhatsApp={() => window.open(waLink("", customerMessage(l)), "_blank", "noopener")} />
          ))}
        </div>
      ) : (
        <div className="pz-pad">
          {members === null ? <Loading /> : (
            <div className="pz-card">
              {members.map((m, i) => (
                <div key={m.user_id} className="pz-row" style={{ padding: 12, borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <Avatar name={m.name} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: "block" }}>{m.name || "Broker"}{m.user_id === myId ? " (you)" : ""}</strong>
                    <span className="pz-meta">{[m.agency, formatPhone(m.phone)].filter(Boolean).join(" · ")}</span>
                  </span>
                  {m.role !== "member" && <span className="pz-pill" style={{ textTransform: "capitalize" }}>{m.role}</span>}
                  {m.phone && m.user_id !== myId && (
                    <a className="pz-iconbtn" href={waLink(m.phone, "Hi, ")} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${m.name}`}>
                      <WhatsAppIcon color="#16A34A" size={20} />
                    </a>
                  )}
                  {(m.user_id === myId ? m.role !== "owner" : canManage && m.role !== "owner") && (
                    <button type="button" className="pz-iconbtn" aria-label="Manage member" onClick={() => setManage(m)}><MoreVertical size={19} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
          <button type="button" className="pz-btn" style={{ width: "100%", marginTop: 12 }} onClick={() => invite("wa")} disabled={inviting}>
            <UserPlus size={17} /> Invite another broker
          </button>
        </div>
      )}

      {manage && (
        <Sheet title={manage.name || "Member"} onClose={() => setManage(null)}>
          {manage.user_id !== myId && myRole === "owner" && (
            <button type="button" className="pz-menurow" onClick={() => toggleAdmin(manage)}>
              {manage.role === "admin" ? "Remove admin rights" : "Make admin"}
              <span className="pz-sub">Admins can remove members</span>
            </button>
          )}
          <button type="button" className="pz-menurow" style={{ color: "var(--red)" }} onClick={() => remove(manage)}>
            <LogOut size={18} /> {manage.user_id === myId ? "Leave group" : "Remove from group"}
          </button>
        </Sheet>
      )}
    </>
  );
}
