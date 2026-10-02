/**
 * Add or edit a building — a property that holds many flats and gets its own
 * QR (owner_buildings.sql). Required: a name and the locality. Photos upload
 * the moment they are picked, so a slow network shows up per photo, not as a
 * failed save at the end.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Camera, Check, Loader2, RotateCw, X } from "lucide-react";
import { useOwner } from "./OwnerApp";
import { Chip, Empty, Loading, TopBar, toast } from "./ownerUi";
import ListingMapPicker from "../../components/ListingMapPicker";
import { ALL_LOCALITIES } from "../../data/preferenceOptions";
import { mediaRejectionReason, uploadInventoryPhotos } from "../../lib/inventory";
import { geocodePlace } from "../../lib/geocode";
import { saveBuilding } from "../../lib/buildings";
import { friendlyError, op } from "../../lib/owners";

export const BUILDING_AMENITIES = [
  "Lift", "Power backup", "Car parking", "Bike parking", "24×7 security", "CCTV", "Gated", "Water 24×7",
  "Gym", "Swimming pool", "Clubhouse", "Pet friendly", "Rooftop", "Play area",
];

export default function BuildingForm() {
  const { id } = useParams();
  const { buildings } = useOwner();
  const existing = id ? (buildings ?? []).find((b) => b.id === id) : null;
  if (id && !buildings) return <><TopBar title="Edit property" back /><Loading /></>;
  if (id && !existing) return <><TopBar title="Edit property" back /><Empty>That property isn't in your account.</Empty></>;
  return <BuildingFormInner key={existing?.id || "new"} existing={existing} />;
}

function BuildingFormInner({ existing }) {
  const navigate = useNavigate();
  const { reloadBuildings } = useOwner();
  const [f, setF] = useState(() => ({
    name: existing?.name || "",
    area: existing?.area || "",
    landmark: existing?.landmark || "",
    fullAddress: existing?.full_address || "",
    latitude: existing?.latitude ?? null,
    longitude: existing?.longitude ?? null,
    totalFloors: existing?.total_floors != null ? String(existing.total_floors) : "",
    amenities: existing?.amenities ?? [],
    description: existing?.description || "",
    coverVideo: existing?.cover_video || "",
  }));
  const [videoBusy, setVideoBusy] = useState(false);
  // Each photo: { key, url (once uploaded), preview, state: 'up' | 'ok' | 'err', file }
  const [photos, setPhotos] = useState(() => (existing?.photos ?? []).map((url) => ({ key: url, url, preview: url, state: "ok" })));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [folder] = useState(() => `BLD-${existing?.code || Math.random().toString(36).slice(2, 10).toUpperCase()}`);
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));
  const pin = useMemo(() => (f.latitude != null ? [Number(f.latitude), Number(f.longitude)] : null), [f.latitude, f.longitude]);
  const uploading = photos.some((p) => p.state === "up");

  const upload = async (item) => {
    setPhotos((cur) => cur.map((p) => (p.key === item.key ? { ...p, state: "up" } : p)));
    let failed = "";
    const [url] = await uploadInventoryPhotos([item.file], folder, null, (_, msg) => { failed = msg; });
    setPhotos((cur) => cur.map((p) => (p.key === item.key ? (url ? { ...p, url, state: "ok" } : { ...p, state: "err" }) : p)));
    if (!url) toast(failed || "A photo didn't upload — tap it to retry.", "error");
  };

  const onFiles = (list) => {
    const fresh = [];
    for (const file of list) {
      const why = mediaRejectionReason(file);
      if (why) { toast(why, "error"); continue; }
      fresh.push({ key: `${file.name}-${file.size}-${Math.random()}`, file, preview: URL.createObjectURL(file), state: "up" });
    }
    setPhotos((cur) => [...cur, ...fresh].slice(0, 30));
    fresh.forEach(upload);
  };

  const toggleAmenity = (a) => set({ amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] });

  const save = async () => {
    const e = {};
    if (f.name.trim().length < 2) e.name = "Give the property a name tenants will recognise";
    if (!f.area.trim()) e.area = "Which locality is it in?";
    if (f.totalFloors && !(Number(f.totalFloors) >= 0 && Number(f.totalFloors) <= 80)) e.totalFloors = "Between 0 and 80";
    setErrors(e);
    if (Object.keys(e).length) { window.scrollTo(0, 0); return; }
    if (uploading || videoBusy) { toast("Hold on — still uploading."); return; }
    setSaving(true);
    try {
      let { latitude, longitude } = f;
      if (latitude == null) {
        const g = await geocodePlace(`${f.landmark ? `${f.landmark}, ` : ""}${f.area}, Bengaluru`).catch(() => null);
        if (g?.ok) { latitude = g.lat; longitude = g.lng; }
      }
      const r = await saveBuilding({
        ...(existing ? { id: existing.id } : {}),
        name: f.name.trim(), area: f.area.trim(), landmark: f.landmark.trim(), full_address: f.fullAddress.trim(),
        latitude: latitude ?? "", longitude: longitude ?? "", total_floors: f.totalFloors,
        amenities: f.amenities, description: f.description.trim(),
        photos: photos.filter((p) => p.state === "ok" && p.url).map((p) => p.url),
        cover_video: f.coverVideo,
      });
      await reloadBuildings();
      toast(existing ? "Saved" : "Property added — now add its flats");
      navigate(op(`/buildings/${r.id}`), { replace: true });
    } catch (ex) {
      toast(friendlyError(ex, "Could not save the property."), "error");
      setSaving(false);
    }
  };

  const err = (k) => errors[k] && <div className="oz-err">{errors[k]}</div>;
  return (
    <>
      <TopBar title={existing ? "Edit property" : "New property"} back />
      <div className="oz-pad">
        <div className="oz-section">
          <h2 className="oz-h2">The property</h2>
          <p className="oz-hint" style={{ margin: "-4px 0 12px" }}>
            A building or PG with one or more flats. It gets its own QR — tenants scan it, see every flat floor by floor, and book a visit.
          </p>
          <div className="oz-field">
            <label className="oz-label" htmlFor="bf-name">Name</label>
            <input id="bf-name" className="oz-input" placeholder="Sunrise Residency" value={f.name} onChange={(e) => set({ name: e.target.value.slice(0, 80) })} />
            {err("name")}
          </div>
          <div className="oz-grid2">
            <div className="oz-field">
              <label className="oz-label" htmlFor="bf-area">Locality</label>
              <input id="bf-area" className="oz-input" list="bf-localities" placeholder="HSR Layout" value={f.area} onChange={(e) => set({ area: e.target.value })} />
              <datalist id="bf-localities">{ALL_LOCALITIES.map((a) => <option key={a} value={a} />)}</datalist>
              {err("area")}
            </div>
            <div className="oz-field">
              <label className="oz-label" htmlFor="bf-floors">Floors above ground</label>
              <input id="bf-floors" className="oz-input" inputMode="numeric" placeholder="4" value={f.totalFloors}
                onChange={(e) => set({ totalFloors: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
              {err("totalFloors")}
            </div>
          </div>
          <div className="oz-field">
            <label className="oz-label" htmlFor="bf-landmark">Landmark <span className="oz-hint">(shown to tenants)</span></label>
            <input id="bf-landmark" className="oz-input" placeholder="Near Agara Lake" value={f.landmark} onChange={(e) => set({ landmark: e.target.value.slice(0, 160) })} />
          </div>
          <ListingMapPicker height={160} focusQuery={f.area ? `${f.area}, Bengaluru` : ""} markerPosition={pin}
            onMarkerChange={([lat, lng]) => set({ latitude: lat, longitude: lng })} />
          <div className="oz-field" style={{ marginTop: 12, marginBottom: 0 }}>
            <label className="oz-label" htmlFor="bf-addr">Full address <span className="oz-hint">(never on the QR page — the partner shares it after confirming a visit)</span></label>
            <input id="bf-addr" className="oz-input" placeholder="Building no., street" value={f.fullAddress} onChange={(e) => set({ fullAddress: e.target.value.slice(0, 400) })} />
          </div>
        </div>

        <div className="oz-section">
          <h2 className="oz-h2">Cover video</h2>
          <p className="oz-hint" style={{ margin: "-4px 0 12px" }}>A short walk-through — the first thing a tenant sees after scanning the QR.</p>
          {f.coverVideo ? (
            <div style={{ position: "relative" }}>
              <video src={f.coverVideo} controls playsInline style={{ width: "100%", maxHeight: 260, borderRadius: 12, background: "#000", display: "block" }} />
              <button type="button" className="oz-btn oz-btn--sm" style={{ position: "absolute", top: 8, right: 8 }} onClick={() => set({ coverVideo: "" })}><X size={14} /> Remove</button>
            </div>
          ) : (
            <label className="oz-btn" style={{ width: "100%", borderStyle: "dashed", cursor: "pointer" }}>
              {videoBusy ? <><Loader2 size={18} className="bf-spin" /> {typeof videoBusy === "string" ? videoBusy : "Uploading the video…"}</> : <><Camera size={18} /> Add a video</>}
              <input type="file" accept="video/*" hidden disabled={videoBusy} onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const why = mediaRejectionReason(file);
                if (why) { toast(why, "error"); return; }
                setVideoBusy(true);
                const [url] = await uploadInventoryPhotos([file], folder, null, (_, msg) => toast(msg || "The video didn't upload", "error"),
                  { onShrink: (_f, p) => setVideoBusy(p >= 100 ? true : `Shrinking the video — ${p}%`) });
                setVideoBusy(false);
                if (url) set({ coverVideo: url });
              }} />
            </label>
          )}
        </div>

        <div className="oz-section">
          <h2 className="oz-h2">Photos <span className="oz-hint" style={{ fontWeight: 500 }}>{photos.length}/30</span></h2>
          <p className="oz-hint" style={{ margin: "-4px 0 12px" }}>The outside, the entrance, the lobby, the terrace — the first photo leads the QR page and the poster.</p>
          <div className="bf-photos">
            {photos.map((p, i) => (
              <div key={p.key} className="bf-photo">
                <img src={p.preview} alt="" />
                {i === 0 && <span className="bf-cover">Cover</span>}
                {p.state === "up" && <span className="bf-state"><Loader2 size={18} className="bf-spin" /></span>}
                {p.state === "ok" && <span className="bf-state bf-state--ok"><Check size={13} /></span>}
                {p.state === "err" && (
                  <button type="button" className="bf-state bf-state--err" onClick={() => upload(p)} aria-label="Retry upload"><RotateCw size={15} /></button>
                )}
                <button type="button" className="bf-x" aria-label="Remove photo" onClick={() => setPhotos((cur) => cur.filter((x) => x.key !== p.key))}><X size={14} /></button>
              </div>
            ))}
            {photos.length < 30 && (
              <label className="bf-photo bf-photo--add">
                <Camera size={22} />
                <span>Add photos</span>
                <input type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles([...e.target.files]); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </div>

        <div className="oz-section">
          <h2 className="oz-h2">Amenities</h2>
          <div className="oz-chips">
            {BUILDING_AMENITIES.map((a) => <Chip key={a} on={f.amenities.includes(a)} onClick={() => toggleAmenity(a)}>{a}</Chip>)}
          </div>
          <div className="oz-field" style={{ marginTop: 14, marginBottom: 0 }}>
            <label className="oz-label" htmlFor="bf-desc">About the property <span className="oz-hint">(optional)</span></label>
            <textarea id="bf-desc" className="oz-textarea" rows={3} placeholder="Quiet lane, 5 minutes to the ORR, family-run building…"
              value={f.description} onChange={(e) => set({ description: e.target.value.slice(0, 2000) })} />
          </div>
        </div>

        <button type="button" className="oz-btn oz-btn--primary oz-btn--block" onClick={save} disabled={saving}>
          {saving ? "Saving…" : uploading || videoBusy ? "Uploading…" : existing ? "Save changes" : "Create property & QR"}
        </button>
      </div>
      <style>{`
        .bf-photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .bf-photo { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: #E9E4D6; }
        .bf-photo img { width: 100%; height: 100% !important; object-fit: cover; display: block; }
        .bf-photo--add { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border: 1.5px dashed var(--champ);
          background: var(--champ2); color: var(--champ3); font-size: 12px; font-weight: 700; cursor: pointer; }
        .bf-cover { position: absolute; left: 6px; bottom: 6px; background: var(--deep); color: #fff; font-size: 10.5px; font-weight: 700; border-radius: 99px; padding: 2px 8px; }
        .bf-state { position: absolute; left: 6px; top: 6px; width: 26px; height: 26px; border-radius: 99px; display: grid; place-items: center;
          background: rgba(255,255,255,.92); color: var(--em); border: 0; }
        .bf-state--ok { background: var(--em); color: #fff; width: 20px; height: 20px; }
        .bf-state--err { background: var(--red); color: #fff; cursor: pointer; }
        .bf-x { position: absolute; right: 6px; top: 6px; width: 24px; height: 24px; border-radius: 99px; border: 0; background: rgba(0,0,0,.55); color: #fff;
          display: grid; place-items: center; cursor: pointer; }
        .bf-spin { animation: bfspin .8s linear infinite; }
        @keyframes bfspin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
