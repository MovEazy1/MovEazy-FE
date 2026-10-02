/**
 * PRD 07 — fast property onboarding, and the same form for editing.
 *
 * Required: type, BHK, rent, furnishing, locality. Everything else is folded
 * away. "Is it rented right now?" decides where the flat starts: occupied
 * flats stay off moveazy.co.in; vacant ones can go live from Find a Tenant.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Camera, ChevronDown, ChevronUp, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useOwner } from "./OwnerApp";
import { Chip, Empty, Loading, TopBar, toast } from "./ownerUi";
import ListingMapPicker from "../../components/ListingMapPicker";
import { ALL_LOCALITIES, FURNISHINGS, withParentArea } from "../../data/preferenceOptions";
import { BHK_OPTIONS } from "../../lib/partnerFilters";
import { bedroomsOf } from "../../lib/partnerMatch";
import { geocodePlace } from "../../lib/geocode";
import { mediaRejectionReason, uploadInventoryPhotos } from "../../lib/inventory";
import { coverPhoto, orderListingMedia } from "../../lib/listingMedia";
import { listingMedia, MediaItem } from "../partners/partnerMedia";
import { createOwnerProperty, friendlyError, op, updateProperty } from "../../lib/owners";
import { floorLabel, setFlatBuilding } from "../../lib/buildings";

const FLOOR_OPTIONS = [-1, ...Array.from({ length: 31 }, (_, i) => i)];

const TYPES = ["Apartment", "Independent House", "Villa", "Builder Floor"];

function fromProperty(p) {
  return {
    propertyType: p?.property_type || "Apartment",
    flatType: p?.flat_type || "2 BHK",
    rent: p?.rent ? String(Math.round(p.rent)) : "",
    furnishing: p?.furnishing || "Fully Furnished",
    area: p?.area || "",
    fullAddress: p?.full_address || "",
    latitude: p?.latitude ?? null,
    longitude: p?.longitude ?? null,
    areaSqft: p?.area_sqft ? String(p.area_sqft) : "",
    deposit: p?.deposit ? String(Math.round(p.deposit)) : "",
    availableFrom: p?.available_from ? String(p.available_from).slice(0, 10) : "",
    description: p?.description || "",
    occupied: false,
  };
}

export default function PropertyForm() {
  const { id } = useParams();
  const { byId, properties } = useOwner();
  const existing = id ? byId.get(id) : null;
  if (id && !properties) return <><TopBar title="Edit property" back /><Loading /></>;
  if (id && !existing) return <><TopBar title="Edit property" back /><Empty>That property isn't in your account.</Empty></>;
  return <PropertyFormInner key={existing?.property_id || "new"} existing={existing} />;
}

function PropertyFormInner({ existing }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { reloadProperties, buildings, reloadBuildings } = useOwner();
  const [params] = useSearchParams();
  // Which building the flat is in, and on which floor (owner_buildings.sql).
  const [bld, setBld] = useState(() => existing?.building_id || params.get("building") || "");
  const [floor, setFloor] = useState(() => existing?.floor_number ?? null);
  const fromBuilding = !existing && params.get("building") ? (buildings ?? []).find((b) => b.id === params.get("building")) : null;
  const [f, setF] = useState(() => ({
    ...fromProperty(existing),
    // A new flat added from a building starts where the building is.
    ...(fromBuilding ? {
      area: fromBuilding.area || "", fullAddress: fromBuilding.full_address || "",
      latitude: fromBuilding.latitude ?? null, longitude: fromBuilding.longitude ?? null,
    } : {}),
  }));
  const [more, setMore] = useState(Boolean(existing));
  const [photos, setPhotos] = useState([]);
  const [kept, setKept] = useState(() => (existing ? listingMedia(existing) : []));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState("");
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));
  const pin = useMemo(() => (f.latitude != null ? [Number(f.latitude), Number(f.longitude)] : null), [f.latitude, f.longitude]);
  const previews = useMemo(() => photos.map((file) => ({ file, url: URL.createObjectURL(file) })), [photos]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const validate = () => {
    const e = {};
    if (!f.propertyType) e.propertyType = "Pick a property type";
    if (!f.flatType) e.flatType = "Pick the BHK";
    if (!(Number(f.rent) >= 1000)) e.rent = "Enter the monthly rent";
    if (!f.furnishing) e.furnishing = "Pick furnishing";
    if (!f.area.trim()) e.area = "Which locality is it in?";
    if (f.areaSqft && !(Number(f.areaSqft) >= 100 && Number(f.areaSqft) <= 20000)) e.areaSqft = "Between 100 and 20,000 sq ft";
    if (bld && floor === null) e.floor = "Which floor is it on?";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onFiles = (list) => {
    const ok = [];
    for (const file of list) {
      const why = mediaRejectionReason(file);
      if (why) toast(why, "error"); else ok.push(file);
    }
    setPhotos((cur) => [...cur, ...ok].slice(0, 20));
  };

  const save = async () => {
    if (!validate()) { window.scrollTo(0, 0); return; }
    setSaving(existing ? "Saving…" : "Adding…");
    try {
      let { latitude, longitude } = f;
      if (latitude == null) {
        const g = await geocodePlace(`${f.area}, Bengaluru`).catch(() => null);
        if (g?.ok) { latitude = g.lat; longitude = g.lng; }
      }
      const area = f.area.trim();
      const bedrooms = Math.max(1, Math.floor(bedroomsOf(f.flatType) || 1));
      let pid = existing?.property_id;
      if (!pid) {
        pid = await createOwnerProperty({
          propertyType: f.propertyType, flatType: f.flatType, bedrooms, rent: f.rent, furnishing: f.furnishing,
          area, fullAddress: f.fullAddress, latitude, longitude, areaSqft: f.areaSqft, deposit: f.deposit,
          availableFrom: f.availableFrom || null, description: f.description, title: `${f.flatType} in ${area}`,
          occupied: f.occupied,
        }, user);
      }
      let images = kept;
      if (photos.length) {
        setSaving(`Uploading photos (0/${photos.length})…`);
        const urls = await uploadInventoryPhotos(photos, pid, (d, t) => setSaving(`Uploading photos (${d}/${t})…`),
          (file, msg) => toast(`${file.name}: ${msg}`, "error"));
        images = orderListingMedia([...kept, ...urls]);
      }
      const patch = {
        ...(existing ? {
          property_type: f.propertyType, flat_type: f.flatType, bedrooms, rent: Number(f.rent), furnishing: f.furnishing,
          area, nearby_areas: withParentArea(area, existing.nearby_areas ?? []), full_address: f.fullAddress,
          latitude, longitude, area_sqft: f.areaSqft || "", deposit: f.deposit || "", available_from: f.availableFrom || "",
          description: f.description, title: existing.title || `${f.flatType} in ${area}`,
        } : {}),
        ...(photos.length || (existing && kept.length !== listingMedia(existing).length)
          ? { images, cover_image_url: coverPhoto(images) } : {}),
      };
      if (Object.keys(patch).length) await updateProperty(pid, patch);
      if (bld !== (existing?.building_id || "") || (bld && floor !== (existing?.floor_number ?? null))) {
        await setFlatBuilding(pid, bld || null, bld ? floor : null);
        await reloadBuildings();
      }
      await reloadProperties();
      toast(existing ? "Saved" : "Property added");
      navigate(op(!existing && bld ? `/buildings/${bld}` : `/properties/${pid}`), { replace: true });
    } catch (e) {
      toast(friendlyError(e, "Could not save the property."), "error");
      setSaving("");
    }
  };

  const err = (k) => errors[k] && <div className="oz-err">{errors[k]}</div>;
  return (
    <>
      <TopBar title={existing ? "Edit Property" : "Add Property"} back />
      <div className="oz-pad">
        <div className="oz-section">
          <h2 className="oz-h2">Basic Details</h2>
          <div className="oz-field">
            <span className="oz-label">Property Type</span>
            <div className="oz-chips">
              {TYPES.map((t) => <Chip key={t} on={f.propertyType === t} onClick={() => set({ propertyType: t })}>{t}</Chip>)}
            </div>{err("propertyType")}
          </div>
          <div className="oz-grid2">
            <div className="oz-field">
              <label className="oz-label" htmlFor="pf-bhk">BHK</label>
              <select id="pf-bhk" className="oz-select" value={f.flatType} onChange={(e) => set({ flatType: e.target.value })}>
                {BHK_OPTIONS.map((t) => <option key={t}>{t}</option>)}
              </select>{err("flatType")}
            </div>
            <div className="oz-field">
              <label className="oz-label" htmlFor="pf-rent">Rent (₹ per month)</label>
              <input id="pf-rent" className="oz-input" inputMode="numeric" placeholder="32000" value={f.rent}
                onChange={(e) => set({ rent: e.target.value.replace(/\D/g, "").slice(0, 7) })} />{err("rent")}
            </div>
          </div>
          <div className="oz-field" style={{ marginBottom: 0 }}>
            <label className="oz-label" htmlFor="pf-furn">Furnishing</label>
            <select id="pf-furn" className="oz-select" value={f.furnishing} onChange={(e) => set({ furnishing: e.target.value })}>
              {FURNISHINGS.map((t) => <option key={t}>{t}</option>)}
            </select>{err("furnishing")}
          </div>
        </div>

        <div className="oz-section">
          <h2 className="oz-h2">Location</h2>
          <div className="oz-field">
            <label className="oz-label" htmlFor="pf-area">Locality</label>
            <input id="pf-area" className="oz-input" list="pf-localities" placeholder="HSR Layout" value={f.area}
              onChange={(e) => set({ area: e.target.value })} />
            <datalist id="pf-localities">{ALL_LOCALITIES.map((a) => <option key={a} value={a} />)}</datalist>
            {err("area")}
          </div>
          <ListingMapPicker height={170} focusQuery={f.area ? `${f.area}, Bengaluru` : ""} markerPosition={pin}
            onMarkerChange={([lat, lng]) => set({ latitude: lat, longitude: lng })} />
          <div className="oz-field" style={{ marginTop: 12, marginBottom: 0 }}>
            <label className="oz-label" htmlFor="pf-addr">Full address <span className="oz-hint">(only shared with verified visitors)</span></label>
            <input id="pf-addr" className="oz-input" placeholder="Flat no., building, street" value={f.fullAddress}
              onChange={(e) => set({ fullAddress: e.target.value })} />
          </div>
        </div>

        {(buildings ?? []).length > 0 && (
          <div className="oz-section">
            <h2 className="oz-h2">Building & floor</h2>
            <p className="oz-hint" style={{ margin: "-4px 0 10px" }}>Flats in a building show on its QR page, floor by floor.</p>
            <div className="oz-grid2">
              <div className="oz-field" style={{ marginBottom: 0 }}>
                <label className="oz-label" htmlFor="pf-bld">Building</label>
                <select id="pf-bld" className="oz-select" value={bld} onChange={(e) => setBld(e.target.value)}>
                  <option value="">Not in a building</option>
                  {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="oz-field" style={{ marginBottom: 0 }}>
                <label className="oz-label" htmlFor="pf-floor">Floor</label>
                <select id="pf-floor" className="oz-select" value={floor ?? ""} disabled={!bld}
                  onChange={(e) => setFloor(e.target.value === "" ? null : Number(e.target.value))}>
                  <option value="">Pick the floor</option>
                  {FLOOR_OPTIONS.map((n) => <option key={n} value={n}>{floorLabel(n)}</option>)}
                </select>{err("floor")}
              </div>
            </div>
          </div>
        )}

        {!existing && (
          <div className="oz-section">
            <h2 className="oz-h2">Is it rented right now?</h2>
            <div className="oz-grid2">
              <button type="button" className={`oz-cat${f.occupied ? " oz-cat--on" : ""}`} style={{ minHeight: 64 }} onClick={() => set({ occupied: true })}>
                Yes, occupied<span className="oz-hint" style={{ fontWeight: 400 }}>Add tenants next</span>
              </button>
              <button type="button" className={`oz-cat${!f.occupied ? " oz-cat--on" : ""}`} style={{ minHeight: 64 }} onClick={() => set({ occupied: false })}>
                No, it's vacant<span className="oz-hint" style={{ fontWeight: 400 }}>Find a tenant next</span>
              </button>
            </div>
          </div>
        )}

        <div className="oz-section">
          <h2 className="oz-h2">Photos <span className="oz-hint">{kept.length + photos.length} added</span></h2>
          {(kept.length > 0 || previews.length > 0) && (
            <div className="oz-grid3" style={{ marginBottom: 10 }}>
              {kept.map((src) => (
                <div key={src} className="oz-thumb" style={{ width: "100%", height: 86, position: "relative" }}>
                  <MediaItem src={src} />
                  <button type="button" aria-label="Remove photo" onClick={() => setKept((k) => k.filter((x) => x !== src))}
                    style={{ position: "absolute", top: 4, right: 4, border: 0, borderRadius: 999, background: "rgba(0,0,0,.55)", color: "#fff", width: 24, height: 24, display: "grid", placeItems: "center" }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
              {previews.map((p) => (
                <div key={p.url} className="oz-thumb" style={{ width: "100%", height: 86, position: "relative" }}>
                  {p.file.type.startsWith("video/") ? <video src={p.url} muted /> : <img src={p.url} alt="" />}
                  <button type="button" aria-label="Remove photo" onClick={() => setPhotos((cur) => cur.filter((x) => x !== p.file))}
                    style={{ position: "absolute", top: 4, right: 4, border: 0, borderRadius: 999, background: "rgba(0,0,0,.55)", color: "#fff", width: 24, height: 24, display: "grid", placeItems: "center" }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="oz-btn" style={{ width: "100%", borderStyle: "dashed" }}>
            <Camera size={18} /> Add photos or a video
            <input type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { onFiles([...e.target.files]); e.target.value = ""; }} />
          </label>
          <p className="oz-hint" style={{ margin: "8px 0 0" }}>Our Home Designer also uses these photos to suggest upgrades.</p>
        </div>

        <button type="button" className="oz-btn" style={{ width: "100%", marginBottom: 12 }} onClick={() => setMore((m) => !m)}>
          {more ? <ChevronUp size={18} /> : <ChevronDown size={18} />} More details — size, deposit, availability
        </button>
        {more && (
          <div className="oz-section">
            <div className="oz-grid2">
              <div className="oz-field">
                <label className="oz-label" htmlFor="pf-sqft">Carpet area (sq ft)</label>
                <input id="pf-sqft" className="oz-input" inputMode="numeric" value={f.areaSqft}
                  onChange={(e) => set({ areaSqft: e.target.value.replace(/\D/g, "").slice(0, 5) })} />{err("areaSqft")}
              </div>
              <div className="oz-field">
                <label className="oz-label" htmlFor="pf-dep">Deposit (₹)</label>
                <input id="pf-dep" className="oz-input" inputMode="numeric" value={f.deposit}
                  onChange={(e) => set({ deposit: e.target.value.replace(/\D/g, "").slice(0, 8) })} />
              </div>
            </div>
            <div className="oz-field">
              <label className="oz-label" htmlFor="pf-from">Available from</label>
              <input id="pf-from" className="oz-input" type="date" value={f.availableFrom} onChange={(e) => set({ availableFrom: e.target.value })} />
            </div>
            <div className="oz-field" style={{ marginBottom: 0 }}>
              <label className="oz-label" htmlFor="pf-desc">Description</label>
              <textarea id="pf-desc" className="oz-textarea" rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })}
                placeholder="Modular kitchen, east-facing balcony, 5 min from the metro…" />
            </div>
          </div>
        )}

        <button type="button" className="oz-btn oz-btn--primary oz-btn--block" onClick={save} disabled={!!saving}>
          {saving || (existing ? "Save changes" : "Add property")}
        </button>
      </div>
    </>
  );
}
