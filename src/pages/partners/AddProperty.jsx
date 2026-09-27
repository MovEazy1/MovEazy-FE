/**
 * PRD 06 + 07 — add a property in under two minutes. Step one is the four
 * required facts and a location; everything else is optional and folded away.
 * Step two is who sees it. Saving creates one inventory row and its shares.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePartner } from "./PartnerApp";
import ShareWithForm, { EMPTY_SHARE, toSharing } from "./ShareWithForm";
import { TopBar, toast } from "./partnerUi";
import ListingMapPicker from "../../components/ListingMapPicker";
import { ALL_LOCALITIES, FURNISHINGS } from "../../data/preferenceOptions";
import { BHK_OPTIONS, PROPERTY_TYPES } from "../../lib/partnerFilters";
import { bedroomsOf } from "../../lib/partnerMatch";
import { geocodePlace } from "../../lib/geocode";
import { mediaRejectionReason, uploadInventoryPhotos } from "../../lib/inventory";
import { coverPhoto, orderListingMedia } from "../../lib/listingMedia";
import { normalizeIndianMobile } from "../../lib/mobile";
import {
  createPartnerListing, friendlyError, pp, saveOwnContacts, updatePartnerListing,
} from "../../lib/partners";

const BLANK = {
  propertyType: "Apartment", flatType: "2 BHK", rent: "", furnishing: "Fully Furnished",
  area: "", fullAddress: "", latitude: null, longitude: null,
  deposit: "", availableFrom: "", description: "",
  ownerName: "", ownerPhone: "", tenantName: "", tenantPhone: "",
};

export default function AddProperty() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { groups, reloadInventory } = usePartner();
  const [f, setF] = useState(BLANK);
  const [step, setStep] = useState(1);
  const [more, setMore] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [share, setShare] = useState(EMPTY_SHARE);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState("");
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));

  const pin = useMemo(() => (f.latitude != null ? [f.latitude, f.longitude] : null), [f.latitude, f.longitude]);

  const validate = () => {
    const e = {};
    if (!f.propertyType) e.propertyType = "Pick a property type";
    if (!f.flatType) e.flatType = "Pick the BHK";
    if (!(Number(f.rent) >= 1000)) e.rent = "Enter the monthly rent";
    if (!f.furnishing) e.furnishing = "Pick furnishing";
    if (!f.area.trim()) e.area = "Which locality is it in?";
    if (f.ownerPhone && !normalizeIndianMobile(f.ownerPhone)) e.ownerPhone = "10-digit mobile number";
    if (f.tenantPhone && !normalizeIndianMobile(f.tenantPhone)) e.tenantPhone = "10-digit mobile number";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validate()) { setStep(2); window.scrollTo(0, 0); }
  };

  const save = async () => {
    setSaving("Publishing…");
    try {
      let { latitude, longitude } = f;
      if (latitude == null) {
        // A listing the map cannot plot is invisible on moveazy.co.in; the locality centre is better than nothing.
        const g = await geocodePlace(`${f.area}, Bengaluru`).catch(() => null);
        if (g?.ok) { latitude = g.lat; longitude = g.lng; }
      }
      const draft = {
        postedBy: "broker",
        propertyType: f.propertyType,
        flatType: f.flatType,
        bedrooms: Math.max(1, Math.floor(bedroomsOf(f.flatType) || 1)),
        rent: f.rent,
        deposit: f.deposit,
        furnishing: f.furnishing,
        area: f.area.trim(),
        fullAddress: f.fullAddress,
        latitude, longitude,
        availableFrom: f.availableFrom || null,
        title: `${f.flatType} in ${f.area.trim()}`,
        description: f.description,
      };
      const id = await createPartnerListing(draft, user, toSharing(share));

      if (photos.length) {
        setSaving(`Uploading photos (0/${photos.length})…`);
        const urls = await uploadInventoryPhotos(photos, id, (d, t) => setSaving(`Uploading photos (${d}/${t})…`),
          (file, msg) => toast(`${file.name}: ${msg}`, "error"));
        if (urls.length) {
          const images = orderListingMedia(urls);
          await updatePartnerListing(id, { images, cover_image_url: coverPhoto(images) });
        }
      }
      await saveOwnContacts(id, [
        { role: "owner", name: f.ownerName, phone: normalizeIndianMobile(f.ownerPhone) || "" },
        { role: "tenant", name: f.tenantName, phone: normalizeIndianMobile(f.tenantPhone) || "" },
      ]);
      await reloadInventory();
      toast("Property added");
      navigate(pp(`/property/${id}`), { replace: true });
    } catch (e) {
      toast(friendlyError(e, "Could not add the property."), "error");
      setSaving("");
    }
  };

  const onFiles = (list) => {
    const ok = [];
    for (const file of list) {
      const why = mediaRejectionReason(file);
      if (why) toast(why, "error"); else ok.push(file);
    }
    setPhotos((cur) => [...cur, ...ok].slice(0, 20));
  };

  if (step === 2) {
    return (
      <>
        <TopBar title="Share with" />
        <div className="pz-pad">
          <ShareWithForm value={share} onChange={setShare} groups={groups} />
          <div className="pz-row" style={{ marginTop: 16 }}>
            <button type="button" className="pz-btn" style={{ minHeight: 50 }} onClick={() => setStep(1)} disabled={!!saving}>Back</button>
            <button type="button" className="pz-btn pz-btn--primary pz-btn--block" onClick={save} disabled={!!saving}>
              {saving || "Save"}
            </button>
          </div>
        </div>
      </>
    );
  }

  const err = (k) => errors[k] && <div className="pz-err">{errors[k]}</div>;
  return (
    <>
      <TopBar title="Add Property" back />
      <div className="pz-pad">
        <div className="pz-section">
          <h2>Basic Details</h2>
          <div className="pz-field">
            <label className="pz-label" htmlFor="ap-type">Property Type</label>
            <select id="ap-type" className="pz-select" value={f.propertyType} onChange={(e) => set({ propertyType: e.target.value })}>
              {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>{err("propertyType")}
          </div>
          <div className="pz-field">
            <label className="pz-label" htmlFor="ap-bhk">BHK</label>
            <select id="ap-bhk" className="pz-select" value={f.flatType} onChange={(e) => set({ flatType: e.target.value })}>
              {BHK_OPTIONS.map((t) => <option key={t}>{t}</option>)}
            </select>{err("flatType")}
          </div>
          <div className="pz-field">
            <label className="pz-label" htmlFor="ap-rent">Rent (₹ per month)</label>
            <input id="ap-rent" className="pz-input" inputMode="numeric" placeholder="32000" value={f.rent}
              onChange={(e) => set({ rent: e.target.value.replace(/\D/g, "").slice(0, 7) })} />{err("rent")}
          </div>
          <div className="pz-field" style={{ marginBottom: 0 }}>
            <label className="pz-label" htmlFor="ap-furn">Furnishing</label>
            <select id="ap-furn" className="pz-select" value={f.furnishing} onChange={(e) => set({ furnishing: e.target.value })}>
              {FURNISHINGS.map((t) => <option key={t}>{t}</option>)}
            </select>{err("furnishing")}
          </div>
        </div>

        <div className="pz-section">
          <h2>Location</h2>
          <div className="pz-field">
            <label className="pz-label" htmlFor="ap-area">Locality</label>
            <input id="ap-area" className="pz-input" list="ap-localities" placeholder="HSR Layout" value={f.area}
              onChange={(e) => set({ area: e.target.value })} />
            <datalist id="ap-localities">{ALL_LOCALITIES.map((a) => <option key={a} value={a} />)}</datalist>
            {err("area")}
          </div>
          <ListingMapPicker height={170} focusQuery={f.area ? `${f.area}, Bengaluru` : ""} markerPosition={pin}
            onMarkerChange={([lat, lng]) => set({ latitude: lat, longitude: lng })} />
          <div className="pz-field" style={{ marginTop: 12, marginBottom: 0 }}>
            <label className="pz-label" htmlFor="ap-addr">Full Address <span className="pz-hint">(optional)</span></label>
            <input id="ap-addr" className="pz-input" placeholder="27th Main, Sector 2…" value={f.fullAddress}
              onChange={(e) => set({ fullAddress: e.target.value })} />
          </div>
        </div>

        <div className="pz-section">
          <h2>Photos <span className="pz-hint">optional</span></h2>
          <label className="pz-btn" style={{ width: "100%", borderStyle: "dashed" }}>
            <Camera size={18} /> {photos.length ? `${photos.length} selected — add more` : "Add photos or a video"}
            <input type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { onFiles([...e.target.files]); e.target.value = ""; }} />
          </label>
          {photos.length > 0 && (
            <button type="button" className="pz-btn pz-btn--ghost" onClick={() => setPhotos([])}>Clear photos</button>
          )}
        </div>

        <button type="button" className="pz-btn" style={{ width: "100%", marginBottom: 12 }} onClick={() => setMore((m) => !m)}>
          {more ? <ChevronUp size={18} /> : <ChevronDown size={18} />} More details — deposit, availability, owner contact
        </button>
        {more && (
          <div className="pz-section">
            <div className="pz-row" style={{ alignItems: "flex-start" }}>
              <div className="pz-field" style={{ flex: 1 }}>
                <label className="pz-label" htmlFor="ap-dep">Deposit (₹)</label>
                <input id="ap-dep" className="pz-input" inputMode="numeric" value={f.deposit}
                  onChange={(e) => set({ deposit: e.target.value.replace(/\D/g, "").slice(0, 8) })} />
              </div>
              <div className="pz-field" style={{ flex: 1 }}>
                <label className="pz-label" htmlFor="ap-from">Available from</label>
                <input id="ap-from" className="pz-input" type="date" value={f.availableFrom}
                  onChange={(e) => set({ availableFrom: e.target.value })} />
              </div>
            </div>
            <div className="pz-field">
              <label className="pz-label" htmlFor="ap-desc">Description</label>
              <textarea id="ap-desc" className="pz-textarea" rows={3} value={f.description}
                onChange={(e) => set({ description: e.target.value })} placeholder="Modular kitchen, close to metro…" />
            </div>
            <span className="pz-label">Owner contact <span className="pz-hint">— only you and MovEazy see this</span></span>
            <div className="pz-row" style={{ alignItems: "flex-start", marginBottom: 10 }}>
              <input className="pz-input" placeholder="Owner name" value={f.ownerName} onChange={(e) => set({ ownerName: e.target.value })} />
              <div style={{ flex: 1 }}>
                <input className="pz-input" inputMode="numeric" placeholder="Mobile" value={f.ownerPhone}
                  onChange={(e) => set({ ownerPhone: e.target.value })} />{err("ownerPhone")}
              </div>
            </div>
            <span className="pz-label">Current tenant <span className="pz-hint">(optional)</span></span>
            <div className="pz-row" style={{ alignItems: "flex-start" }}>
              <input className="pz-input" placeholder="Tenant name" value={f.tenantName} onChange={(e) => set({ tenantName: e.target.value })} />
              <div style={{ flex: 1 }}>
                <input className="pz-input" inputMode="numeric" placeholder="Mobile" value={f.tenantPhone}
                  onChange={(e) => set({ tenantPhone: e.target.value })} />{err("tenantPhone")}
              </div>
            </div>
          </div>
        )}

        <button type="button" className="pz-btn pz-btn--primary pz-btn--block" onClick={next}>Next</button>
      </div>
    </>
  );
}
