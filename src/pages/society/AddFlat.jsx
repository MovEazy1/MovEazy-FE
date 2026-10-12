/**
 * Screens 4 and 5 — Add Flat, in two steps (and the same form to edit one).
 *
 *   1. Building / block, flat number, BHK, expected rent, furnishing,
 *      Available / Occupied. A block + flat number already in the society
 *      offers the existing flat instead.
 *   2. Owner's name and number (they get the flat in the owner app), then
 *      optional: available-from / move-out date, size, notes, photos.
 *
 * What's typed is kept on the device until it's saved, so going back, a
 * dropped connection or a reload never loses it. An occupied flat made
 * available is confirmed first — that's what puts it on the site.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Calendar, Camera, CheckCircle2, X } from "lucide-react";
import { generatePropertyId, mediaRejectionReason, uploadInventoryPhotos } from "../../lib/inventory";
import {
  BHK_TYPES, FURNISHING, fetchSocietyFlat, fetchSocietyFlats, findDuplicate, flatBasicsErrors, flatLabel, flatOwnerErrors,
  saveSocietyFlat, societyError, sp,
} from "../../lib/society";
import { useSociety } from "./SocietyApp";
import { Field, FormHead, Loading, Seg, Sheet, toast } from "./societyUi";

const DRAFT = "mz_society_flat_draft";
const blank = (towers) => ({
  block: towers.length === 1 ? towers[0] : "", flat_no: "", bhk: "2 BHK", rent: "", furnishing: "Fully Furnished", occupancy: "available",
  owner_name: "", owner_phone: "", date: "", notes: "", area_sqft: "", images: [],
});
const readDraft = () => { try { return JSON.parse(sessionStorage.getItem(DRAFT) || "null"); } catch { return null; } };
const writeDraft = (d) => { try { sessionStorage.setItem(DRAFT, JSON.stringify(d)); } catch { /* fine */ } };
const dropDraft = () => { try { sessionStorage.removeItem(DRAFT); } catch { /* fine */ } };

export default function AddFlat() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { society, reload } = useSociety();
  const navigate = useNavigate();
  const towers = useMemo(() => society.towers ?? [], [society.towers]);
  const [f, setF] = useState(() => {
    const d = !editing && readDraft();
    return d?.f ?? blank(towers);
  });
  const [pid] = useState(() => (editing ? id : readDraft()?.pid || generatePropertyId()));
  const [orig, setOrig] = useState(null);
  const [step, setStep] = useState(() => (!editing && readDraft()?.step) || 1);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [dup, setDup] = useState(null);
  const [confirmLive, setConfirmLive] = useState(false);
  const [loaded, setLoaded] = useState(!editing);
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setErrs((e) => { const n = { ...e }; Object.keys(patch).forEach((k) => delete n[k]); return n; }); };

  useEffect(() => {
    if (!editing) return;
    fetchSocietyFlat(id).then((x) => {
      setOrig(x);
      setF({
        block: x.block, flat_no: x.flat_no, bhk: x.bhk, rent: String(Math.round(x.rent)), furnishing: x.furnishing, occupancy: x.occupancy,
        owner_name: x.owner_name, owner_phone: x.owner_phone, notes: x.notes || "", area_sqft: x.area_sqft ? String(x.area_sqft) : "",
        date: (x.occupancy === "occupied" ? x.move_out_date : x.available_from) || "", images: x.images ?? [],
      });
      setLoaded(true);
    }, (e) => { toast(societyError(e), "error"); navigate(sp("/flats"), { replace: true }); });
  }, [editing, id, navigate]);

  useEffect(() => { if (!editing) writeDraft({ f, step, pid }); }, [editing, f, step, pid]);
  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  const toStep2 = async () => {
    const e = flatBasicsErrors(f, towers);
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const list = await fetchSocietyFlats("all", String(f.flat_no).replace(/\s+/g, ""));
      const d = findDuplicate(list.flats, f.block, f.flat_no, editing ? id : "");
      if (d) { setDup(d); return; }
      setStep(2);
    } catch {
      setStep(2); // the save checks again
    } finally {
      setBusy(false);
    }
  };

  const addPhotos = async (files) => {
    const list = [...files].filter((x) => {
      const why = mediaRejectionReason(x);
      if (why) toast(why, "error");
      return !why;
    });
    if (!list.length) return;
    setUploading(list.length);
    try {
      const urls = await uploadInventoryPhotos(list, pid);
      set({ images: [...f.images, ...urls].slice(0, 20) });
      if (urls.length < list.length) toast("Some photos didn't upload. Try them again.", "error");
    } finally {
      setUploading(0);
    }
  };

  const save = async (confirmAvailable = false) => {
    const e = flatOwnerErrors(f);
    setErrs(e);
    if (Object.keys(e).length) return;
    if (editing && orig?.occupancy === "occupied" && f.occupancy === "available" && !confirmAvailable) { setConfirmLive(true); return; }
    setBusy(true);
    try {
      const r = await saveSocietyFlat({
        ...f, property_id: pid, rent: String(f.rent).replace(/[^\d]/g, ""), confirm_available: confirmAvailable,
      });
      if (r?.duplicate) { setDup({ property_id: r.duplicate, label: r.label }); return; }
      dropDraft();
      reload();
      toast(editing ? "Flat updated" : `${r.label} added${r.live ? " — it's live on MovEazy" : ""}`);
      navigate(sp(`/flats/${r.property_id}`), { replace: true, state: { added: !editing } });
    } catch (err) {
      toast(societyError(err, "Couldn't save the flat. Your details are kept — try again."), "error");
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <Loading />;
  const occupied = f.occupancy === "occupied";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="sx-page af">
      <style>{CSS}</style>
      {step === 1 ? (
        <>
          <FormHead title={editing ? "Edit Flat" : "Add Flat"} sub="Add details of an available or upcoming flat." onBack={() => navigate(-1)} />
          <h2 className="sx-h2">Basic Details</h2>
          {towers.length > 0 ? (
            <Field label="Building / Block" error={errs.block}>
              <select className="sx-select" value={f.block} onChange={(e) => set({ block: e.target.value })}>
                <option value="">Select</option>
                {towers.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          ) : null}
          <Field label="Flat Number" error={errs.flat_no}>
            <input className="sx-input" value={f.flat_no} onChange={(e) => set({ flat_no: e.target.value.toUpperCase().slice(0, 12) })} placeholder="1203" autoCapitalize="characters" />
          </Field>

          <h2 className="sx-h2">Flat Details</h2>
          <div className="sx-two">
            <Field label="BHK Type" error={errs.bhk}>
              <select className="sx-select" value={f.bhk} onChange={(e) => set({ bhk: e.target.value })}>
                {BHK_TYPES.map((b) => <option key={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Expected Rent (₹)" error={errs.rent}>
              <input className="sx-input" inputMode="numeric" value={f.rent ? Number(f.rent).toLocaleString("en-IN") : ""} placeholder="45000"
                onChange={(e) => set({ rent: e.target.value.replace(/[^\d]/g, "").slice(0, 7) })} />
            </Field>
          </div>
          <Field label="Furnishing" error={errs.furnishing}>
            <Seg label="Furnishing" options={FURNISHING} value={f.furnishing} onChange={(v) => set({ furnishing: v })} />
          </Field>
          <h2 className="sx-h2">Current Status</h2>
          <Seg pill label="Current status" value={f.occupancy} onChange={(v) => set({ occupancy: v })}
            options={[{ value: "available", label: "Available" }, { value: "occupied", label: "Occupied" }]} />
          {occupied && <p className="sx-hint" style={{ marginTop: 8 }}>Recorded for your list only — it isn&apos;t shown to tenants until you mark it available.</p>}
          <div className="sx-btn-bar">
            <button type="button" className="sx-btn" onClick={toStep2} disabled={busy}>{busy ? "Checking…" : "Continue"}</button>
          </div>
        </>
      ) : (
        <>
          <FormHead title={editing ? "Edit Flat" : "Add Flat"} sub="Add owner details and optional photos." onBack={() => setStep(1)} />
          <h2 className="sx-h2">Owner Details</h2>
          <Field label="Owner Name" error={errs.owner_name}>
            <input className="sx-input" value={f.owner_name} onChange={(e) => set({ owner_name: e.target.value })} placeholder="Rohit Mehta" autoComplete="off" />
          </Field>
          <Field label="Owner Contact Number" error={errs.owner_phone} hint="They can see this flat in the MovEazy owner app.">
            <input className="sx-input" inputMode="tel" value={f.owner_phone} onChange={(e) => set({ owner_phone: e.target.value.slice(0, 16) })} placeholder="+91 98765 43210" autoComplete="off" />
          </Field>

          <h2 className="sx-h2">Additional Details <span className="af-opt">(Optional)</span></h2>
          <Field label={occupied ? "Expected Move-out Date" : "Available From"} hint={occupied ? "We'll remind you 15 days before." : ""}>
            <span className="af-date">
              <Calendar size={18} />
              <input className="sx-input" type="date" value={f.date || ""} min={occupied ? undefined : today}
                onClick={(e) => e.currentTarget.showPicker?.()} onChange={(e) => set({ date: e.target.value })} aria-label={occupied ? "Expected move-out date" : "Available from"} />
            </span>
          </Field>
          <Field label="Size (sq ft)" error={errs.area_sqft}>
            <input className="sx-input" inputMode="numeric" value={f.area_sqft} onChange={(e) => set({ area_sqft: e.target.value.replace(/\D/g, "").slice(0, 5) })} placeholder="1250" />
          </Field>
          <Field label="Notes (Optional)" hint="Seen by your society and MovEazy, not by tenants.">
            <textarea className="sx-textarea" value={f.notes} onChange={(e) => set({ notes: e.target.value.slice(0, 1000) })} placeholder="Any important information about the flat…" />
          </Field>

          <h2 className="sx-h2">Photos <span className="af-opt">(Optional)</span></h2>
          {f.images.length > 0 && (
            <div className="af-photos">
              {f.images.map((u) => (
                <span key={u}><img src={u} alt="" /><button type="button" aria-label="Remove photo" onClick={() => set({ images: f.images.filter((x) => x !== u) })}><X size={14} /></button></span>
              ))}
            </div>
          )}
          <label className="af-addphotos">
            <Camera size={20} /> {uploading ? `Uploading ${uploading}…` : "Add Photos"}
            <input type="file" accept="image/*,video/*" multiple hidden disabled={Boolean(uploading)} onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
          </label>
          {f.images.length === 0 && !occupied && <p className="sx-hint" style={{ marginTop: 8 }}>No photos? It goes live with your society&apos;s photos, and MovEazy follows up for the flat&apos;s own.</p>}

          <div className="sx-btn-bar">
            <button type="button" className="sx-btn" onClick={() => save(false)} disabled={busy || Boolean(uploading)}>{busy ? "Saving…" : "Save Flat"}</button>
          </div>
        </>
      )}

      {dup && (
        <Sheet title={`${dup.label || flatLabel(f.block, f.flat_no)} is already added`} onClose={() => setDup(null)}>
          <p className="sx-sub">Open it to update its details instead of adding it twice.</p>
          <button type="button" className="sx-btn" style={{ marginTop: 16 }} onClick={() => { dropDraft(); navigate(sp(`/flats/${dup.property_id}`)); }}>Open {dup.label || "the flat"}</button>
          <button type="button" className="sx-btn sx-btn--ghost" style={{ marginTop: 10 }} onClick={() => { setDup(null); setStep(1); }}>Change the flat number</button>
        </Sheet>
      )}
      {confirmLive && (
        <Sheet title="Is it free to rent now?" onClose={() => setConfirmLive(false)}>
          <p className="sx-sub">{flatLabel(f.block, f.flat_no)} will go live on moveazy.co.in and MovEazy will start sending tenants.</p>
          <button type="button" className="sx-btn" style={{ marginTop: 16 }} onClick={() => { setConfirmLive(false); save(true); }}><CheckCircle2 size={18} /> Yes, it&apos;s available</button>
          <button type="button" className="sx-btn sx-btn--ghost" style={{ marginTop: 10 }} onClick={() => { setConfirmLive(false); setStep(1); set({ occupancy: "occupied" }); }}>No, keep it occupied</button>
        </Sheet>
      )}
    </div>
  );
}

const CSS = `
.af-opt { font-weight: 500; color: var(--dim); }
.af-date { position: relative; display: block; }
.af-date svg { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--dim); pointer-events: none; }
.af-date input { padding-left: 42px; }
.af-addphotos { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 64px; border: 1.5px dashed #BDB49F; border-radius: 14px;
  background: #FBFAF6; color: var(--ink); font-weight: 600; font-size: 16px; cursor: pointer; }
.af-photos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px; }
.af-photos span { position: relative; aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: #E9E3D3; }
.af-photos img { width: 100%; height: 100%; object-fit: cover; display: block; }
.af-photos button { position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border-radius: 99px; border: 0; background: rgba(0,0,0,.6); color: #fff; display: grid; place-items: center; cursor: pointer; }
`;
