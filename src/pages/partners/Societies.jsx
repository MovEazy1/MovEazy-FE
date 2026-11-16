/**
 * Partner app → Societies (society partners only; CRM → Partners switches it
 * on). Three tabs:
 *
 *   Onboard new   the map: where you are and the societies around you,
 *                 nearest first — free, yours, or being onboarded by someone
 *                 else (7 days). Add one that isn't there, standing at it.
 *   My societies  the ones you started, submitted or have live.
 *   Leads         tenants who asked for flats in your live societies.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronRight, LocateFixed, MapPin, Phone, Plus } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Chip, Empty, Loading, Sheet, TopBar, WhatsAppIcon, formatPhone, toast } from "./partnerUi";
import { pp } from "../../lib/partners";
import {
  LEAD_STAGES, ONBOARD_STATUS, addSociety, currentSpot, distanceLabel, fetchMySocieties, fetchNearbySocieties, fetchSocietyLeads,
  stageLabel, startSociety, updateSocietyLead,
} from "../../lib/societyPartners";

const SocietiesMap = lazy(() => import("./SocietiesMap"));
const errText = (e) => e?.message || "Something went wrong.";

/** What a partner signs up to, shown wherever they start or work a society. */
export function SocietyPromise({ compact = false }) {
  return (
    <div className="pz-section" style={{ background: "#FFF8E8", borderColor: "#F1DDAE" }}>
      <b style={{ fontSize: 14 }}>Your society, your tenants</b>
      <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.55, color: "#4A3B12" }}>
        <li>Only you can see the manager, guard and broker numbers you save here — use them to get new flats in this society.</li>
        <li>Once you onboard a society, every tenant who asks for a flat there on moveazy.co.in comes to you. Closing them is your responsibility.</li>
        {!compact && <li>Being an Assured MovEazy partner, it&apos;s your responsibility to show the tenants the flat and close them at the earliest.</li>}
      </ul>
    </div>
  );
}

function stateLine(s) {
  switch (s.state) {
    case "mine": return { text: ONBOARD_STATUS[s.status]?.label || "Yours", tone: "#8A6419", action: "Continue" };
    case "mine_live": return { text: "Live · yours", tone: "#15803D", action: "Open" };
    case "locked": return { text: `${s.by} is onboarding it${s.locked_until ? ` · till ${new Date(s.locked_until).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}`, tone: "#6B7280" };
    case "onboarded": return { text: `Onboarded by ${s.by || "a partner"}`, tone: "#6B7280" };
    default: return { text: "Free to onboard", tone: "#15803D", action: "Onboard" };
  }
}

function Nearby() {
  const navigate = useNavigate();
  const [spot, setSpot] = useState(null);
  const [spotErr, setSpotErr] = useState("");
  const [rows, setRows] = useState(null);
  const [focus, setFocus] = useState(null);
  const [busy, setBusy] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const locate = useCallback(async () => {
    setSpotErr("");
    try {
      const s = await currentSpot();
      setSpot(s);
      setRows(await fetchNearbySocieties(s.lat, s.lng));
    } catch (e) {
      setSpotErr(errText(e));
      if (rows === null) setRows(await fetchNearbySocieties(null, null).catch(() => []));
    }
  }, [rows]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { locate(); }, []);

  const open = async (s) => {
    if (s.state === "mine" || s.state === "mine_live") { navigate(pp(`/societies/${s.id}`)); return; }
    if (s.state !== "open") return;
    setBusy(s.id);
    try { await startSociety(s.id); navigate(pp(`/societies/${s.id}`)); } catch (e) { toast(errText(e), "error"); } finally { setBusy(""); }
  };
  const add = async () => {
    setBusy("add");
    try {
      const here = await currentSpot();
      const r = await addSociety({ name, lat: here.lat, lng: here.lng });
      setAdding(false);
      navigate(pp(`/societies/${r.id}`));
    } catch (e) { toast(errText(e), "error"); } finally { setBusy(""); }
  };

  return (
    <>
      <div style={{ height: 300, position: "relative", isolation: "isolate", background: "#E7E1D2" }}>
        <Suspense fallback={<Loading label="Loading the map…" />}>
          <SocietiesMap spot={spot} societies={rows ?? []} focusId={focus} onPick={setFocus} />
        </Suspense>
        <button type="button" className="pz-btn pz-btn--sm" onClick={locate}
          style={{ position: "absolute", right: 10, bottom: 10, zIndex: 500, background: "#fff" }}>
          <LocateFixed size={16} /> Where am I
        </button>
      </div>
      <div className="pz-pad">
        {spotErr && <div className="pz-section" style={{ color: "#B91C1C", fontSize: 13.5 }}>{spotErr}</div>}
        <SocietyPromise compact />
        <button type="button" className="pz-btn pz-btn--block" style={{ marginBottom: 12 }} onClick={() => setAdding(true)}>
          <Plus size={16} /> Society not on the map? Add it
        </button>
        {rows === null ? <Loading label="Finding societies near you…" /> : rows.length === 0 ? <Empty>No societies near you yet.</Empty> : (
          <div className="pz-card">
            {rows.map((s, i) => {
              const st = stateLine(s);
              return (
                <div key={s.id} onClick={() => setFocus(s.id)} role="presentation"
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderTop: i ? "1px solid var(--line)" : "none", background: focus === s.id ? "#FBF6E9" : undefined }}>
                  <MapPin size={18} color={st.tone} style={{ flex: "none" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                    <div className="pz-meta" style={{ color: st.tone }}>{[distanceLabel(s.metres), st.text].filter(Boolean).join(" · ")}</div>
                  </div>
                  {st.action && (
                    <button type="button" className={`pz-btn pz-btn--sm${st.action === "Onboard" ? " pz-btn--primary" : ""}`} disabled={!!busy}
                      onClick={(e) => { e.stopPropagation(); open(s); }}>
                      {busy === s.id ? "…" : st.action}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {adding && (
        <Sheet title="Add a society" onClose={() => setAdding(false)}
          action={<button type="button" className="pz-btn pz-btn--primary pz-btn--block" disabled={busy === "add" || name.trim().length < 3} onClick={add}>
            {busy === "add" ? "Adding…" : "Add and start onboarding"}</button>}>
          <p className="pz-hint" style={{ marginTop: 0 }}>Stand at the society&apos;s gate: we pin it where you are.</p>
          <div className="pz-field">
            <label className="pz-label" htmlFor="soc-name">Society name</label>
            <input id="soc-name" className="pz-input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sobha Silicon Oasis" autoFocus />
          </div>
        </Sheet>
      )}
    </>
  );
}

function Mine() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  useEffect(() => { fetchMySocieties().then(setRows, (e) => { toast(errText(e), "error"); setRows([]); }); }, []);
  if (rows === null) return <Loading />;
  return (
    <div className="pz-pad">
      <SocietyPromise />
      {rows.length === 0 ? <Empty>You haven&apos;t onboarded a society yet. Open “Onboard new” and pick one near you.</Empty> : (
        <div className="pz-card">
          {rows.map((s, i) => {
            const st = ONBOARD_STATUS[s.status] || ONBOARD_STATUS.draft;
            return (
              <button key={s.id} type="button" onClick={() => navigate(pp(`/societies/${s.id}`))}
                style={{ display: "flex", width: "100%", gap: 10, alignItems: "center", padding: "12px", border: 0, borderTop: i ? "1px solid var(--line)" : "none", background: "none", font: "inherit", textAlign: "left", cursor: "pointer" }}>
                <span style={{ width: 52, height: 52, borderRadius: 10, background: "#ECE9E2", overflow: "hidden", flex: "none" }}>
                  {s.cover && <img src={s.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 14.5 }}>{s.name}</b>
                  <span className="pz-meta" style={{ display: "block", color: st.tone }}>
                    {st.label}{s.status !== "approved" && s.missing ? ` · ${s.missing} to add` : ""}{s.leads ? ` · ${s.leads} lead${s.leads === 1 ? "" : "s"}` : ""}
                    {s.new_leads ? ` (${s.new_leads} new)` : ""}
                  </span>
                  {s.status === "sent_back" && s.note && <span className="pz-meta" style={{ display: "block", color: "#B91C1C" }}>Fix: {s.note}</span>}
                </span>
                <ChevronRight size={18} color="var(--dim)" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Leads() {
  const [rows, setRows] = useState(null);
  const [noteFor, setNoteFor] = useState(null); // { lead, stage }
  const [note, setNote] = useState("");
  useEffect(() => { fetchSocietyLeads().then(setRows, (e) => { toast(errText(e), "error"); setRows([]); }); }, []);
  const save = async () => {
    try { setRows(await updateSocietyLead(noteFor.lead.id, noteFor.stage, note)); setNoteFor(null); setNote(""); toast("Saved"); }
    catch (e) { toast(errText(e), "error"); }
  };
  if (rows === null) return <Loading />;
  return (
    <div className="pz-pad">
      {rows.length === 0 ? <Empty>No tenant has asked yet. Once a society you onboarded is live, every tenant who asks for a flat there shows up here.</Empty> : rows.map((l) => (
        <div key={l.id} className="pz-section">
          <div className="pz-between" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <b style={{ fontSize: 15 }}>{l.name || "Tenant"}</b>
              <div className="pz-meta">{l.society} · {new Date(l.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</div>
            </div>
            <span className={`pz-pill${l.stage === "new" ? " pz-pill--warn" : ""}`}>{stageLabel(l.stage)}</span>
          </div>
          <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
            <a className="pz-btn pz-btn--sm" href={`tel:+91${String(l.phone).slice(-10)}`}><Phone size={15} /> {formatPhone(l.phone)}</a>
            <a className="pz-btn pz-btn--sm pz-wa" href={`https://wa.me/91${String(l.phone).slice(-10)}?text=${encodeURIComponent(`Hi${l.name ? ` ${l.name.split(" ")[0]}` : ""}, this is your MovEazy partner for ${l.society}. Here are the flats available —`)}`} target="_blank" rel="noreferrer">
              <WhatsAppIcon size={15} /> WhatsApp
            </a>
          </div>
          {l.last_note && <div className="pz-hint" style={{ margin: "0 0 8px" }}>“{l.last_note}”</div>}
          <div className="pz-chips pz-chips--scroll">
            {LEAD_STAGES.filter((s) => s.id !== "new").map((s) => (
              <Chip key={s.id} on={l.stage === s.id} onClick={() => { setNoteFor({ lead: l, stage: s.id }); setNote(""); }}>{s.label}</Chip>
            ))}
          </div>
        </div>
      ))}
      {noteFor && (
        <Sheet title={`${stageLabel(noteFor.stage)} · ${noteFor.lead.name || "Tenant"}`} onClose={() => setNoteFor(null)}
          action={<button type="button" className="pz-btn pz-btn--primary pz-btn--block" onClick={save}>Save</button>}>
          <div className="pz-field">
            <label className="pz-label" htmlFor="sl-note">Note <span className="pz-hint">(what happened, the visit time…)</span></label>
            <textarea id="sl-note" className="pz-textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </Sheet>
      )}
    </div>
  );
}

export default function Societies() {
  const { me } = usePartner();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "nearby";
  const isSociety = Boolean(me?.partner?.society_partner);
  const tabs = useMemo(() => [["nearby", "Onboard new"], ["mine", "My societies"], ["leads", "Leads"]], []);
  if (!isSociety) {
    return (
      <>
        <TopBar title="Societies" back />
        <div className="pz-pad"><Empty>Societies are for MovEazy society partners. Ask the MovEazy team to switch it on for you.</Empty></div>
      </>
    );
  }
  return (
    <>
      <TopBar title="Societies" back={pp("/")}>
      </TopBar>
      <div className="pz-tabs" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`pz-tab${tab === k ? " pz-tab--on" : ""}`}
            onClick={() => setParams(k === "nearby" ? {} : { tab: k }, { replace: true })}>{l}</button>
        ))}
      </div>
      {tab === "mine" ? <Mine /> : tab === "leads" ? <Leads /> : <Nearby />}
    </>
  );
}
