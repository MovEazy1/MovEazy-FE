/**
 * Partner app → Societies → one society: onboarding it, saved at every step.
 *
 *   1  Numbers: the property manager, the guards, the brokers (only this
 *      partner and MovEazy see them)
 *   2  Amenities: tick each, then a photo of it, taken there
 *   3  A sample flat: 5+ photos, room by room, taken there
 *   4  Rent ranges per flat type — optional, add when a tenant asks
 *
 * Photos are taken with the camera, within ~300 m of the society (the database
 * checks where the phone was). Submit once nothing is missing; the MovEazy team
 * reviews it and puts it live, or sends it back with a note.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Camera, Check, CircleAlert, Phone, Plus, Trash2, X } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Chip, Empty, Loading, TopBar, formatPhone, toast } from "./partnerUi";
import { SocietyPromise } from "./Societies";
import { pp } from "../../lib/partners";
import {
  CONTACT_KINDS, FLAT_SLOTS, ONBOARD_STATUS, RENT_TYPES, addSocietyPhoto, fetchMySociety, removeSocietyContact, removeSocietyPhoto,
  saveSociety, saveSocietyContact, slotLabel, startSociety, submitSociety,
} from "../../lib/societyPartners";

const errText = (e) => e?.message || "Something went wrong.";

/** A camera button: opens the camera on a phone, then hands back the photo. */
function CameraButton({ label, busy, onFile, small = false }) {
  const ref = useRef(null);
  return (
    <>
      <button type="button" className={`pz-btn${small ? " pz-btn--sm" : ""}`} disabled={busy} onClick={() => ref.current?.click()}>
        <Camera size={16} /> {busy ? "Uploading…" : label}
      </button>
      <input ref={ref} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
    </>
  );
}

function Thumb({ url, onRemove, disabled }) {
  return (
    <span style={{ position: "relative", width: 76, height: 76, borderRadius: 10, overflow: "hidden", background: "#ECE9E2", flex: "none" }}>
      <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      {onRemove && !disabled && (
        <button type="button" onClick={onRemove} aria-label="Remove photo"
          style={{ position: "absolute", top: 3, right: 3, width: 24, height: 24, borderRadius: 99, border: 0, background: "rgba(0,0,0,.6)", color: "#fff", display: "grid", placeItems: "center" }}>
          <X size={14} />
        </button>
      )}
    </span>
  );
}

function Step({ n, title, done, optional, children }) {
  return (
    <div className="pz-section">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ width: 28, height: 28, borderRadius: 99, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13,
          background: done ? "var(--g)" : "#ECE9E2", color: done ? "#fff" : "var(--ink)", flex: "none" }}>
          {done ? <Check size={15} /> : n}
        </span>
        <b style={{ fontSize: 15.5, flex: 1 }}>{title}</b>
        {optional && <span className="pz-pill pz-pill--grey">Optional</span>}
      </div>
      {children}
    </div>
  );
}

function Contacts({ s, editable, onSaved }) {
  const [f, setF] = useState({ kind: "manager", name: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const byKind = (k) => s.contacts.filter((c) => c.kind === k);
  const add = async () => {
    setBusy(true);
    try { onSaved(await saveSocietyContact({ ...f, society_id: s.id })); setF({ kind: f.kind, name: "", phone: "" }); toast("Saved"); }
    catch (e) { toast(errText(e), "error"); } finally { setBusy(false); }
  };
  const remove = async (c) => {
    if (!window.confirm(`Remove ${c.name || formatPhone(c.phone)}?`)) return;
    try { onSaved(await removeSocietyContact(c.id)); } catch (e) { toast(errText(e), "error"); }
  };
  return (
    <>
      {CONTACT_KINDS.map((k) => (
        <div key={k.id} style={{ marginBottom: 10 }}>
          <div className="pz-label" style={{ marginBottom: 4 }}>{k.label}{k.many ? "s" : ""} {byKind(k.id).length === 0 && <span className="pz-hint">· none yet</span>}</div>
          {byKind(k.id).map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 14 }}>
              <Phone size={14} color="var(--dim)" />
              <span style={{ flex: 1, minWidth: 0 }}><b>{formatPhone(c.phone)}</b>{c.name ? ` · ${c.name}` : ""}</span>
              {editable && <button type="button" className="pz-iconbtn" onClick={() => remove(c)} aria-label="Remove"><Trash2 size={16} /></button>}
            </div>
          ))}
        </div>
      ))}
      {editable && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, display: "grid", gap: 8 }}>
          <div className="pz-chips">
            {CONTACT_KINDS.map((k) => <Chip key={k.id} on={f.kind === k.id} onClick={() => setF({ ...f, kind: k.id })}>{k.label}</Chip>)}
          </div>
          <input className="pz-input" placeholder={f.kind === "broker" ? "Broker's name" : "Name (optional)"} value={f.name} maxLength={80}
            onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Name" />
          <input className="pz-input" placeholder="Mobile number" inputMode="tel" value={f.phone} maxLength={14}
            onChange={(e) => setF({ ...f, phone: e.target.value })} aria-label="Mobile number" />
          <button type="button" className="pz-btn pz-btn--primary" disabled={busy || f.phone.replace(/\D/g, "").length < 10} onClick={add}>
            <Plus size={16} /> {busy ? "Saving…" : "Add number"}
          </button>
        </div>
      )}
    </>
  );
}

export default function SocietyOnboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { me } = usePartner();
  const partnerId = me?.partner?.user_id;
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [other, setOther] = useState("");
  const [slot, setSlot] = useState("living");
  const [rents, setRents] = useState({});

  const take = useCallback((row) => {
    setS(row);
    setRents(Object.fromEntries(RENT_TYPES.map((t) => [t.id, [row.rents?.[t.id]?.[0] ?? "", row.rents?.[t.id]?.[1] ?? ""]])));
  }, []);
  useEffect(() => {
    fetchMySociety(id).then(take, (e) => setErr(errText(e)));
  }, [id, take]);

  const amenityChoices = useMemo(() => {
    if (!s) return [];
    const list = s.amenity_list ?? [];
    return [...list, ...(s.amenities ?? []).filter((a) => !list.includes(a))];
  }, [s]);

  if (err) return <><TopBar title="Society" back={pp("/societies")} /><div className="pz-pad"><Empty>{err}</Empty></div></>;
  if (!s) return <><TopBar title="Society" back={pp("/societies")} /><Loading /></>;

  const editable = s.status === "draft" || s.status === "sent_back";
  const run = async (key, fn, ok) => {
    setBusy(key);
    try { take(await fn()); if (ok) toast(ok); } catch (e) { toast(errText(e), "error"); } finally { setBusy(""); }
  };
  const toggleAmenity = (a) => {
    const cur = s.amenities ?? [];
    const next = cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a];
    if (cur.includes(a) && (s.amenity_photos?.[a] ?? []).length && !window.confirm(`Untick ${a}? Its photos go too.`)) return;
    run("amenities", () => saveSociety({ id: s.id, amenities: next }));
  };
  const addOther = () => {
    const a = other.trim();
    if (a.length < 2) return;
    setOther("");
    run("amenities", () => saveSociety({ id: s.id, amenities: [...new Set([...(s.amenities ?? []), a])] }));
  };
  const photo = (kind, slotId) => (file) => run(`photo:${kind}:${slotId}`,
    () => addSocietyPhoto({ society: s, partnerId, kind, slot: slotId, file }), "Photo added");
  const dropPhoto = (kind, slotId, url) => run(`rm:${url}`, () => removeSocietyPhoto(s.id, kind, slotId, url));
  const saveRents = () => run("rents", () => saveSociety({ id: s.id, rents }), "Rents saved");
  const submit = () => run("submit", () => submitSociety(s.id), "Submitted — the MovEazy team will review it");

  const st = ONBOARD_STATUS[s.status] || ONBOARD_STATUS.draft;
  const flatCount = (s.flat_photos ?? []).length;
  const lockDays = s.locked_until ? Math.ceil((new Date(s.locked_until) - Date.now()) / 86400000) : null;

  return (
    <>
      <TopBar title={s.name} back={pp("/societies?tab=mine")} />
      <div className="pz-pad">
        <div className="pz-section">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <span className="pz-meta">{[s.area, s.address].filter(Boolean).join(" · ") || "Bengaluru"}</span>
            <span className="pz-pill" style={{ background: `${st.tone}18`, color: st.tone, borderColor: "transparent" }}>{st.label}</span>
          </div>
          {s.status === "draft" && lockDays != null && (
            <div className="pz-hint" style={{ margin: "8px 0 0" }}>
              {lockDays > 0 ? `Yours for ${lockDays} more day${lockDays === 1 ? "" : "s"} — finish it before another partner can take it.` : "Your 7 days are up — another partner can take it now. "}
              {lockDays <= 0 && <button type="button" className="pz-btn pz-btn--sm" onClick={() => run("lock", () => startSociety(s.id), "It's yours for 7 more days")}>Keep it for 7 more days</button>}
            </div>
          )}
          {s.status === "sent_back" && s.note && (
            <div style={{ marginTop: 8, color: "#B91C1C", fontSize: 13.5, display: "flex", gap: 6 }}><CircleAlert size={16} style={{ flex: "none", marginTop: 2 }} /> MovEazy asked you to fix: {s.note}</div>
          )}
          {s.status === "approved" && (
            <div style={{ marginTop: 8, fontSize: 13.5 }}>
              Live on moveazy.co.in{s.leads ? ` · ${s.leads} tenant${s.leads === 1 ? "" : "s"} asked so far` : ""}.{" "}
              <button type="button" className="pz-btn pz-btn--sm" onClick={() => navigate(pp("/societies?tab=leads"))}>See leads</button>
            </div>
          )}
        </div>

        <SocietyPromise />

        <Step n={1} title="Numbers: manager, guards, brokers" done={!s.missing?.some((m) => /manager|guard|broker/i.test(m))}>
          <Contacts s={s} editable={editable} onSaved={take} />
        </Step>

        <Step n={2} title="Amenities, each with a photo" done={!s.missing?.some((m) => /amenit|photo of the/i.test(m))}>
          <p className="pz-hint" style={{ marginTop: 0 }}>Tick what the society has, then take a photo of each, standing there.</p>
          <div className="pz-chips" style={{ marginBottom: 10 }}>
            {amenityChoices.map((a) => (
              <Chip key={a} on={(s.amenities ?? []).includes(a)} onClick={() => editable && toggleAmenity(a)}>{a}</Chip>
            ))}
          </div>
          {editable && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input className="pz-input" placeholder="Another amenity" value={other} maxLength={50} onChange={(e) => setOther(e.target.value)} aria-label="Another amenity" />
              <button type="button" className="pz-btn" onClick={addOther} disabled={other.trim().length < 2}>Add</button>
            </div>
          )}
          {(s.amenities ?? []).map((a) => {
            const ph = s.amenity_photos?.[a] ?? [];
            return (
              <div key={a} style={{ borderTop: "1px solid var(--line)", padding: "10px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: ph.length ? 8 : 0 }}>
                  <b style={{ fontSize: 14 }}>{a} {ph.length === 0 && <span className="pz-hint" style={{ color: "#B91C1C" }}>· photo needed</span>}</b>
                  {editable && <CameraButton small label="Photo" busy={busy === `photo:amenity:${a}`} onFile={photo("amenity", a)} />}
                </div>
                {ph.length > 0 && (
                  <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                    {ph.map((p) => <Thumb key={p.url} url={p.url} disabled={!editable} onRemove={() => dropPhoto("amenity", a, p.url)} />)}
                  </div>
                )}
              </div>
            );
          })}
        </Step>

        <Step n={3} title={`A sample flat · ${flatCount}/5 photos`} done={flatCount >= 5}>
          <p className="pz-hint" style={{ marginTop: 0 }}>Any one flat in the society: at least 5 photos — living room, bedroom, kitchen, bathroom, balcony or view.</p>
          {editable && (
            <>
              <div className="pz-chips" style={{ marginBottom: 8 }}>
                {FLAT_SLOTS.map((x) => <Chip key={x.id} on={slot === x.id} onClick={() => setSlot(x.id)}>
                  {x.label}{(s.flat_photos ?? []).some((p) => p.slot === x.id) ? " ✓" : ""}</Chip>)}
              </div>
              <CameraButton label={`Photo of the ${slotLabel(slot).toLowerCase()}`} busy={busy === `photo:flat:${slot}`} onFile={photo("flat", slot)} />
            </>
          )}
          {flatCount > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {s.flat_photos.map((p) => (
                <div key={p.url} style={{ textAlign: "center" }}>
                  <Thumb url={p.url} disabled={!editable} onRemove={() => dropPhoto("flat", p.slot, p.url)} />
                  <div className="pz-meta" style={{ fontSize: 11 }}>{slotLabel(p.slot)}</div>
                </div>
              ))}
            </div>
          )}
        </Step>

        <Step n={4} title="Rent range per flat type" optional done={Object.keys(s.rents ?? {}).length > 0}>
          <p className="pz-hint" style={{ marginTop: 0 }}>
            Approximate monthly rent in this society. You can leave this for now and add it when a customer enquires.
          </p>
          {RENT_TYPES.map((t) => (
            <div key={t.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
              <b style={{ width: 52, fontSize: 13 }}>{t.label}</b>
              {[0, 1].map((i) => (
                <input key={i} className="pz-input" inputMode="numeric" placeholder={i ? "Max ₹" : "Min ₹"} disabled={!editable && s.status !== "approved"}
                  value={rents[t.id]?.[i] ?? ""} aria-label={`${t.label} ${i ? "max" : "min"} rent`}
                  onChange={(e) => setRents({ ...rents, [t.id]: Object.assign([...(rents[t.id] ?? ["", ""])], { [i]: e.target.value.replace(/\D/g, "") }) })} />
              ))}
            </div>
          ))}
          {(editable || s.status === "approved") && <button type="button" className="pz-btn" disabled={busy === "rents"} onClick={saveRents}>{busy === "rents" ? "Saving…" : "Save rents"}</button>}
        </Step>

        {editable && (
          <div className="pz-section">
            {s.missing?.length ? (
              <>
                <b style={{ fontSize: 14 }}>Still to add</b>
                <ul style={{ margin: "6px 0 10px", paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6 }}>{s.missing.map((m) => <li key={m}>{m}</li>)}</ul>
              </>
            ) : <p style={{ margin: "0 0 10px", fontSize: 14 }}>Everything&apos;s in. Submit it for MovEazy to review and put live.</p>}
            <button type="button" className="pz-btn pz-btn--primary pz-btn--block" disabled={busy === "submit" || (s.missing?.length ?? 1) > 0} onClick={submit}>
              {busy === "submit" ? "Submitting…" : "Submit for review"}
            </button>
            <p className="pz-hint" style={{ margin: "8px 0 0" }}>Everything you add is saved as you go.</p>
          </div>
        )}
      </div>
    </>
  );
}
