/** PRD 12 — groups (associations): for sharing inventory, not for chat. */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Plus, Search } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Avatar, Empty, Sheet, TopBar, toast } from "./partnerUi";
import { DEMO_GROUPS, DemoBanner } from "./demoMode";
import { createGroup, friendlyError, pp } from "../../lib/partners";

export function CreateGroupSheet({ onClose }) {
  const navigate = useNavigate();
  const { reloadGroups } = usePartner();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) return toast("Give the group a name", "error");
    setBusy(true);
    try {
      const id = await createGroup(name.trim(), desc.trim());
      await reloadGroups();
      onClose();
      toast("Group created — invite your brokers");
      navigate(pp(`/groups/${id}`));
    } catch (err) {
      toast(friendlyError(err, "Could not create the group."), "error");
      setBusy(false);
    }
  };
  return (
    <Sheet title="Create group" onClose={onClose}>
      <form className="pz-pad" onSubmit={submit}>
        <div className="pz-field">
          <label className="pz-label" htmlFor="cg-name">Group name</label>
          <input id="cg-name" className="pz-input" autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="HSR Brokers Association" />
        </div>
        <div className="pz-field">
          <label className="pz-label" htmlFor="cg-desc">About <span className="pz-hint">(optional)</span></label>
          <input id="cg-desc" className="pz-input" maxLength={400} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Rental brokers working HSR & Koramangala" />
        </div>
        <p className="pz-hint">Listings you share into this group are visible only to its members.</p>
        <button type="submit" className="pz-btn pz-btn--primary pz-btn--block" disabled={busy}>{busy ? "Creating…" : "Create group"}</button>
      </form>
    </Sheet>
  );
}

export default function GroupsList() {
  const { groups: realGroups, demo, explain } = usePartner();
  const groups = demo ? DEMO_GROUPS : realGroups;
  const [q, setQ] = useState("");
  const [creating, setCreate] = useState(false);
  const create = creating && !demo;
  const startCreate = () => (demo ? explain("create_group") : setCreate(true));
  const rows = useMemo(() => groups.filter((g) => g.name.toLowerCase().includes(q.trim().toLowerCase())), [groups, q]);

  return (
    <>
      <TopBar title="Groups" right={
        <button type="button" className="pz-btn pz-btn--primary pz-btn--sm" onClick={startCreate}><Plus size={16} /> Create</button>
      } />
      <div className="pz-pad">
        <div className="pz-search" style={{ marginBottom: 12 }}>
          <Search size={17} />
          <input className="pz-input" type="search" placeholder="Search groups…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {demo && <DemoBanner>6 sample groups, 20 listings each.</DemoBanner>}
        {rows.length === 0 ? (
          <Empty action={<button type="button" className="pz-btn pz-btn--primary" onClick={startCreate}><Plus size={16} /> Create a group</button>}>
            {groups.length ? "No group by that name." : "Groups are how your association shares inventory privately. Create one, then invite brokers on WhatsApp."}
          </Empty>
        ) : (
          <div className="pz-card">
            {rows.map((g, i) => (
              <Link key={g.id} to={pp(`/groups/${g.id}`)} onClick={g.demo ? (e) => { e.preventDefault(); explain("group"); } : undefined}
                className="pz-row" style={{ padding: 14, color: "inherit", textDecoration: "none", borderTop: i ? "1px solid var(--line)" : 0 }}>
                <span style={{ transform: "scale(1.35)", margin: "0 8px 0 4px" }}><Avatar name={g.name} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 16 }}>{g.name}</strong>
                  <span className="pz-meta">{g.member_count} member{g.member_count === 1 ? "" : "s"} • {g.property_count} propert{g.property_count === 1 ? "y" : "ies"}</span>
                </span>
                <ChevronRight size={20} color="#9CA3AF" />
              </Link>
            ))}
          </div>
        )}
      </div>
      {create && <CreateGroupSheet onClose={() => setCreate(false)} />}
    </>
  );
}
