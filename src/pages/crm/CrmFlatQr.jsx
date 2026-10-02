/**
 * CRM → a property's QR, its numbers and renters' feedback (flat_insights.sql).
 *
 * The poster to paste: the flat's own, or — for a flat in a building — the
 * building's, which shows every flat to whoever scans it. Then leads (QR
 * scans), likes and visits with names and numbers, and the feedback the team
 * records after a visit or a call: how the renter found the rent, a rating,
 * what they said. The owner reads the feedback in their app, by first name.
 */
import { useCallback, useEffect, useState } from "react";
import QrPosterBlock from "../../components/QrPosterBlock";
import { Btn, C, relTime } from "./crmUi";
import {
  FEEDBACK_SOURCES, PRICE_VIEWS, addFlatFeedback, deleteFlatFeedback, fetchCrmFlatInsights, priceViewLabel,
} from "../../lib/flatInsights";
import { waLink } from "../../lib/partners";

const BLANK = { renter_name: "", price_view: "", rating: 0, comment: "", source: "visit" };
const TONE = { red: C.coral, amber: C.gold, green: C.accent, champ: C.gold };

export default function CrmFlatQr({ flat, building, onToast }) {
  const [d, setD] = useState(null);
  const [which, setWhich] = useState("flat");
  const [fb, setFb] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState("feedback");

  const load = useCallback(() => fetchCrmFlatInsights(flat.property_id).then(setD, () => setD(null)), [flat.property_id]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setBusy(true);
    try {
      await addFlatFeedback(flat.property_id, { ...fb, rating: fb.rating || "" });
      setFb(BLANK);
      await load();
      onToast("Feedback saved — the owner sees it in their app");
    } catch (e) {
      onToast(e?.message || "Could not save the feedback", "error");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id) => {
    if (!window.confirm("Remove this feedback? The owner stops seeing it.")) return;
    try { await deleteFlatFeedback(id); await load(); } catch (e) { onToast(e?.message || "Could not remove it", "error"); }
  };

  const s = d?.stats || {};
  const pill = (on) => ({
    padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", font: "inherit",
    border: `1px solid ${on ? C.accent : C.line}`, background: on ? C.accentSoft : "#fff", color: on ? C.accent : C.text,
  });
  const bldPoster = building ? { code: building.code, name: building.name, area: flat.area, landmark: flat.landmark, photo: flat.cover_image_url } : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 300px) 1fr", gap: 20, alignItems: "start" }}>
      <div>
        {building && (
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <button type="button" style={pill(which === "flat")} onClick={() => setWhich("flat")}>This flat</button>
            <button type="button" style={pill(which === "building")} onClick={() => setWhich("building")}>{building.name} (all flats)</button>
          </div>
        )}
        <QrPosterBlock key={which} flat={flat} building={which === "building" ? bldPoster : null}
          btnClass="crm-btn crm-btn--primary" softClass="crm-btn" onToast={onToast} previewWidth={220} />
        <p className="crm-mute" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>
          {which === "building"
            ? "Paste on the building gate: whoever scans sees every flat in it and asks for a visit."
            : "Paste on the flat's door. Scans count as leads in the owner's dashboard; the renter's number comes to the CRM."}
        </p>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {[["Leads (QR scans)", s.scans], ["Likes", s.likes], ["Visits", s.visits], ["Rating", s.rating != null ? `★ ${s.rating}` : "–"]].map(([k, v]) => (
            <div key={k} className="crm-card" style={{ padding: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{v ?? 0}</div>
              <div className="crm-mute" style={{ fontSize: 11 }}>{k}</div>
            </div>
          ))}
        </div>

        <div className="crm-card" style={{ display: "grid", gap: 8 }}>
          <span className="crm-label">Add renter feedback</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 8 }}>
            <input className="crm-input" placeholder="Renter's name" value={fb.renter_name} onChange={(e) => setFb({ ...fb, renter_name: e.target.value })} />
            <select className="crm-input" value={fb.source} onChange={(e) => setFb({ ...fb, source: e.target.value })} aria-label="Where it came from">
              {FEEDBACK_SOURCES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.textDim }}>The rent is</span>
            {PRICE_VIEWS.map((v) => (
              <button key={v.id} type="button" style={pill(fb.price_view === v.id)} onClick={() => setFb({ ...fb, price_view: fb.price_view === v.id ? "" : v.id })}>{v.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.textDim, marginRight: 4 }}>Rating</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setFb({ ...fb, rating: fb.rating === n ? 0 : n })}
                style={{ border: 0, background: "none", cursor: "pointer", fontSize: 20, color: n <= fb.rating ? "#D6A437" : "#CFC8B8", padding: 0 }}>★</button>
            ))}
          </div>
          <textarea className="crm-input" rows={2} placeholder="What they said — e.g. loved the balcony, wants a lower deposit"
            value={fb.comment} onChange={(e) => setFb({ ...fb, comment: e.target.value.slice(0, 1000) })} />
          <div><Btn variant="primary" sm onClick={add} disabled={busy || (!fb.price_view && !fb.rating && !fb.comment.trim())}>{busy ? "Saving…" : "Save feedback"}</Btn></div>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {[["feedback", `Feedback (${d?.feedback?.length ?? 0})`], ["visits", `Visits (${d?.visits?.length ?? 0})`], ["likes", `Likes (${d?.likes?.length ?? 0})`]].map(([k, label]) => (
            <button key={k} type="button" style={pill(show === k)} onClick={() => setShow(k)}>{label}</button>
          ))}
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          {!d ? <span className="crm-mute" style={{ fontSize: 12 }}>Loading…</span>
            : (d[show] ?? []).length === 0 ? <span className="crm-mute" style={{ fontSize: 12 }}>Nothing yet.</span>
              : show === "feedback" ? d.feedback.map((f) => (
                <div key={f.id} className="crm-card" style={{ padding: 10, display: "grid", gap: 3 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong style={{ fontSize: 13 }}>{f.name || "A renter"}</strong>
                    <span className="crm-mute" style={{ fontSize: 11 }}>{relTime(f.created_at)} · {f.created_by}
                      <button type="button" onClick={() => remove(f.id)} style={{ marginLeft: 8, border: 0, background: "none", color: C.coral, cursor: "pointer", fontSize: 11 }}>Remove</button></span>
                  </div>
                  <div style={{ fontSize: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {f.rating ? <span style={{ color: "#B8860B" }}>{"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}</span> : null}
                    {f.price_view && <span style={{ color: TONE[PRICE_VIEWS.find((v) => v.id === f.price_view)?.tone] || C.text, fontWeight: 600 }}>Rent: {priceViewLabel(f.price_view)}</span>}
                    <span className="crm-mute">{FEEDBACK_SOURCES.find((x) => x.id === f.source)?.label}</span>
                  </div>
                  {f.comment && <div style={{ fontSize: 12.5 }}>“{f.comment}”</div>}
                </div>
              )) : d[show].map((x, i) => (
                <div key={`${x.created_at || x.at}-${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, padding: "6px 2px", borderBottom: `1px solid ${C.lineSoft}` }}>
                  <span><strong>{x.name || "—"}</strong>{x.phone ? <> · <a href={waLink(x.phone, "")} target="_blank" rel="noreferrer" style={{ color: C.wa }}>{x.phone}</a></> : null}</span>
                  <span className="crm-mute">{show === "visits" ? `${x.status}${x.at ? ` · ${new Date(x.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : ""}` : relTime(x.at)}</span>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}
