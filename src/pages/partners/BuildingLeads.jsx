/**
 * Building visits — the owner properties MovEazy has assigned to this partner,
 * and every visit their QR brings in (partner_building_leads in
 * owner_buildings.sql). The partner calls the tenant, confirms a time, shares
 * the address, and says how the visit went; the owner sees the counts.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CalendarCheck, Check, ExternalLink, KeyRound, MapPin, Phone, X } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Empty, Loading, Sheet, TopBar, WhatsAppIcon, toast } from "./partnerUi";
import {
  VISIT_STATUS, buildingUrl, fetchPartnerBuildingLeads, floorLabel, updateBuildingLead, visitWhen,
} from "../../lib/buildings";
import { friendlyError, inr, telLink, waLink } from "../../lib/partners";

const TABS = [
  ["open", "To confirm", (l) => l.status === "new"],
  ["confirmed", "Confirmed", (l) => l.status === "confirmed"],
  ["done", "Done", (l) => ["visited", "no_show", "booked", "cancelled"].includes(l.status)],
];
const bhk = (f) => f?.flat_type || (f?.bedrooms ? `${f.bedrooms} BHK` : "Flat");
const TONE = { amber: ["#FFF4D6", "#9A6700"], blue: ["#E8EEFD", "#1D4ED8"], green: ["#E4F2EC", "#0B6E4F"], grey: ["#EFEDE6", "#5E6B66"], champ: ["#F6E7BF", "#7A5A12"] };

function StatusPill({ status }) {
  const st = VISIT_STATUS[status] || VISIT_STATUS.new;
  const [bg, fg] = TONE[st.tone] || TONE.grey;
  return <span style={{ background: bg, color: fg, borderRadius: 99, padding: "3px 9px", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>{st.label}</span>;
}

/** "2026-10-05T16:30" in local time, for a datetime-local input. */
function localInput(at) {
  const d = at ? new Date(at) : new Date(Date.now() + 24 * 3600e3);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BuildingLeads() {
  const { me } = usePartner();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("open");
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await fetchPartnerBuildingLeads()); setErr(""); } catch (e) { setErr(friendlyError(e, "Could not load building visits.")); setData({ buildings: [], leads: [] }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const byId = useMemo(() => new Map((data?.buildings ?? []).map((b) => [b.id, b])), [data]);
  const leads = data?.leads ?? [];
  const counts = Object.fromEntries(TABS.map(([k, , fn]) => [k, leads.filter(fn).length]));
  const shown = leads.filter(TABS.find(([k]) => k === tab)[2]).sort((a, b) =>
    tab === "done" ? new Date(b.updated_at) - new Date(a.updated_at)
      : (a.visit_at ? new Date(a.visit_at).getTime() : Infinity) - (b.visit_at ? new Date(b.visit_at).getTime() : Infinity));

  const update = async (lead, patch, ok) => {
    setBusy(true);
    try {
      await updateBuildingLead(lead.id, patch);
      await load();
      toast(ok);
      setOpen(null);
    } catch (e) {
      toast(friendlyError(e, "Could not save that."), "error");
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <><TopBar title="Building visits" back /><Loading /></>;
  return (
    <>
      <TopBar title="Building visits" back />
      <div className="pz-pad">
        {err && <Empty>{err}</Empty>}
        {(data.buildings ?? []).length === 0 ? (
          <Empty>
            No owner properties assigned to you yet. When MovEazy assigns one, every visit its QR brings in lands here — with the tenant's number.
          </Empty>
        ) : (
          <>
            <div className="bl2-props">
              {data.buildings.map((b) => (
                <div key={b.id} className="pz-card bl2-prop">
                  <div className="pz-row" style={{ gap: 8 }}>
                    <span className="bl2-ic"><Building2 size={16} /></span>
                    <b style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</b>
                    <a href={buildingUrl(b.code)} target="_blank" rel="noreferrer" aria-label="Open QR page"><ExternalLink size={15} /></a>
                  </div>
                  <div className="pz-meta" style={{ fontSize: 12, marginTop: 2 }}><MapPin size={11} /> {b.area || "Bengaluru"} · {(b.flats ?? []).filter((f) => f.available).length}/{(b.flats ?? []).length} free</div>
                  <div className="bl2-stats">
                    <span><b>{b.stats?.scans ?? 0}</b> scans</span><span><b>{b.stats?.numbers ?? 0}</b> leads</span><span><b>{b.stats?.booked ?? 0}</b> booked</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pz-chips pz-chips--scroll" style={{ margin: "14px 0 10px" }}>
              {TABS.map(([k, label]) => (
                <button key={k} type="button" className={`pz-chip${tab === k ? " pz-chip--on" : ""}`} onClick={() => setTab(k)}>{label} ({counts[k]})</button>
              ))}
            </div>

            {shown.length === 0 ? <Empty>{tab === "open" ? "All caught up — no requests waiting." : "Nothing here yet."}</Empty> : shown.map((l) => {
              const b = byId.get(l.building_id);
              const flats = (l.property_ids ?? []).map((pid) => (b?.flats ?? []).find((f) => f.property_id === pid)).filter(Boolean);
              const msg = `Hi ${l.name.split(" ")[0] || ""}, this is ${me?.partner?.name || "your MovEazy partner"} from MovEazy. `
                + `About your visit to ${b?.name || "the property"}${l.visit_at ? ` on ${visitWhen(l.visit_at)}` : ""} — `
                + `${b?.full_address ? `the address is ${b.full_address}${b.landmark ? ` (${b.landmark})` : ""}. ` : ""}See you there!`;
              return (
                <div key={l.id} className="pz-section bl2-lead">
                  <div className="pz-row" style={{ alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: 15.5 }}>{l.name}</b>
                      <div className="pz-meta">{l.phone.replace(/(\d{5})(\d{5})/, "$1 $2")} · {b?.name}</div>
                    </div>
                    <StatusPill status={l.status} />
                  </div>
                  <div className="bl2-when"><CalendarCheck size={15} /> {visitWhen(l.visit_at)}</div>
                  {flats.length > 0 && (
                    <div className="pz-chips" style={{ gap: 6, marginTop: 8 }}>
                      {flats.map((f) => <span key={f.property_id} className="pz-chip pz-chip--soft" style={{ padding: "4px 10px", fontSize: 12 }}>
                        {bhk(f)} · {floorLabel(f.floor_number).replace(" floor", "")} · {f.rent ? inr(f.rent) : ""}</span>)}
                    </div>
                  )}
                  {l.note && <div className="pz-meta" style={{ marginTop: 8, fontStyle: "italic" }}>“{l.note}”</div>}
                  <div className="bl2-actions">
                    <a className="pz-btn pz-btn--sm" href={telLink(l.phone)}><Phone size={15} /> Call</a>
                    <a className="pz-btn pz-btn--sm pz-wa" href={waLink(l.phone, msg)} target="_blank" rel="noreferrer"><WhatsAppIcon size={15} /> WhatsApp</a>
                    <button type="button" className="pz-btn pz-btn--sm pz-btn--primary" onClick={() => setOpen(l)}>Update</button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
      {open && <UpdateSheet lead={open} building={byId.get(open.building_id)} busy={busy} onClose={() => setOpen(null)} onSave={update} />}
      <style>{`
        .bl2-props { display: flex; gap: 10px; overflow-x: auto; scrollbar-width: none; }
        .bl2-props::-webkit-scrollbar { display: none; }
        .bl2-prop { flex: 0 0 230px; padding: 12px; }
        .bl2-prop a { color: var(--g); display: grid; place-items: center; }
        .bl2-ic { width: 28px; height: 28px; border-radius: 9px; background: var(--noir); color: var(--gold); display: grid; place-items: center; flex: none; }
        .bl2-stats { display: flex; gap: 12px; margin-top: 8px; font-size: 11.5px; color: var(--mute, #6B7280); }
        .bl2-stats b { color: var(--ink); font-size: 14px; }
        .bl2-when { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; background: var(--gold2); color: var(--gold3); font-weight: 700;
          font-size: 13px; border-radius: 99px; padding: 5px 11px; }
        .bl2-actions { display: grid; grid-template-columns: 1fr 1.3fr 1fr; gap: 8px; margin-top: 12px; }
        .bl2-pick { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 12px; background: #fff;
          font: inherit; color: inherit; cursor: pointer; text-align: left; margin-bottom: 8px; }
        .bl2-pick.on { border-color: var(--g); background: var(--gl); }
      `}</style>
    </>
  );
}

function UpdateSheet({ lead, building, busy, onClose, onSave }) {
  const [when, setWhen] = useState(() => localInput(lead.visit_at));
  const [mode, setMode] = useState("");
  const [flat, setFlat] = useState((lead.property_ids ?? []).length === 1 ? lead.property_ids[0] : "");
  const flats = (building?.flats ?? []).filter((f) => f.available || f.property_id === lead.booked_property);
  return (
    <Sheet title={`${lead.name} · ${building?.name || ""}`} onClose={onClose}>
      <div className="pz-pad">
        {mode !== "book" ? (
          <>
            <label className="pz-label" htmlFor="bl2-when">Confirmed visit time</label>
            <input id="bl2-when" className="pz-input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            <button type="button" className="pz-btn pz-btn--primary pz-btn--block" style={{ marginTop: 10 }} disabled={busy || !when}
              onClick={() => onSave(lead, { status: "confirmed", visit_at: new Date(when).toISOString() }, "Visit confirmed")}>
              <Check size={17} /> Confirm this time
            </button>
            <div className="pz-label" style={{ marginTop: 18 }}>After the visit</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button type="button" className="pz-btn" disabled={busy} onClick={() => onSave(lead, { status: "visited" }, "Marked visited")}><Check size={15} /> Visited</button>
              <button type="button" className="pz-btn" disabled={busy} onClick={() => onSave(lead, { status: "no_show" }, "Marked as didn't come")}><X size={15} /> Didn't come</button>
              <button type="button" className="pz-btn pz-btn--gold" disabled={busy} onClick={() => setMode("book")}><KeyRound size={15} /> Booked</button>
              <button type="button" className="pz-btn" style={{ color: "var(--red, #B42318)" }} disabled={busy} onClick={() => onSave(lead, { status: "cancelled" }, "Cancelled")}>Cancelled</button>
            </div>
          </>
        ) : (
          <>
            <div className="pz-label">Which flat did they book?</div>
            {flats.map((f) => (
              <button key={f.property_id} type="button" className={`bl2-pick${flat === f.property_id ? " on" : ""}`} onClick={() => setFlat(f.property_id)}>
                <b style={{ flex: 1 }}>{bhk(f)} · {floorLabel(f.floor_number)}</b><span className="pz-meta">{f.rent ? inr(f.rent) : ""}</span>
              </button>
            ))}
            <button type="button" className="pz-btn pz-btn--gold pz-btn--block" disabled={busy || !flat}
              onClick={() => onSave(lead, { status: "booked", booked_property: flat }, "Booked — well done!")}>Mark booked</button>
          </>
        )}
      </div>
    </Sheet>
  );
}
