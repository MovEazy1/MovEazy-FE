/**
 * Setting up a society (its first manager), or editing it later (managers).
 *
 *   1. Google Maps link → name, address, locality, map spot, rating, photos
 *      (api/places.js). Or enter it by hand.
 *   2. Details: towers / blocks, floors, flats, year built, maintenance.
 *   3. Amenities.   4. Tenant rules.   5. The society's own photos, and send.
 *
 * A new society waits for MovEazy's approval — meanwhile flats can be added
 * and people invited; nothing shows on the site until it's approved.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { closestArea, useAreas, withCurrent } from "../../lib/areas";
import { Camera, Check, Clock, KeyRound, Link2, MapPin, Plus, Star, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { mediaRejectionReason, uploadInventoryPhotos } from "../../lib/inventory";
import {
  SOCIETY_AMENITIES, googlePhotoUri, lookupGooglePlace, saveSocietySetup, societyError, sp,
} from "../../lib/society";
import { useSociety } from "./SocietyApp";
import { Field, FormHead, Loading, SocietyLogo, toast } from "./societyUi";

const BLANK = {
  name: "", area: "", full_address: "", landmark: "", latitude: "", longitude: "", place_id: "", google_url: "",
  towers: [], total_floors: "", total_flats: "", year_built: "", maintenance: "", amenities: [], photos: [], description: "",
  rules: { families: true, bachelors: true, pets: false, veg_only: false, notes: "" }, manager_name: "",
};
const STEPS = ["Google", "Details", "Amenities", "Rules", "Photos"];
const randomFolder = () => `SOC-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

function fromSociety(s) {
  if (!s) return BLANK;
  return {
    ...BLANK, ...s,
    latitude: s.latitude ?? "", longitude: s.longitude ?? "", total_floors: s.total_floors ?? "", total_flats: s.total_flats ?? "",
    year_built: s.year_built ?? "", maintenance: s.maintenance ?? "", rules: { ...BLANK.rules, ...(s.rules || {}) },
  };
}

function Toggle({ on, onChange, label, sub }) {
  return (
    <button type="button" className={`su-toggle${on ? " on" : ""}`} onClick={() => onChange(!on)} aria-pressed={on}>
      <span><b>{label}</b>{sub && <em>{sub}</em>}</span>
      <i aria-hidden><span /></i>
    </button>
  );
}

/** Step 1: find the society on Google. */
function GoogleStep({ f, set, onNext }) {
  const [link, setLink] = useState(f.google_url || "");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState(null);
  const [err, setErr] = useState("");
  const [shots, setShots] = useState([]);

  const fetchIt = async () => {
    if (!link.trim()) { setErr("Paste the society's Google Maps link."); return; }
    setBusy(true);
    setErr("");
    setFound(null);
    try {
      const r = await lookupGooglePlace(link.trim());
      setFound(r);
      if (r.photos?.length) Promise.all(r.photos.slice(0, 4).map((p) => googlePhotoUri(p.name, 400))).then((u) => setShots(u.filter(Boolean)));
    } catch (e) {
      setErr(societyError(e, "Couldn't read that link."));
    } finally {
      setBusy(false);
    }
  };

  const use = () => {
    set({
      google_url: found.google_url || link.trim(),
      place_id: found.place_id || "",
      name: found.name || f.name,
      full_address: found.address || f.full_address,
      // Google's name for the area, as the list names it (or left to pick).
      area: closestArea(found.area) || f.area,
      latitude: found.lat ?? f.latitude,
      longitude: found.lng ?? f.longitude,
    });
    onNext();
  };

  return (
    <>
      <div className="su-hero"><MapPin size={22} /><span>Open your society in Google Maps, tap <b>Share</b>, copy the link and paste it here.</span></div>
      <Field label="Google Maps link" error={err}>
        <div className="su-linkrow">
          <input className="sx-input" inputMode="url" placeholder="https://maps.app.goo.gl/…" value={link} onChange={(e) => { setLink(e.target.value); setErr(""); }} />
        </div>
      </Field>
      <button type="button" className="sx-btn" style={{ marginTop: 14 }} onClick={fetchIt} disabled={busy}><Link2 size={18} /> {busy ? "Finding your society…" : "Get details from Google"}</button>

      {found && (
        <div className="sx-card su-found">
          {found.configured === false || found.found === false ? (
            <p className="sx-sub" style={{ marginTop: 0 }}>
              {found.lat ? "Got the map spot" : "Couldn't find the place"}{found.name ? ` and the name “${found.name}”` : ""}. You'll fill in the rest next.
            </p>
          ) : (
            <>
              {shots.length > 0 && <div className="su-shots">{shots.map((u) => <img key={u} src={u} alt="" />)}</div>}
              <b className="su-name">{found.name}</b>
              <span className="su-addr">{found.address}</span>
              {found.rating != null && <span className="su-rating"><Star size={15} fill="#F5A524" color="#F5A524" /> {found.rating} · {found.ratings.toLocaleString("en-IN")} Google reviews</span>}
              <span className="su-google">Details from Google</span>
            </>
          )}
          <button type="button" className="sx-btn" style={{ marginTop: 14 }} onClick={use}><Check size={18} /> Use these details</button>
        </div>
      )}
      <button type="button" className="sx-link" style={{ marginTop: 14, display: "block" }} onClick={onNext}>Enter the details myself instead</button>
    </>
  );
}

export default function Setup({ editing = false, onDone }) {
  const ctx = useSociety();
  const { names: areaNames } = useAreas();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState(() => ({ ...fromSociety(editing ? ctx?.society : null), manager_name: user?.name || "" }));
  const [step, setStep] = useState(editing ? 1 : -1);
  const [tower, setTower] = useState("");
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  const folder = useMemo(randomFolder, []);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  const detailsOk = () => {
    const e = {};
    if (f.name.trim().length < 2) e.name = "Enter the society's name.";
    if (!f.area.trim()) e.area = "Pick the area.";
    if (f.total_flats !== "" && !(Number(f.total_flats) >= 1 && Number(f.total_flats) <= 20000)) e.total_flats = "A number of flats.";
    if (f.total_floors !== "" && !(Number(f.total_floors) >= 1 && Number(f.total_floors) <= 120)) e.total_floors = "A number of floors.";
    if (f.year_built !== "" && !(Number(f.year_built) >= 1950 && Number(f.year_built) <= new Date().getFullYear() + 3)) e.year_built = "A year like 2016.";
    setErrs(e);
    return !Object.keys(e).length;
  };

  const addTower = () => {
    const t = tower.trim();
    if (!t) return;
    if (!f.towers.includes(t)) set({ towers: [...f.towers, t] });
    setTower("");
  };

  const addPhotos = async (files) => {
    const list = [...files].filter((x) => !mediaRejectionReason(x));
    if (!list.length) return;
    setUploading(`Uploading ${list.length} photo${list.length === 1 ? "" : "s"}…`);
    try {
      const urls = await uploadInventoryPhotos(list, folder);
      set({ photos: [...f.photos, ...urls].slice(0, 30) });
      if (urls.length < list.length) toast("Some photos didn't upload. Try them again.", "error");
    } finally {
      setUploading("");
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      await saveSocietySetup({
        ...f,
        latitude: f.latitude === "" ? "" : String(f.latitude), longitude: f.longitude === "" ? "" : String(f.longitude),
        total_floors: String(f.total_floors ?? ""), total_flats: String(f.total_flats ?? ""), year_built: String(f.year_built ?? ""),
        maintenance: String(f.maintenance ?? "").replace(/[^\d]/g, ""),
      });
      if (editing) {
        toast(ctx?.society?.status === "rejected" ? "Sent to MovEazy for review again" : "Society details saved");
        await ctx?.reload();
        navigate(sp("/profile"));
      } else {
        toast("Sent to MovEazy for approval");
        await onDone?.();
      }
    } catch (e) {
      toast(societyError(e), "error");
    } finally {
      setBusy(false);
    }
  };

  if (step === -1) {
    return (
      <div className="sx-col su">
        <style>{CSS}</style>
        <div style={{ display: "flex", justifyContent: "center", padding: "48px 0 28px" }}><SocietyLogo size={36} /></div>
        <h1 className="su-big">Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
        <p className="sx-sub" style={{ textAlign: "center" }}>You&apos;re not part of a society on MovEazy yet.</p>
        <button type="button" className="sx-card su-choice" onClick={() => setStep(0)}>
          <span className="su-ic"><KeyRound size={22} /></span>
          <span><b>I manage a society</b><em>Set it up in a few minutes — MovEazy approves it, then your flats go live.</em></span>
        </button>
        <div className="sx-card su-choice su-choice--muted">
          <span className="su-ic"><Clock size={22} /></span>
          <span><b>I&apos;m a guard or staff</b><em>Ask your society manager for the invite link on WhatsApp, and open it on this phone.</em></span>
        </div>
      </div>
    );
  }

  const last = step === STEPS.length - 1;
  const next = () => {
    if (step === 1 && !detailsOk()) return;
    if (last) submit(); else setStep((s) => s + 1);
  };
  const back = () => (step === (editing ? 1 : 0) ? (editing ? navigate(-1) : setStep(-1)) : setStep((s) => s - 1));

  return (
    <div className="sx-page su">
      <style>{CSS}</style>
      <FormHead title={editing ? "Society details" : "Set up your society"} onBack={back}
        sub={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`} />
      <div className="su-steps" aria-hidden>{STEPS.map((s, i) => <i key={s} className={i <= step ? "on" : ""} />)}</div>
      {editing && ctx?.society?.status === "rejected" && (
        <div className="sx-banner sx-banner--red"><X size={18} /><span><b>MovEazy asked for changes:</b> {ctx.society.reject_reason}</span></div>
      )}

      {step === 0 && <GoogleStep f={f} set={set} onNext={() => setStep(1)} />}

      {step === 1 && (
        <>
          <Field label="Society name" error={errs.name}><input className="sx-input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Sunrise Residency" /></Field>
          <Field label="Area / locality" error={errs.area}>
            <select className="sx-select" value={f.area} onChange={(e) => set({ area: e.target.value })}>
              <option value="">Pick the area</option>
              {withCurrent(areaNames, f.area).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="Full address" hint="Only MovEazy sees the full address."><textarea className="sx-textarea" value={f.full_address} onChange={(e) => set({ full_address: e.target.value })} placeholder="27th Main, Sector 2, HSR Layout, Bengaluru" /></Field>
          <Field label="Landmark (optional)"><input className="sx-input" value={f.landmark} onChange={(e) => set({ landmark: e.target.value })} placeholder="Near Agara Lake" /></Field>
          <h2 className="sx-h2">Towers / blocks</h2>
          <p className="sx-sub" style={{ marginTop: -4 }}>Guards pick from these when adding a flat. Leave empty if there&apos;s just one building.</p>
          <div className="su-chips">
            {f.towers.map((t) => (
              <span key={t} className="su-chip on">{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => set({ towers: f.towers.filter((x) => x !== t) })}><X size={14} /></button></span>
            ))}
          </div>
          <div className="su-addrow">
            <input className="sx-input" value={tower} onChange={(e) => setTower(e.target.value)} placeholder="e.g. Tower A" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTower(); } }} />
            <button type="button" className="su-add" onClick={addTower} aria-label="Add tower"><Plus size={20} /></button>
          </div>
          <div className="sx-two">
            <Field label="Floors" error={errs.total_floors}><input className="sx-input" inputMode="numeric" value={f.total_floors} onChange={(e) => set({ total_floors: e.target.value.replace(/\D/g, "") })} placeholder="14" /></Field>
            <Field label="Total flats" error={errs.total_flats}><input className="sx-input" inputMode="numeric" value={f.total_flats} onChange={(e) => set({ total_flats: e.target.value.replace(/\D/g, "") })} placeholder="128" /></Field>
          </div>
          <div className="sx-two">
            <Field label="Year built" error={errs.year_built}><input className="sx-input" inputMode="numeric" value={f.year_built} onChange={(e) => set({ year_built: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="2016" /></Field>
            <Field label="Maintenance / month (₹)"><input className="sx-input" inputMode="numeric" value={f.maintenance} onChange={(e) => set({ maintenance: e.target.value.replace(/\D/g, "") })} placeholder="4500" /></Field>
          </div>
          <Field label="About the society (optional)"><textarea className="sx-textarea" value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="Quiet gated community with a large central garden…" /></Field>
        </>
      )}

      {step === 2 && (
        <>
          <p className="sx-sub">Tick everything the society has. Tenants see these on every flat.</p>
          <div className="su-chips su-chips--grid">
            {SOCIETY_AMENITIES.map((a) => {
              const on = f.amenities.includes(a);
              return <button key={a} type="button" className={`su-chip${on ? " on" : ""}`} aria-pressed={on}
                onClick={() => set({ amenities: on ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] })}>{on && <Check size={14} />}{a}</button>;
            })}
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <p className="sx-sub">Who can rent here? MovEazy only sends tenants who fit.</p>
          <div className="su-toggles">
            <Toggle on={f.rules.families} onChange={(v) => set({ rules: { ...f.rules, families: v } })} label="Families" />
            <Toggle on={f.rules.bachelors} onChange={(v) => set({ rules: { ...f.rules, bachelors: v } })} label="Bachelors" />
            <Toggle on={f.rules.pets} onChange={(v) => set({ rules: { ...f.rules, pets: v } })} label="Pets allowed" />
            <Toggle on={f.rules.veg_only} onChange={(v) => set({ rules: { ...f.rules, veg_only: v } })} label="Vegetarian only" />
          </div>
          <Field label="Other rules or move-in charges (optional)">
            <textarea className="sx-textarea" value={f.rules.notes} onChange={(e) => set({ rules: { ...f.rules, notes: e.target.value } })} placeholder="Move-in charge ₹2,000 · No loud music after 10 pm" />
          </Field>
        </>
      )}

      {step === 4 && (
        <>
          <p className="sx-sub">Photos of the gate, lobby and amenities. Flats without their own photos show these.</p>
          <div className="su-photos">
            {f.photos.map((u) => (
              <span key={u} className="su-photo"><img src={u} alt="" /><button type="button" aria-label="Remove photo" onClick={() => set({ photos: f.photos.filter((x) => x !== u) })}><X size={14} /></button></span>
            ))}
            <label className="su-photo su-photo--add">
              <Camera size={22} /><span>Add photos</span>
              <input type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
            </label>
          </div>
          {uploading && <Loading label={uploading} />}
          {!editing && (
            <Field label="Your name"><input className="sx-input" value={f.manager_name} onChange={(e) => set({ manager_name: e.target.value })} placeholder="Suresh Kumar" /></Field>
          )}
          {!editing && <div className="sx-banner sx-banner--mint"><Clock size={18} /><span>MovEazy checks the details and approves your society. Meanwhile you can add flats and invite your guards.</span></div>}
        </>
      )}

      {step > 0 && (
        <div className="sx-btn-bar">
          <button type="button" className="sx-btn" onClick={next} disabled={busy || Boolean(uploading)}>
            {busy ? "Saving…" : last ? (editing ? "Save details" : "Send for approval") : "Continue"}
          </button>
        </div>
      )}
    </div>
  );
}

const CSS = `
.su-big { text-align: center; font-size: 26px; margin: 0; }
.su-choice { width: 100%; display: flex; gap: 14px; align-items: flex-start; text-align: left; padding: 16px; margin-top: 16px; cursor: pointer; color: inherit; }
.su-choice--muted { cursor: default; background: #FBFAF6; }
.su-choice b { display: block; font-size: 17px; }
.su-choice em { font-style: normal; color: var(--dim); font-size: 14px; line-height: 1.45; }
.su-ic { width: 46px; height: 46px; border-radius: 14px; background: var(--mint); color: var(--em); display: grid; place-items: center; flex: none; }
.su-steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin: 12px 0 6px; }
.su-steps i { height: 5px; border-radius: 99px; background: #E3DDCF; }
.su-steps i.on { background: var(--em); }
.su-hero { display: flex; gap: 10px; align-items: flex-start; background: #fff; border: 1px solid #EEE9DD; border-radius: 14px; padding: 14px; margin-top: 14px; font-size: 14.5px; line-height: 1.45; }
.su-hero svg { color: var(--em); flex: none; }
.su-found { padding: 14px; margin-top: 16px; display: flex; flex-direction: column; gap: 4px; }
.su-shots { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 8px; }
.su-shots img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 10px; }
.su-name { font-size: 18px; }
.su-addr { color: var(--dim); font-size: 14px; }
.su-rating { display: flex; align-items: center; gap: 4px; font-weight: 700; font-size: 14px; margin-top: 2px; }
.su-google { font-size: 11.5px; color: #8A928E; margin-top: 2px; }
.su-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
.su-chips--grid { margin-top: 16px; }
.su-chip { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 99px; border: 1.5px solid var(--line); background: #fff;
  font-size: 14.5px; font-weight: 600; color: var(--ink); cursor: pointer; }
.su-chip.on { background: var(--mint); border-color: #A9D9C3; color: #0E5A40; }
.su-chip button { border: 0; background: none; padding: 0; display: grid; place-items: center; cursor: pointer; color: inherit; }
.su-addrow { display: flex; gap: 8px; }
.su-add { width: 52px; flex: none; border-radius: 12px; border: 0; background: var(--em); color: #fff; display: grid; place-items: center; cursor: pointer; }
.su-toggles { display: grid; gap: 10px; margin-top: 16px; }
.su-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px; border-radius: 14px; border: 1.5px solid var(--line); background: #fff; cursor: pointer; text-align: left; color: inherit; }
.su-toggle b { font-size: 16px; }
.su-toggle em { display: block; font-style: normal; color: var(--dim); font-size: 13px; }
.su-toggle i { width: 50px; height: 30px; border-radius: 99px; background: #D9D3C4; position: relative; flex: none; transition: background .15s; }
.su-toggle i span { position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; border-radius: 99px; background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,.2); transition: left .15s; }
.su-toggle.on { border-color: #A9D9C3; }
.su-toggle.on i { background: var(--em); }
.su-toggle.on i span { left: 23px; }
.su-photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; }
.su-photo { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: #E9E3D3; }
.su-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.su-photo button { position: absolute; top: 6px; right: 6px; width: 26px; height: 26px; border-radius: 99px; border: 0; background: rgba(0,0,0,.6); color: #fff; display: grid; place-items: center; cursor: pointer; }
.su-photo--add { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border: 1.5px dashed #BDB49F; background: #FBFAF6; color: var(--dim); font-size: 13px; font-weight: 600; cursor: pointer; }
`;
