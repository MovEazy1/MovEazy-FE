/**
 * Post a flat — one screen, under a minute.
 *
 *   Photos       first: pick from the gallery and they upload in the background
 *                while the rest is filled in (a tick or a retry per photo).
 *   The flat     type, rent, furnishing, locality — taps, not typing. 1 BHK and
 *                the last locality used are already selected.
 *   Who sees it  only me / all MovEazy brokers at a share / groups — remembered.
 *   More         deposit, move-in date, floor, the owner's contact, the
 *                WhatsApp message (saved as written) and a name — all optional.
 *
 * One Publish at the bottom, live as soon as type, rent and locality are set.
 * "Post another" keeps the locality, furnishing and sharing: brokers post
 * several flats from the same area in a row.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Camera, Check, ChevronDown, ChevronLeft, ClipboardPaste, Link2, Lock, MapPin, RotateCcw, Search, Share2, Sparkles, Users, X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePartner } from "./PartnerApp";
import ShareWithForm, { EMPTY_SHARE, PCT_OPTIONS, shareSummary, toSharing } from "./ShareWithForm";
import { cleanPasted } from "./PropertyDetailsSheet";
import { Sheet, WhatsAppIcon, toast } from "./partnerUi";
import { useLocalities } from "./useLocalities";
import ListingMapPicker from "../../components/ListingMapPicker";
import { FURNISHING_CHIPS, HOUSE_TYPES, POPULAR_LOCATIONS, ROOM_LABEL } from "../../lib/partnerFilters";
import { bedroomsOf } from "../../lib/partnerMatch";
import { geocodePlace } from "../../lib/geocode";
import { generatePropertyId, mediaRejectionReason, uploadInventoryPhotos } from "../../lib/inventory";
import { isVideoFile, orderListingMedia } from "../../lib/listingMedia";
import { resolveMapsLink } from "../../lib/mapLink";
import { normalizeIndianMobile } from "../../lib/mobile";
import { PUBLIC_ORIGIN, createPartnerListing, friendlyError, inr, pp, saveOwnContacts } from "../../lib/partners";

const RENT_CHIPS = [15000, 20000, 25000, 30000, 40000, 50000];
const PREFS_KEY = "mz_partner_post";
const typeLabel = (t) => (t === ROOM_LABEL ? "Room in a shared flat" : t);

function readPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || "null") || {}; } catch { return {}; }
}
function savePrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* private tab */ }
}

/** A fresh form each time "Post another" is tapped, carrying the area, furnishing and sharing. */
export default function AddProperty() {
  const [n, setN] = useState(0);
  return <PostFlat key={n} onAnother={() => { setN((x) => x + 1); window.scrollTo(0, 0); }} />;
}

function PostFlat({ onAnother }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { groups, reloadInventory } = usePartner();
  const localities = useLocalities();
  const [prefs] = useState(readPrefs);
  const [pid] = useState(() => generatePropertyId());

  const [photos, setPhotos] = useState([]); // { key, file, preview, status, url, why }
  const [type, setType] = useState("1 BHK");
  const [rent, setRent] = useState("");
  const [furnishing, setFurnishing] = useState(prefs.furnishing || "");
  const [area, setArea] = useState(prefs.area || "HSR Layout");
  const [areaQ, setAreaQ] = useState("");
  const [pin, setPin] = useState(null);
  const [link, setLink] = useState("");
  const [linkState, setLinkState] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [share, setShare] = useState(prefs.share || EMPTY_SHARE);
  const [shareSheet, setShareSheet] = useState(false);
  const [more, setMore] = useState(false);
  const [x, setX] = useState({ deposit: "", availableFrom: "", floor: "", ownerName: "", ownerPhone: "", description: "", title: "" });
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState([]);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  const fileRef = useRef(null);
  const rentRef = useRef(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  const setMoreField = (patch) => setX((cur) => ({ ...cur, ...patch }));
  const uploading = photos.some((p) => p.status === "uploading");
  const uploaded = photos.filter((p) => p.status === "done").length;
  const recentAreas = useMemo(() => [...new Set([area, ...(prefs.areas || []), ...POPULAR_LOCATIONS])].filter(Boolean).slice(0, 7), [area, prefs.areas]);
  const areaMatches = useMemo(() => {
    const q = areaQ.trim().toLowerCase();
    return q.length < 2 ? [] : localities.filter((a) => a.toLowerCase().includes(q)).slice(0, 8);
  }, [areaQ, localities]);
  const ready = Number(rent) >= 1000 && Boolean(area) && Boolean(type);

  /* ── Photos ─────────────────────────────────────────────────────────────── */
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

  /* ── Location ───────────────────────────────────────────────────────────── */
  const readLink = async (value) => {
    const v = String(value ?? link).trim();
    if (!v) return;
    setLinkState("reading");
    const c = await resolveMapsLink(v);
    if (c) { setPin([c.lat, c.lng]); setLinkState("pinned"); setShowMap(false); } else setLinkState("bad");
  };

  const pasteWhatsApp = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) { setMoreField({ description: cleanPasted(t) }); toast("Pasted"); }
    } catch {
      toast("Long-press the box and tap Paste.");
    }
  };

  /* ── Publish ────────────────────────────────────────────────────────────── */
  const publish = async () => {
    const need = [];
    if (!(Number(rent) >= 1000)) need.push("rent");
    if (!area) need.push("area");
    setMissing(need);
    if (need.length) {
      document.getElementById(`pf-${need[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (need[0] === "rent") setTimeout(() => rentRef.current?.focus(), 300);
      return;
    }
    if (uploading) { setErr("Photos are still uploading — a few seconds."); return; }
    if (x.ownerPhone && !normalizeIndianMobile(x.ownerPhone)) { setMore(true); setErr("The owner's mobile should be 10 digits."); return; }
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
        furnishing,
        deposit: x.deposit,
        availableFrom: x.availableFrom || null,
        floorNumber: x.floor,
        area,
        latitude, longitude,
        title: x.title.trim() || `${type} in ${area}`,
        description: cleanPasted(x.description),
        images,
      }, user, toSharing(share));
      if (x.ownerName.trim() || x.ownerPhone.trim()) {
        await saveOwnContacts(id, [{ role: "owner", name: x.ownerName.trim(), phone: normalizeIndianMobile(x.ownerPhone) || "" }]).catch(() => {});
      }
      savePrefs({ area, furnishing, share, areas: [area, ...(prefs.areas || []).filter((a) => a !== area)].slice(0, 5) });
      reloadInventory();
      setDone({ id, images: images.length });
    } catch (e) {
      setErr(friendlyError(e, "Could not post the flat."));
      setSaving(false);
    }
  };

  if (done) {
    const url = `${PUBLIC_ORIGIN}/property/${done.id}`;
    const msg = `${typeLabel(type)} in ${area} — ${inr(rent)}/month${furnishing ? `, ${furnishing.toLowerCase()}` : ""}. Photos and details: ${url}`;
    return (
      <div className="ap">
        <style>{CSS}</style>
        <div className="ap-done">
          <span className="ap-done-ic"><Check size={34} /></span>
          <h1>It's live!</h1>
          <p>{typeLabel(type)} in {area} · {inr(rent)}/month{done.images ? ` · ${done.images} photo${done.images === 1 ? "" : "s"}` : ""}</p>
          <p className="ap-done-who"><Users size={14} /> {shareSummary(share, groups)}</p>
          <button type="button" className="pz-btn pz-btn--gold pz-btn--block" onClick={onAnother}>+ Post another flat</button>
          <p className="pz-hint" style={{ margin: "6px 0 16px" }}>Keeps {area}{furnishing ? `, ${furnishing.toLowerCase()}` : ""} and who sees it — just add photos and rent.</p>
          <div className="ap-done-row">
            <a className="pz-btn pz-wa" href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><WhatsAppIcon size={16} /> Send to a client</a>
            <Link className="pz-btn" to={pp(`/property/${done.id}`)} replace>View listing</Link>
          </div>
        </div>
      </div>
    );
  }

  const needs = (k) => missing.includes(k);
  return (
    <div className="ap">
      <style>{CSS}</style>
      <header className="ap-top">
        <button type="button" className="pz-iconbtn" aria-label="Back" onClick={() => navigate(-1)}><ChevronLeft size={24} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>Post a flat</h1>
          <span>Takes under a minute · live on MovEazy at once</span>
        </div>
      </header>

      <main className="ap-body">
        {/* Photos */}
        <section className="ap-sec">
          {photos.length === 0 ? (
            <button type="button" className="ap-drop" onClick={() => fileRef.current?.click()}>
              <span className="ap-drop-ic"><Camera size={26} /></span>
              <b>Add photos</b>
              <span>Pick from your gallery — they upload while you fill the rest</span>
            </button>
          ) : (
            <>
              <div className="ap-thumbs">
                {photos.map((p, i) => (
                  <figure key={p.key} className={`ap-thumb ${p.status}`}>
                    {isVideoFile(p.file) ? <video src={p.preview} muted playsInline /> : <img src={p.preview} alt="" />}
                    {i === 0 && <span className="ap-cover">Cover</span>}
                    <span className="ap-state" aria-label={p.status}>
                      {p.status === "uploading" && <i className="ap-spin" />}
                      {p.status === "done" && <Check size={13} />}
                      {p.status === "failed" && <button type="button" onClick={() => upload(p)} aria-label="Retry upload"><RotateCcw size={13} /></button>}
                    </span>
                    <button type="button" className="ap-rm" onClick={() => removePhoto(p.key)} aria-label="Remove photo"><X size={13} /></button>
                  </figure>
                ))}
                {photos.length < 20 && (
                  <button type="button" className="ap-thumb ap-add" onClick={() => fileRef.current?.click()} aria-label="Add more photos"><Camera size={20} /><span>Add</span></button>
                )}
              </div>
              <p className={`ap-photo-state${photos.some((p) => p.status === "failed") ? " bad" : ""}`}>
                {uploading ? <><i className="ap-spin" /> Uploading {uploaded}/{photos.length}…</>
                  : photos.some((p) => p.status === "failed") ? "Some didn't upload — tap ↻ to retry, or remove them."
                    : <><Check size={14} /> {uploaded} uploaded</>}
              </p>
            </>
          )}
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { addFiles([...e.target.files]); e.target.value = ""; }} />
        </section>

        {/* The flat */}
        <section className="ap-sec">
          <h2>Type</h2>
          <div className="ap-chips">
            {HOUSE_TYPES.map((t) => (
              <button key={t} type="button" className={`ap-chip${type === t ? " on" : ""}`} onClick={() => setType(t)}>{t === ROOM_LABEL ? "Room (shared flat)" : t}</button>
            ))}
          </div>
        </section>

        <section className={`ap-sec${needs("rent") ? " need" : ""}`} id="pf-rent">
          <h2>Rent <span>per month</span></h2>
          <label className="ap-money">
            <span>₹</span>
            <input ref={rentRef} inputMode="numeric" placeholder="25,000" aria-label="Monthly rent in rupees" enterKeyHint="done"
              value={rent ? Number(rent).toLocaleString("en-IN") : ""}
              onChange={(e) => { setRent(e.target.value.replace(/\D/g, "").slice(0, 7)); setMissing((m) => m.filter((k) => k !== "rent")); }} />
          </label>
          <div className="ap-chips ap-chips--scroll">
            {RENT_CHIPS.map((r) => (
              <button key={r} type="button" className={`ap-chip ap-chip--sm${Number(rent) === r ? " on" : ""}`}
                onClick={() => { setRent(String(r)); setMissing((m) => m.filter((k) => k !== "rent")); }}>{inr(r)}</button>
            ))}
          </div>
          {needs("rent") && <p className="pz-err">Add the monthly rent.</p>}
        </section>

        <section className="ap-sec">
          <h2>Furnishing</h2>
          <div className="ap-seg">
            {FURNISHING_CHIPS.map((f) => (
              <button key={f} type="button" className={furnishing === f ? "on" : ""} onClick={() => setFurnishing(furnishing === f ? "" : f)}>{f.replace(" Furnished", "")}</button>
            ))}
          </div>
        </section>

        <section className={`ap-sec${needs("area") ? " need" : ""}`} id="pf-area">
          <h2>Locality</h2>
          <div className="ap-chips">
            {recentAreas.map((a) => <button key={a} type="button" className={`ap-chip${area === a ? " on" : ""}`} onClick={() => setArea(a)}>{a}</button>)}
          </div>
          <div className="pz-search" style={{ marginTop: 10 }}>
            <Search size={17} />
            <input className="pz-input" placeholder="Another area…" value={areaQ} onChange={(e) => setAreaQ(e.target.value)} aria-label="Search localities" />
          </div>
          {areaMatches.length > 0 && (
            <div className="ap-chips" style={{ marginTop: 8 }}>
              {areaMatches.map((a) => <button key={a} type="button" className="ap-chip" onClick={() => { setArea(a); setAreaQ(""); }}>+ {a}</button>)}
            </div>
          )}
          {areaQ.trim().length >= 2 && areaMatches.length === 0 && <p className="pz-hint">No area by that name — pick the closest one.</p>}
          {pin ? (
            <p className="ap-pinned"><MapPin size={15} /> Exact location pinned
              <button type="button" onClick={() => { setPin(null); setLink(""); setLinkState(""); }} aria-label="Clear pin"><X size={14} /></button></p>
          ) : (
            <div className="ap-pinrow">
              <div className="pz-search" style={{ flex: 1 }}>
                <Link2 size={16} />
                <input className="pz-input" placeholder="Paste Google Maps link (optional)" value={link} inputMode="url"
                  onChange={(e) => { setLink(e.target.value); setLinkState(""); }}
                  onPaste={(e) => { const v = e.clipboardData.getData("text"); setTimeout(() => readLink(v), 0); }}
                  onBlur={() => readLink()} aria-label="Google Maps link" />
              </div>
              <button type="button" className="pz-btn" onClick={() => setShowMap((m) => !m)} aria-label="Pin on map"><MapPin size={17} /></button>
            </div>
          )}
          {linkState === "reading" && <p className="pz-hint">Reading the link…</p>}
          {linkState === "bad" && <p className="pz-err">Couldn't read that link — tap the pin to place it on the map.</p>}
          <p className="ap-private">
            <Lock size={12} /> Only you see the exact location. It's shared with a client only after they schedule a visit — and only when you tap Share location.
          </p>
          {showMap && !pin && (
            <div style={{ marginTop: 10 }}>
              <ListingMapPicker height={220} focusQuery={`${area}, Bengaluru`} markerPosition={pin}
                onMarkerChange={([lat, lng]) => { setPin([lat, lng]); setShowMap(false); }} />
            </div>
          )}
        </section>

        {/* Who sees it */}
        <section className="ap-sec">
          <h2>Who sees it</h2>
          <div className="ap-seg ap-seg--two">
            <button type="button" className={!share.platformOn && !Object.keys(share.groupPct).length ? "on" : ""}
              onClick={() => setShare({ ...share, platformOn: false, groupPct: {} })}>Only me</button>
            <button type="button" className={share.platformOn ? "on" : ""} onClick={() => setShare({ ...share, platformOn: !share.platformOn })}>All MovEazy brokers</button>
          </div>
          {share.platformOn && (
            <div className="ap-share-pct">
              <span>Brokerage you share</span>
              <select className="pz-select" value={share.platformPct} onChange={(e) => setShare({ ...share, platformPct: Number(e.target.value) })} aria-label="Brokerage share">
                {PCT_OPTIONS.map((p) => <option key={p} value={p}>{p}%</option>)}
              </select>
            </div>
          )}
          <button type="button" className="ap-link" onClick={() => setShareSheet(true)}>
            <Users size={14} /> {Object.keys(share.groupPct).length ? `Groups: ${shareSummary({ groupPct: share.groupPct }, groups)}` : groups.length ? "Share with my groups" : "Groups & more options"}
          </button>
          <p className="pz-hint" style={{ marginTop: 6 }}>Always live on moveazy.co.in too. Your number is shown only to the brokers you pick.</p>
        </section>

        {/* More, optional */}
        <section className="ap-sec ap-more">
          <button type="button" className="ap-more-h" onClick={() => setMore((m) => !m)} aria-expanded={more}>
            <span><Sparkles size={15} /> More details <small>deposit, move-in, floor, owner, WhatsApp text</small></span>
            <ChevronDown size={18} style={{ transform: more ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
          </button>
          {more && (
            <div className="ap-more-b">
              <div className="ap-two">
                <label><span>Deposit (₹)</span>
                  <input className="pz-input" inputMode="numeric" placeholder="60,000" value={x.deposit ? Number(x.deposit).toLocaleString("en-IN") : ""}
                    onChange={(e) => setMoreField({ deposit: e.target.value.replace(/\D/g, "").slice(0, 8) })} /></label>
                <label><span>Floor</span>
                  <select className="pz-select" value={x.floor} onChange={(e) => setMoreField({ floor: e.target.value })}>
                    <option value="">—</option>
                    <option value="0">Ground</option>
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select></label>
              </div>
              <label><span>Available from</span>
                <div className="ap-chips" style={{ marginBottom: 6 }}>
                  <button type="button" className={`ap-chip ap-chip--sm${!x.availableFrom ? " on" : ""}`} onClick={() => setMoreField({ availableFrom: "" })}>Now</button>
                  <input className="pz-input" type="date" style={{ flex: 1, minWidth: 140 }} value={x.availableFrom} onChange={(e) => setMoreField({ availableFrom: e.target.value })} />
                </div></label>
              <label><span>Owner contact <small>only you and MovEazy see it</small></span>
                <div className="ap-two">
                  <input className="pz-input" placeholder="Name" value={x.ownerName} onChange={(e) => setMoreField({ ownerName: e.target.value })} />
                  <input className="pz-input" inputMode="tel" placeholder="Mobile" value={x.ownerPhone} onChange={(e) => setMoreField({ ownerPhone: e.target.value })} />
                </div></label>
              <label><span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>WhatsApp message
                <button type="button" className="pz-btn pz-btn--sm" onClick={pasteWhatsApp}><ClipboardPaste size={14} /> Paste</button></span>
                <textarea className="pz-textarea" rows={4} value={x.description} onChange={(e) => setMoreField({ description: e.target.value.slice(0, 2000) })}
                  placeholder="Paste the message you send clients — saved as you wrote it." /></label>
              <label><span>Name <small>optional</small></span>
                <input className="pz-input" placeholder={`${typeLabel(type)} in ${area}`} value={x.title} onChange={(e) => setMoreField({ title: e.target.value.slice(0, 160) })} /></label>
            </div>
          )}
        </section>

        {err && <p className="pz-err" role="alert">{err}</p>}
      </main>

      <footer className="ap-foot">
        <div className="ap-sum">
          <b>{typeLabel(type)}{rent ? ` · ${inr(rent)}` : ""}</b>
          <span>{area || "Pick a locality"}{furnishing ? ` · ${furnishing.replace(" Furnished", "")}` : ""} · {photos.length ? `${uploaded} photo${uploaded === 1 ? "" : "s"}` : "no photos"}</span>
        </div>
        <button type="button" className={`pz-btn ${ready ? "pz-btn--gold" : "pz-btn--primary"} ap-publish`} onClick={publish} disabled={saving}>
          {saving ? "Posting…" : uploading && ready ? "Uploading…" : ready ? "Publish" : !(Number(rent) >= 1000) ? "Add rent" : "Publish"}
        </button>
      </footer>

      {shareSheet && (
        <Sheet title="Who sees it" onClose={() => setShareSheet(false)}>
          <div className="pz-pad">
            <ShareWithForm value={share} onChange={setShare} groups={groups} />
            <button type="button" className="pz-btn pz-btn--primary pz-btn--block" style={{ marginTop: 12 }} onClick={() => setShareSheet(false)}>
              <Share2 size={16} /> Done
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

const CSS = `
.ap { min-height: 100dvh; display: flex; flex-direction: column; background: var(--bg, #F5F3EE); }
.ap-top { position: sticky; top: 0; z-index: 5; background: var(--noir, #0E0D12); color: #fff; display: flex; align-items: center; gap: 6px; padding: 10px 12px; }
.ap-top .pz-iconbtn { color: #fff; }
.ap-top h1 { margin: 0; font-size: 19px; font-weight: 800; letter-spacing: -0.01em; color: #fff; }
.ap-top span { font-size: 12px; color: var(--gold, #D4A437); font-weight: 600; }
.ap-body { flex: 1; padding: 12px 12px 20px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; align-content: start; }
.ap-sec { background: #fff; border: 1px solid var(--line, #E7E3DA); border-radius: 16px; padding: 14px; transition: border-color .2s, box-shadow .2s; }
.ap-sec.need { border-color: var(--red, #B42318); box-shadow: 0 0 0 3px rgba(180,35,24,.08); }
.ap-sec h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--dim, #6B7280); margin: 0 0 10px; font-weight: 800; }
.ap-sec h2 span { text-transform: none; letter-spacing: 0; font-weight: 500; }
.ap-drop { width: 100%; display: grid; justify-items: center; gap: 6px; padding: 22px 16px; border-radius: 14px; border: 2px dashed var(--gold, #D4A437);
  background: linear-gradient(180deg, #FFFBEF, #FFF6DD); color: var(--ink, #16141C); font: inherit; cursor: pointer; }
.ap-drop-ic { width: 52px; height: 52px; border-radius: 16px; background: var(--noir, #0E0D12); color: var(--gold, #D4A437); display: grid; place-items: center; }
.ap-drop b { font-size: 17px; }
.ap-drop span { font-size: 12.5px; color: var(--dim, #6B7280); }
.ap-thumbs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.ap-thumb { position: relative; margin: 0; aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: #E5E7EB; }
.ap-thumb img, .ap-thumb video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.ap-thumb.uploading img, .ap-thumb.uploading video { opacity: .55; }
.ap-thumb.failed { outline: 2px solid var(--red, #B42318); }
.ap-add { border: 1.5px dashed var(--gold, #D4A437); background: #FFFBEF; color: var(--gold3, #7A5A12); display: grid; place-items: center; align-content: center; gap: 2px;
  font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
.ap-cover { position: absolute; left: 4px; top: 4px; background: var(--noir, #0E0D12); color: var(--gold, #D4A437); font-size: 9.5px; font-weight: 800; border-radius: 99px; padding: 1px 6px; }
.ap-state { position: absolute; left: 4px; bottom: 4px; width: 22px; height: 22px; border-radius: 99px; background: #fff; display: grid; place-items: center; color: var(--g, #0B6E4F); box-shadow: 0 2px 8px rgba(0,0,0,.2); }
.ap-thumb.failed .ap-state { color: var(--red, #B42318); }
.ap-state button { border: 0; background: none; color: inherit; display: grid; place-items: center; cursor: pointer; padding: 0; }
.ap-spin { display: inline-block; width: 12px; height: 12px; border-radius: 99px; border: 2px solid var(--gl2, #CBE5D9); border-top-color: var(--g, #0B6E4F); animation: apspin .7s linear infinite; }
@keyframes apspin { to { transform: rotate(360deg); } }
.ap-rm { position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border-radius: 99px; border: 0; background: rgba(17,24,39,.65); color: #fff; display: grid; place-items: center; cursor: pointer; }
.ap-photo-state { display: flex; align-items: center; gap: 6px; margin: 10px 0 0; font-size: 13px; font-weight: 700; color: var(--g2, #08503A); }
.ap-photo-state.bad { color: var(--red, #B42318); }
.ap-chips { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
.ap-chips--scroll { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin-top: 12px; }
.ap-chips--scroll::-webkit-scrollbar { display: none; }
.ap-chip { flex: none; border: 1.5px solid var(--line, #E7E3DA); background: #fff; color: var(--ink, #16141C); border-radius: 12px; padding: 10px 14px;
  font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; transition: background .12s, border-color .12s, color .12s; }
.ap-chip:active { transform: scale(.97); }
.ap-chip.on { background: var(--noir, #0E0D12); border-color: var(--noir, #0E0D12); color: #fff; }
.ap-chip--sm { padding: 7px 12px; font-size: 13.5px; border-radius: 99px; }
.ap-money { display: flex; align-items: baseline; gap: 6px; border-bottom: 2px solid var(--gold, #D4A437); padding: 2px 0 8px; }
.ap-money span { font-size: 28px; font-weight: 800; color: var(--dim, #6B7280); }
.ap-money input { flex: 1; min-width: 0; border: 0; outline: 0; font: inherit; font-size: 34px; font-weight: 800; letter-spacing: -0.02em; background: transparent; color: var(--ink, #16141C); }
.ap-seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border: 1.5px solid var(--line, #E7E3DA); border-radius: 12px; overflow: hidden; }
.ap-seg--two { grid-template-columns: 1fr 1fr; }
.ap-seg button { border: 0; border-left: 1px solid var(--line, #E7E3DA); background: #fff; font: inherit; font-size: 14px; font-weight: 700; padding: 11px 6px; cursor: pointer; color: var(--ink, #16141C); }
.ap-seg button:first-child { border-left: 0; }
.ap-seg button.on { background: var(--noir, #0E0D12); color: #fff; }
.ap-share-pct { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 14px; font-weight: 600; }
.ap-share-pct .pz-select { width: 92px; }
.ap-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; border: 0; background: none; color: var(--g, #0B6E4F); font: inherit; font-size: 13.5px; font-weight: 700; cursor: pointer; padding: 0; }
.ap-pinrow { display: flex; gap: 8px; margin-top: 10px; }
.ap-private { display: flex; align-items: flex-start; gap: 6px; margin: 8px 2px 0; font-size: 12px; line-height: 1.45; color: var(--dim, #6B7280); }
.ap-private svg { flex: none; margin-top: 2px; color: var(--gold3, #7A5A12); }
.ap-pinned { display: flex; align-items: center; gap: 6px; margin: 10px 0 0; font-size: 13.5px; color: var(--g2, #08503A); font-weight: 700; }
.ap-pinned button { border: 0; background: var(--gl, #E4F2EC); border-radius: 99px; width: 24px; height: 24px; display: grid; place-items: center; cursor: pointer; margin-left: auto; }
.ap-more { padding: 0; }
.ap-more-h { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px; border: 0; background: none; font: inherit; cursor: pointer; text-align: left; color: var(--ink, #16141C); }
.ap-more-h span { display: flex; align-items: center; gap: 7px; font-weight: 800; font-size: 15px; flex-wrap: wrap; }
.ap-more-h svg { color: var(--gold, #D4A437); }
.ap-more-h small { font-weight: 500; font-size: 12px; color: var(--dim, #6B7280); flex-basis: 100%; padding-left: 22px; }
.ap-more-b { padding: 0 14px 14px; display: grid; gap: 12px; }
.ap-more-b label { display: grid; gap: 6px; }
.ap-more-b label > span { font-size: 13px; font-weight: 700; }
.ap-more-b label small { font-weight: 500; color: var(--dim, #6B7280); }
.ap-two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ap-foot { position: sticky; bottom: 0; z-index: 5; background: #fff; border-top: 1px solid var(--line, #E7E3DA); padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  display: flex; align-items: center; gap: 10px; box-shadow: 0 -6px 18px rgba(0,0,0,.06); }
.ap-sum { flex: 1; min-width: 0; display: grid; }
.ap-sum b { font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ap-sum span { font-size: 12px; color: var(--dim, #6B7280); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ap-publish { min-width: 128px; min-height: 50px; font-size: 16px; border-radius: 14px; }
.ap-done { padding: 56px 22px 24px; text-align: center; }
.ap-done-ic { width: 76px; height: 76px; border-radius: 99px; background: var(--goldg, linear-gradient(180deg,#F0CF7C,#D4A437)); color: #1F1605; display: grid; place-items: center; margin: 0 auto 16px; animation: appop .4s ease; }
@keyframes appop { 0% { transform: scale(.4); } 70% { transform: scale(1.1); } }
.ap-done h1 { font-size: 30px; margin: 0 0 6px; letter-spacing: -0.02em; }
.ap-done p { color: var(--dim, #6B7280); margin: 0 0 8px; }
.ap-done-who { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--g2, #08503A) !important; margin-bottom: 20px !important; }
.ap-done-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
`;
