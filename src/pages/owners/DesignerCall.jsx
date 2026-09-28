/**
 * Book the free Home Designer call. Covers any or all of the owner's flats;
 * the request lands in the CRM's Inventory Ops queue with every flat's photos
 * one click away, which is what the designer builds the AI renders from.
 */
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Camera, CheckCircle2, Palette } from "lucide-react";
import { useOwner } from "./OwnerApp";
import { WhenPicker } from "./ServicesHome";
import { Empty, Loading, PropertyThumb, TopBar, toast } from "./ownerUi";
import { createRequest, friendlyError, op, propertyName } from "../../lib/owners";

export default function DesignerCall() {
  const { properties } = useOwner();
  if (!properties) return <><TopBar title="Home Designer call" back /><Loading /></>;
  if (!properties.length) return <><TopBar title="Home Designer call" back /><Empty>Add a property first.</Empty></>;
  return <DesignerCallInner list={properties} />;
}

function DesignerCallInner({ list }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { reloadRequests } = useOwner();
  const [picked, setPicked] = useState(() => new Set(list.map((p) => p.property_id)));
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("evening");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const toggle = (id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const first = params.get("property");

  const submit = async () => {
    if (!picked.size) return toast("Pick at least one property", "error");
    setBusy(true);
    try {
      const ids = [...picked].sort((a, b) => (a === first ? -1 : b === first ? 1 : 0));
      const id = await createRequest({ kind: "designer_call", property_ids: ids, property_id: ids[0], preferred_date: date || null, preferred_slot: slot, description: notes });
      await reloadRequests();
      setDone(id);
    } catch (e) {
      toast(friendlyError(e, "Could not book the call."), "error");
      setBusy(false);
    }
  };

  if (done) {
    return (
      <>
        <TopBar title="Home Designer call" />
        <div className="oz-pad" style={{ textAlign: "center", paddingTop: 40 }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, background: "var(--emt)", color: "var(--em)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <CheckCircle2 size={34} />
          </div>
          <h2 style={{ margin: "0 0 8px" }}>Your call is booked</h2>
          <p className="oz-meta" style={{ lineHeight: 1.55 }}>Our Home Designer will call you {date ? "on the day you picked" : "within 2 working days"} with AI makeovers of your flat and a short list of upgrades, costed.</p>
          <div className="oz-grid2" style={{ marginTop: 20 }}>
            <Link to={op("/")} className="oz-btn">Home</Link>
            <button type="button" className="oz-btn oz-btn--primary" onClick={() => navigate(op(`/repairs/${done}`), { replace: true })}>See status</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Home Designer call" back />
      <div className="oz-pad">
        <div className="oz-row" style={{ alignItems: "flex-start", marginBottom: 14 }}>
          <span className="oz-svc-ic"><Palette size={24} /></span>
          <p className="oz-meta" style={{ margin: 0, lineHeight: 1.55 }}>
            A free 20-minute call. The designer studies your photos, shows AI renders of the flat upgraded, and tells you which changes pay for themselves in rent.
          </p>
        </div>

        <span className="oz-label">Which properties?</span>
        <div className="oz-card" style={{ marginBottom: 16 }}>
          {list.map((p) => {
            const photos = (p.images ?? []).length;
            return (
              <label key={p.property_id} className="oz-menurow" style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={picked.has(p.property_id)} onChange={() => toggle(p.property_id)}
                  style={{ width: 20, height: 20, accentColor: "var(--em)" }} />
                <PropertyThumb property={p} style={{ width: 56, height: 48 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontWeight: 600 }}>{propertyName(p)}</strong>
                  <span className="oz-sub">{photos ? `${photos} photo${photos > 1 ? "s" : ""}` : "No photos yet"}</span>
                </span>
                {!photos && <Link to={op(`/properties/${p.property_id}/edit`)} className="oz-btn oz-btn--ghost oz-btn--sm"><Camera size={14} /> Add</Link>}
              </label>
            );
          })}
        </div>

        <WhenPicker date={date} slot={slot} onDate={(d) => setDate(date === d ? "" : d)} onSlot={setSlot} />
        <div className="oz-field">
          <label className="oz-label" htmlFor="dc-notes">Anything you'd like to focus on? <span className="oz-hint">(optional)</span></label>
          <textarea id="dc-notes" className="oz-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Budget around ₹50k; the kitchen feels dated" />
        </div>
        <button type="button" className="oz-btn oz-btn--primary oz-btn--block" onClick={submit} disabled={busy}>{busy ? "Booking…" : "Book my free call"}</button>
      </div>
    </>
  );
}
