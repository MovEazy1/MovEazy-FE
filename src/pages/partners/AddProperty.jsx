/**
 * Add a property — one question a screen, tap and Next:
 *
 *   1. House type    1 RK … 5 BHK, room in a shared flat (1 BHK preselected)
 *   2. Rent          a number
 *   3. Location      locality (HSR preselected) + a Google Maps link or a pin
 *   4. Photos        from the gallery; each uploads the moment it's picked, with
 *                    a tick or a retry per photo, so nothing is lost silently
 *   5. Who sees it   only me / groups / all brokers
 *
 * Publishing writes the listing with its photos in one go. Everything else
 * (name, the WhatsApp text, deposit, owner contact) is "Add more details",
 * any time after (PropertyDetails.jsx).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, Check, ChevronLeft, Link2, MapPin, RotateCcw, Search, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePartner } from "./PartnerApp";
import ShareWithForm, { EMPTY_SHARE, toSharing } from "./ShareWithForm";
import { Chip, toast } from "./partnerUi";
import { useLocalities } from "./useLocalities";
import ListingMapPicker from "../../components/ListingMapPicker";
import { HOUSE_TYPES, POPULAR_LOCATIONS, ROOM_LABEL } from "../../lib/partnerFilters";
import { bedroomsOf } from "../../lib/partnerMatch";
import { geocodePlace } from "../../lib/geocode";
import { generatePropertyId, mediaRejectionReason, uploadInventoryPhotos } from "../../lib/inventory";
import { isVideoFile, orderListingMedia } from "../../lib/listingMedia";
import { resolveMapsLink } from "../../lib/mapLink";
import { createPartnerListing, friendlyError, inr, pp } from "../../lib/partners";

const STEPS = ["type", "rent", "location", "photos", "share"];
const TITLES = {
  type: "What kind of home?",
  rent: "Monthly rent?",
  location: "Where is it?",
  photos: "Add photos",
  share: "Who should see it?",
};
const RENT_CHIPS = [15000, 20000, 25000, 30000, 40000, 50000];

/** A fresh flow each time "Add another" is tapped. */
export default function AddProperty() {
  const [n, setN] = useState(0);
  return <AddPropertyFlow key={n} onAnother={() => { setN((x) => x + 1); window.scrollTo(0, 0); }} />;
}

function AddPropertyFlow({ onAnother }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { groups, reloadInventory } = usePartner();
  const localities = useLocalities();
  const [pid] = useState(() => generatePropertyId());
  const [step, setStep] = useState(0);
  const [type, setType] = useState("1 BHK");
  const [rent, setRent] = useState("");
  const [area, setArea] = useState("HSR Layout");
  const [areaQ, setAreaQ] = useState("");
  const [pin, setPin] = useState(null); // [lat, lng]
  const [pinFrom, setPinFrom] = useState(""); // "link" | "map"
  const [link, setLink] = useState("");
  const [linkState, setLinkState] = useState(""); // "" | "reading" | "bad"
  const [showMap, setShowMap] = useState(false);
  const [photos, setPhotos] = useState([]); // { key, file, preview, status, url }
  const [share, setShare] = useState(EMPTY_SHARE);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  // Free the previews when the flow goes away.
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  const key = STEPS[step];
  const uploading = photos.some((p) => p.status === "uploading");
  const areaMatches = useMemo(() => {
    const q = areaQ.trim().toLowerCase();
    return q.length < 2 ? [] : localities.filter((a) => a.toLowerCase().includes(q)).slice(0, 8);
  }, [areaQ, localities]);

  const go = (n) => { setErr(""); setStep(n); window.scrollTo(0, 0); };
  const next = () => {
    if (key === "rent" && !(Number(rent) >= 1000)) { setErr("Enter the monthly rent in rupees."); return; }
    if (key === "location" && !area) { setErr("Pick the locality."); return; }
    if (key === "photos" && uploading) { setErr("Wait for the photos to finish uploading."); return; }
    go(step + 1);
  };
  const back = () => (step === 0 ? navigate(-1) : go(step - 1));

  const readLink = async (value) => {
    const v = String(value ?? link).trim();
    if (!v) return;
    setLinkState("reading");
    const c = await resolveMapsLink(v);
    if (c) {
      setPin([c.lat, c.lng]);
      setPinFrom("link");
      setLinkState("");
      setShowMap(false);
    } else {
      setLinkState("bad");
    }
  };

  const upload = async (item) => {
    setPhotos((cur) => cur.map((p) => (p.key === item.key ? { ...p, status: "uploading" } : p)));
    let why = "";
    const [url] = await uploadInventoryPhotos([item.file], pid, null, (_f, msg) => { why = msg; });
    setPhotos((cur) => cur.map((p) => (p.key === item.key ? { ...p, status: url ? "done" : "failed", url: url || "", why } : p)));
  };

  const addFiles = (list) => {
    const items = [];
    for (const file of list) {
      const why = mediaRejectionReason(file);
      if (why) { toast(why, "error"); continue; }
      items.push({ key: `${Date.now()}-${Math.random()}`, file, preview: URL.createObjectURL(file), status: "uploading", url: "" });
    }
    const room = Math.max(0, 20 - photos.length);
    const take = items.slice(0, room);
    if (items.length > room) toast("Up to 20 photos per listing.", "error");
    setPhotos((cur) => [...cur, ...take]);
    take.forEach(upload);
  };

  const removePhoto = (k) => setPhotos((cur) => {
    const hit = cur.find((p) => p.key === k);
    if (hit) URL.revokeObjectURL(hit.preview);
    return cur.filter((p) => p.key !== k);
  });

  const publish = async () => {
    if (uploading) { setErr("Wait for the photos to finish uploading."); return; }
    setSaving(true);
    setErr("");
    try {
      let [latitude, longitude] = pin || [null, null];
      if (latitude == null) {
        // A listing the map cannot plot is invisible on moveazy.co.in; the locality centre is better than nothing.
        const g = await geocodePlace(`${area}, Bengaluru`).catch(() => null);
        if (g?.ok) { latitude = g.lat; longitude = g.lng; }
      }
      const images = orderListingMedia(photos.filter((p) => p.status === "done").map((p) => p.url));
      const room = type === ROOM_LABEL;
      const id = await createPartnerListing({
        propertyId: pid,
        postedBy: "broker",
        propertyType: room ? "Shared Room" : "Apartment",
        flatType: type,
        bedrooms: room ? 1 : Math.max(1, Math.floor(bedroomsOf(type) || 1)),
        rent,
        furnishing: "",
        area,
        latitude, longitude,
        title: `${type} in ${area}`,
        images,
      }, user, toSharing(share));
      await reloadInventory();
      setDone({ id, images: images.length });
    } catch (e) {
      setErr(friendlyError(e, "Could not add the property."));
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="ap">
        <style>{CSS}</style>
        <div className="ap-done">
          <span className="ap-done-ic"><Check size={34} /></span>
          <h1>Listed!</h1>
          <p>{type} in {area} · {inr(rent)}/month{done.images ? ` · ${done.images} photo${done.images === 1 ? "" : "s"}` : ""}</p>
          <Link className="pz-btn pz-btn--primary pz-btn--block" to={pp(`/property/${done.id}?details=1`)} replace>Add more details</Link>
          <p className="pz-hint" style={{ margin: "8px 0 16px" }}>Give it a name and paste the full WhatsApp message — any time.</p>
          <div className="pz-actions" style={{ marginTop: 0 }}>
            <Link className="pz-btn" to={pp(`/property/${done.id}`)} replace>View listing</Link>
            <button type="button" className="pz-btn" onClick={onAnother}>Add another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ap">
      <style>{CSS}</style>
      <header className="ap-top">
        <button type="button" className="pz-iconbtn" aria-label="Back" onClick={back}><ChevronLeft size={24} /></button>
        <div className="ap-bar" aria-hidden><i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
        <span className="ap-count">{step + 1}/{STEPS.length}</span>
      </header>

      <main className="ap-body">
        <h1 className="ap-q">{TITLES[key]}</h1>

        {key === "type" && (
          <div className="ap-grid">
            {HOUSE_TYPES.map((t) => (
              <button key={t} type="button" className={`ap-opt${type === t ? " on" : ""}${t === ROOM_LABEL ? " wide" : ""}`} onClick={() => setType(t)}>
                {t === ROOM_LABEL ? "Room in pre-occupied flat" : t}
                {type === t && <Check size={18} />}
              </button>
            ))}
          </div>
        )}

        {key === "rent" && (
          <>
            <label className="ap-money">
              <span>₹</span>
              <input autoFocus inputMode="numeric" placeholder="25,000" aria-label="Monthly rent in rupees" enterKeyHint="next"
                value={rent ? Number(rent).toLocaleString("en-IN") : ""}
                onChange={(e) => setRent(e.target.value.replace(/\D/g, "").slice(0, 7))}
                onKeyDown={(e) => { if (e.key === "Enter") next(); }} />
              <small>/ month</small>
            </label>
            <div className="pz-chips" style={{ marginTop: 14 }}>
              {RENT_CHIPS.map((r) => <Chip key={r} on={Number(rent) === r} onClick={() => setRent(String(r))}>{inr(r)}</Chip>)}
            </div>
          </>
        )}

        {key === "location" && (
          <>
            <span className="pz-label">Locality</span>
            <div className="pz-chips">
              {[...new Set([area, ...POPULAR_LOCATIONS])].filter(Boolean).map((a) => (
                <Chip key={a} on={area === a} onClick={() => setArea(a)}>{a}</Chip>
              ))}
            </div>
            <div className="pz-search" style={{ marginTop: 10 }}>
              <Search size={17} />
              <input className="pz-input" placeholder="Search another area" value={areaQ} onChange={(e) => setAreaQ(e.target.value)} aria-label="Search localities" />
            </div>
            {areaMatches.length > 0 && (
              <div className="pz-chips" style={{ marginTop: 8 }}>
                {areaMatches.map((a) => <Chip key={a} onClick={() => { setArea(a); setAreaQ(""); }}>+ {a}</Chip>)}
              </div>
            )}
            {areaQ.trim().length >= 2 && areaMatches.length === 0 && <p className="pz-hint">No area by that name — pick the closest one.</p>}

            <span className="pz-label" style={{ marginTop: 20 }}>Exact location <span className="pz-hint">(optional)</span></span>
            <div className="pz-search">
              <Link2 size={17} />
              <input className="pz-input" placeholder="Paste Google Maps link" value={link} inputMode="url"
                onChange={(e) => { setLink(e.target.value); setLinkState(""); }}
                onPaste={(e) => { const v = e.clipboardData.getData("text"); setTimeout(() => readLink(v), 0); }}
                onBlur={() => readLink()} aria-label="Google Maps link" />
            </div>
            {linkState === "reading" && <p className="pz-hint">Reading the link…</p>}
            {linkState === "bad" && <p className="pz-err">Couldn’t read a location from that link — pick it on the map instead.</p>}
            {pin && (
              <p className="ap-pinned"><MapPin size={15} /> Pinned {pinFrom === "link" ? "from your link" : "on the map"} · {pin[0].toFixed(4)}, {pin[1].toFixed(4)}
                <button type="button" onClick={() => { setPin(null); setPinFrom(""); setLink(""); }} aria-label="Clear pin"><X size={14} /></button>
              </p>
            )}
            <button type="button" className="pz-btn" style={{ width: "100%", marginTop: 10 }} onClick={() => setShowMap((m) => !m)}>
              <MapPin size={17} /> {showMap ? "Hide map" : "Select on map"}
            </button>
            {showMap && (
              <div style={{ marginTop: 10 }}>
                <ListingMapPicker height={240} focusQuery={`${area}, Bengaluru`} markerPosition={pin}
                  onMarkerChange={([lat, lng]) => { setPin([lat, lng]); setPinFrom("map"); }} />
              </div>
            )}
          </>
        )}

        {key === "photos" && (
          <>
            <button type="button" className="ap-drop" onClick={() => fileRef.current?.click()}>
              <Camera size={28} />
              <b>{photos.length ? "Add more from gallery" : "Choose from gallery"}</b>
              <span>Photos or a short video · up to 20</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden
              onChange={(e) => { addFiles([...e.target.files]); e.target.value = ""; }} />
            {photos.length > 0 && (
              <div className="ap-thumbs">
                {photos.map((p) => (
                  <figure key={p.key} className={`ap-thumb ${p.status}`}>
                    {isVideoFile(p.file) ? <video src={p.preview} muted playsInline /> : <img src={p.preview} alt="" />}
                    <span className="ap-state" aria-label={p.status}>
                      {p.status === "uploading" && <i className="ap-spin" />}
                      {p.status === "done" && <Check size={14} />}
                      {p.status === "failed" && <button type="button" onClick={() => upload(p)} aria-label="Retry upload"><RotateCcw size={14} /></button>}
                    </span>
                    <button type="button" className="ap-rm" onClick={() => removePhoto(p.key)} aria-label="Remove photo"><X size={14} /></button>
                  </figure>
                ))}
              </div>
            )}
            {photos.some((p) => p.status === "failed") && (
              <p className="pz-err">Some photos didn’t upload{photos.find((p) => p.why)?.why ? ` (${photos.find((p) => p.why).why})` : ""}. Tap ↻ to retry, or remove them.</p>
            )}
            {photos.length > 0 && !uploading && !photos.some((p) => p.status === "failed") && (
              <p className="ap-ok"><Check size={15} /> {photos.length} uploaded</p>
            )}
          </>
        )}

        {key === "share" && <ShareWithForm value={share} onChange={setShare} groups={groups} />}

        {err && <p className="pz-err" role="alert">{err}</p>}
      </main>

      <footer className="ap-foot">
        {key === "photos" && photos.length === 0 && (
          <button type="button" className="pz-btn" onClick={next}>Skip for now</button>
        )}
        {key === "share" ? (
          <button type="button" className="pz-btn pz-btn--primary pz-btn--block" onClick={publish} disabled={saving || uploading}>
            {saving ? "Publishing…" : "Publish"}
          </button>
        ) : (
          <button type="button" className="pz-btn pz-btn--primary pz-btn--block" onClick={next} disabled={key === "photos" && uploading}>
            {key === "photos" && uploading ? "Uploading…" : "Next"}
          </button>
        )}
      </footer>
    </div>
  );
}

const CSS = `
.ap { min-height: 100dvh; display: flex; flex-direction: column; background: var(--card); }
.ap-top { position: sticky; top: 0; z-index: 5; background: var(--card); display: flex; align-items: center; gap: 10px; padding: 8px 12px; }
.ap-bar { flex: 1; height: 6px; border-radius: 99px; background: var(--gl); overflow: hidden; }
.ap-bar i { display: block; height: 100%; background: var(--g); border-radius: 99px; transition: width .25s ease; }
.ap-count { font-size: 13px; color: var(--dim); font-weight: 600; min-width: 28px; text-align: right; }
.ap-body { flex: 1; padding: 12px 18px 24px; animation: apin .2s ease; }
@keyframes apin { from { opacity: 0; transform: translateX(12px); } }
.ap-q { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin: 6px 0 20px; }
.ap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.ap-opt { display: flex; align-items: center; justify-content: space-between; min-height: 60px; padding: 0 16px; border-radius: 14px; border: 1.5px solid var(--line);
  background: #fff; font: inherit; font-size: 17px; font-weight: 700; color: var(--ink); cursor: pointer; text-align: left; }
.ap-opt.wide { grid-column: 1 / -1; }
.ap-opt.on { border-color: var(--g); background: var(--gl); color: var(--g2); }
.ap-money { display: flex; align-items: baseline; gap: 8px; border-bottom: 2px solid var(--g); padding: 6px 0 10px; }
.ap-money span { font-size: 34px; font-weight: 800; color: var(--dim); }
.ap-money input { flex: 1; min-width: 0; border: 0; outline: 0; font: inherit; font-size: 40px; font-weight: 800; letter-spacing: -0.02em; background: transparent; color: var(--ink); }
.ap-money small { font-size: 15px; color: var(--dim); }
.ap-pinned { display: flex; align-items: center; gap: 6px; margin: 10px 0 0; font-size: 13.5px; color: var(--g2); font-weight: 700; }
.ap-pinned button { border: 0; background: var(--gl); border-radius: 99px; width: 24px; height: 24px; display: grid; place-items: center; cursor: pointer; margin-left: auto; }
.ap-drop { width: 100%; display: grid; justify-items: center; gap: 6px; padding: 28px 16px; border-radius: 18px; border: 2px dashed var(--gl2);
  background: var(--gl); color: var(--g2); font: inherit; cursor: pointer; }
.ap-drop b { font-size: 17px; }
.ap-drop span { font-size: 13px; color: var(--dim); }
.ap-thumbs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 14px; }
.ap-thumb { position: relative; margin: 0; aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: #E5E7EB; }
.ap-thumb img, .ap-thumb video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.ap-thumb.uploading img, .ap-thumb.uploading video { opacity: .55; }
.ap-thumb.failed { outline: 2px solid var(--red); }
.ap-state { position: absolute; left: 6px; bottom: 6px; width: 26px; height: 26px; border-radius: 99px; background: #fff; display: grid; place-items: center; color: var(--g); box-shadow: 0 2px 8px rgba(0,0,0,.2); }
.ap-thumb.failed .ap-state { color: var(--red); }
.ap-state button { border: 0; background: none; color: inherit; display: grid; place-items: center; cursor: pointer; padding: 0; }
.ap-spin { width: 14px; height: 14px; border-radius: 99px; border: 2px solid var(--gl2); border-top-color: var(--g); animation: apspin .7s linear infinite; }
@keyframes apspin { to { transform: rotate(360deg); } }
.ap-rm { position: absolute; top: 6px; right: 6px; width: 26px; height: 26px; border-radius: 99px; border: 0; background: rgba(17,24,39,.65); color: #fff; display: grid; place-items: center; cursor: pointer; }
.ap-ok { display: flex; align-items: center; gap: 6px; color: var(--g2); font-weight: 700; font-size: 14px; }
.ap-foot { position: sticky; bottom: 0; background: linear-gradient(rgba(255,255,255,0), #fff 24%); padding: 14px 18px calc(14px + env(safe-area-inset-bottom)); display: flex; gap: 10px; }
.ap-done { padding: 56px 22px 24px; text-align: center; }
.ap-done-ic { width: 76px; height: 76px; border-radius: 99px; background: var(--g); color: #fff; display: grid; place-items: center; margin: 0 auto 16px; animation: appop .4s ease; }
@keyframes appop { 0% { transform: scale(.4); } 70% { transform: scale(1.1); } }
.ap-done h1 { font-size: 30px; margin: 0 0 6px; letter-spacing: -0.02em; }
.ap-done p { color: var(--dim); margin: 0 0 22px; }
`;
