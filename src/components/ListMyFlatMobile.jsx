/**
 * "List my flat" — the mobile (phone-width) posting flow.
 *
 * A six-step dark stepper that replaces the light three-step form on small
 * screens only; pages/ListMyFlat.jsx keeps rendering its original layout on
 * tablet and desktop. On publish this hands the created row back up via
 * onPublished(), so the existing success screen (matched leads, visit slots,
 * wallet reward, broker plan) stays the single implementation of what happens
 * after a listing goes live.
 *
 * This is a re-layout, not a re-scoping: every question is the one the desktop
 * form already asks, in the same vocabulary, writing the same inventory
 * columns. The six steps are just a phone-shaped regrouping of the desktop
 * form's three, so nothing new needs a migration and both layouts stay
 * interchangeable.
 */
import { useEffect, useMemo, useState } from "react";
import ListingMapPicker from "./ListingMapPicker";
import { reverseGeocode, nearbyLandmarks } from "../lib/geocode";
import { createInventoryItem, uploadInventoryPhotos, generatePropertyId } from "../lib/inventory";
import { fetchAllUserRequirements } from "../lib/userRequirements";
import { matchListingToRequirements } from "../lib/inventoryMatch";
import {
  ALL_LOCALITIES, FLAT_TYPES, FURNISHINGS, OCCUPANTS, MUST_HAVES, LIFESTYLE,
} from "../data/preferenceOptions";

const MINT = "#5EEAD4";
const GOLD = "#E8A33D";
const TOTAL_STEPS = 6;

const POSTER_ROLES = [
  ["owner", "Owner", "I own this property"],
  ["tenant", "Tenant", "I live here / passing it on"],
  ["broker", "Broker / Agent", "I'm listing on behalf of an owner"],
];
const RULE_OPTIONS = [
  "No Smoking", "No Pets", "No Alcohol", "Vegetarians Only",
  "Working Professionals Only", "No Brokerage", "Fully Furnished",
];
const GENDER_PREFS = [["any", "Co-ed / Any"], ["female", "Girls Only"], ["male", "Boys Only"]];

const STEP_COPY = [
  ["Let's get started 👋", "First, who's putting this flat up?"],
  ["Where is it?", "Renters find your flat by exactly this pin."],
  ["About the home", "The basics every renter asks about."],
  ["Rent & availability", "Set your price — you can always change it later."],
  ["What's it like?", "The details that match you to the right renters."],
  ["Photos & description", "Photos do most of the selling for you."],
];

/* ── shared bits ───────────────────────────────────────────────────────────── */

function Q({ children, sub, required }) {
  return (
    <>
      <div style={{ color: "#F1F6F4", fontSize: 17, fontWeight: 700, marginBottom: sub ? 6 : 12 }}>
        {children}{required && <span style={{ color: "#FCA5A5", marginLeft: 3 }}>*</span>}
      </div>
      {sub && <div style={{ color: "#8AA5A0", fontSize: 13, marginBottom: 13, lineHeight: 1.45 }}>{sub}</div>}
    </>
  );
}

function SubQ({ children }) {
  return <div style={{ color: "#F1F6F4", fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{children}</div>;
}

function Chip({ label, on, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${on ? MINT : "rgba(255,255,255,.13)"}`,
        background: on ? "rgba(94,234,212,.10)" : "transparent",
        color: on ? MINT : "#9FB5B0",
        fontSize: 13.5, fontWeight: 600, padding: "11px 16px", borderRadius: 12,
        cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}

function ChipRow({ options, value, onPick }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
      {options.map((o) => <Chip key={o} label={o} on={value === o} onClick={() => onPick(o)} />)}
    </div>
  );
}

function ChipMulti({ options, selected, onToggle }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
      {options.map((o) => <Chip key={o} label={o} on={selected.includes(o)} onClick={() => onToggle(o)} />)}
    </div>
  );
}

/** Bordered input shell — the design's rounded field with optional prefix/suffix. */
function Field({ prefix, suffix, accent, children }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      border: `1px solid ${accent ? "rgba(94,234,212,.35)" : "rgba(255,255,255,.13)"}`,
      borderRadius: 14, padding: "0 15px",
      background: accent ? "rgba(94,234,212,.05)" : "rgba(255,255,255,.03)",
    }}>
      {prefix}
      {children}
      {suffix}
    </div>
  );
}

const inputStyle = {
  flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none",
  color: "#F1F6F4", fontSize: 15, padding: "16px 0", fontFamily: "inherit",
};
const optionStyle = { background: "#0A1817" };

function Caret() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7E9994" strokeWidth="1.8" style={{ flex: "none" }} aria-hidden>
      <path d="M6 9.5 12 15.5 18 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A labelled <select> in the dark field shell. */
function SelectField({ label, value, onChange, children, disabled, placeholder }) {
  return (
    <div>
      {label && <SubQ>{label}</SubQ>}
      <Field>
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          style={{
            ...inputStyle, appearance: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            color: disabled ? "#6F8681" : value === "" ? "#6F8681" : "#F1F6F4",
          }}
        >
          {placeholder !== undefined && <option value="" style={optionStyle}>{placeholder}</option>}
          {children}
        </select>
        <Caret />
      </Field>
    </div>
  );
}

/* ── page ──────────────────────────────────────────────────────────────────── */

export default function ListMyFlatMobile({ user, onPublished }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [err, setErr] = useState("");

  // 1 — who's posting
  const [postedBy, setPostedBy] = useState("owner");
  const [phone, setPhone] = useState(user?.phone || "");

  // 2 — where
  const [area, setArea] = useState("");
  const [marker, setMarker] = useState(null);
  const [fullAddress, setFullAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [landmarkOptions, setLandmarkOptions] = useState([]);
  const [resolvingAddr, setResolvingAddr] = useState(false);

  // 3 — the home
  const [flatType, setFlatType] = useState("2 BHK");
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [furnishing, setFurnishing] = useState("Fully Furnished");
  const [maxFlatmates, setMaxFlatmates] = useState(1);
  const [genderPref, setGenderPref] = useState("any");

  // 4 — money
  const [rent, setRent] = useState("");
  const [deposit, setDeposit] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");

  // 5 — features
  const [occupantsAllowed, setOccupantsAllowed] = useState([...OCCUPANTS]);
  const [amenities, setAmenities] = useState([]);
  const [lifestyle, setLifestyle] = useState([]);
  const [houseRules, setHouseRules] = useState([]);

  // 6 — describe
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);

  const propertyId = useMemo(() => generatePropertyId(), []);

  useEffect(() => {
    if (area) setTitle((t) => t || `${flatType} in ${area}`);
  }, [area, flatType]);

  useEffect(() => () => photoPreviews.forEach((u) => URL.revokeObjectURL(u)), [photoPreviews]);

  const toggleIn = (setter) => (v) =>
    setter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  // The map is the only source of the flat's exact address: whenever the pin
  // moves, reverse-geocode it and pull nearby named places to offer as landmarks.
  const handleMarkerChange = async (pos) => {
    setMarker(pos);
    setErr("");
    if (!pos) { setFullAddress(""); setLandmarkOptions([]); setLandmark(""); return; }
    setResolvingAddr(true);
    try {
      const [r, near] = await Promise.all([
        reverseGeocode(pos[0], pos[1]),
        nearbyLandmarks(pos[0], pos[1], { limit: 12 }),
      ]);
      setFullAddress(r?.display || "");
      const opts = (near || []).map((n) => n.display);
      setLandmarkOptions(opts);
      setLandmark(opts[0] || "");
    } catch {
      setFullAddress(""); setLandmarkOptions([]); setLandmark("");
    } finally {
      setResolvingAddr(false);
    }
  };

  const addPhotos = (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    setPhotoFiles((p) => [...p, ...files]);
    setPhotoPreviews((p) => [...p, ...files.map((f) => URL.createObjectURL(f))]);
  };
  const removePhoto = (i) => {
    setPhotoPreviews((p) => { URL.revokeObjectURL(p[i]); return p.filter((_, x) => x !== i); });
    setPhotoFiles((p) => p.filter((_, x) => x !== i));
  };

  // Same rules the desktop form enforces, split across the six steps.
  const validate = () => {
    if (step === 1 && !phone.trim()) return "Add a contact number.";
    if (step === 2) {
      if (!area) return "Select the flat's area.";
      if (!marker) return "Drop a pin on the map to set the exact address.";
    }
    if (step === 4 && !rent) return "Enter the monthly rent.";
    return "";
  };

  const submit = async () => {
    setSaving(true);
    setErr("");
    try {
      let images = [];
      if (photoFiles.length) {
        setUploadMsg(`Uploading ${photoFiles.length} photo${photoFiles.length > 1 ? "s" : ""}…`);
        images = await uploadInventoryPhotos(photoFiles, propertyId, (d, t) => setUploadMsg(`Uploading photos… ${d}/${t}`));
      }
      setUploadMsg("");
      const row = await createInventoryItem({
        propertyId, postedBy, phone, area, nearbyAreas: [], fullAddress, landmark,
        latitude: marker?.[0] ?? null, longitude: marker?.[1] ?? null,
        rent, deposit, availableFrom, flatType, bedrooms, bathrooms, furnishing,
        maxFlatmates, genderPref, occupantsAllowed, amenities, lifestyle, houseRules,
        title, description, images,
      }, user);
      let matches = [];
      try {
        matches = matchListingToRequirements(row, await fetchAllUserRequirements(), { min: 40 }).slice(0, 8);
      } catch { /* matching is best-effort; never block a successful publish */ }
      onPublished?.(row, matches);
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Something went wrong while publishing.");
      setSaving(false);
      setUploadMsg("");
    }
  };

  const onNext = () => {
    const v = validate();
    if (v) { setErr(v); return; }
    setErr("");
    if (step === TOTAL_STEPS) { submit(); return; }
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const onBack = () => {
    setErr("");
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [stepTitle, stepSub] = STEP_COPY[step - 1];

  return (
    <div style={{ background: "radial-gradient(90% 60% at 50% 0%,#0d2320,#07100F 70%)", minHeight: "100dvh", fontFamily: "'Manrope',system-ui,sans-serif" }}>
      {/* HERO */}
      <div style={{ position: "relative", padding: "18px 22px 26px", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", inset: "-40px -20px auto", height: 340, background: "radial-gradient(70% 80% at 20% 30%,rgba(94,234,212,.12),transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: "-.02em", color: "#fff" }}>
            mov<span style={{ color: MINT }}>EAZY</span>
          </div>

          {/* Reward banner */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginTop: 18,
            border: `1px solid rgba(232,163,61,.35)`, background: "rgba(232,163,61,.09)",
            borderRadius: 14, padding: "12px 14px",
          }}>
            <span aria-hidden style={{ flex: "none", width: 34, height: 34, borderRadius: "50%", background: "rgba(232,163,61,.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8">
                <rect x="2.5" y="7.5" width="19" height="13" rx="2.5" />
                <path d="M2.5 11.5h19M12 7.5v13" strokeLinecap="round" />
                <path d="M12 7.5S9.8 3.5 7.6 4.4C5.9 5.1 6.6 7.5 9 7.5zM12 7.5s2.2-4 4.4-3.1c1.7.7 1 3.1-1.4 3.1z" strokeLinejoin="round" />
              </svg>
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "#F1F6F4", fontSize: 14, fontWeight: 800, lineHeight: 1.25 }}>
                Earn Flat <span style={{ color: GOLD }}>₹10,000 Cash Reward</span>
              </div>
              <div style={{ color: "#C9AE85", fontSize: 12.5, marginTop: 2 }}>+ Tenant Replacement</div>
            </div>
          </div>

          <div style={{ fontFamily: "'Caveat',cursive", fontWeight: 700, fontSize: 38, lineHeight: 1.05, color: "#fff", marginTop: 20 }}>
            List your flat.
          </div>
          <div style={{ fontFamily: "'Caveat',cursive", fontWeight: 700, fontSize: 31, lineHeight: 1.15, marginTop: 2 }}>
            <span style={{ color: MINT }}>Fast, free &amp; </span>
            <span style={{ color: GOLD, borderBottom: `3px solid rgba(232,163,61,.85)`, paddingBottom: 2 }}>effortless.</span>
          </div>
          <p style={{ color: "#A9C0BB", fontSize: 14.5, lineHeight: 1.45, marginTop: 14 }}>
            Reach thousands of verified tenants and rent on your terms.
          </p>
        </div>
      </div>

      {/* FORM SHEET */}
      <div style={{ background: "#0A1817", border: "1px solid rgba(255,255,255,.08)", borderRadius: "26px 26px 0 0", padding: "26px 20px 30px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#F1F6F4", fontWeight: 800, fontSize: 22, letterSpacing: "-.02em" }}>{stepTitle}</div>
            <div style={{ color: "#8AA5A0", fontSize: 14, marginTop: 7, lineHeight: 1.45 }}>{stepSub}</div>
          </div>
          <div style={{ flex: "none", width: 52, height: 52, borderRadius: "50%", border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.04)", display: "flex", alignItems: "center", justifyContent: "center", color: "#F1F6F4", fontSize: 14, fontWeight: 700 }}>
            {step}/{TOTAL_STEPS}
          </div>
        </div>

        <div style={{ height: 5, borderRadius: 5, background: "rgba(255,255,255,.09)", marginTop: 20, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(step / TOTAL_STEPS) * 100}%`, borderRadius: 5, background: "linear-gradient(90deg,#5EEAD4,#3FCFB8)", transition: "width .45s cubic-bezier(.16,1,.3,1)" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26, marginTop: 30 }}>
          {step === 1 && (
            <>
              <div>
                <Q>Who&apos;s posting this flat?</Q>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {POSTER_ROLES.map(([v, label, sub]) => {
                    const on = postedBy === v;
                    return (
                      <button key={v} type="button" onClick={() => setPostedBy(v)}
                        style={{
                          textAlign: "left", padding: "14px 16px", borderRadius: 13, cursor: "pointer", fontFamily: "inherit",
                          border: `1px solid ${on ? MINT : "rgba(255,255,255,.13)"}`,
                          background: on ? "rgba(94,234,212,.10)" : "rgba(255,255,255,.02)",
                        }}>
                        <span style={{ display: "block", color: on ? MINT : "#F1F6F4", fontSize: 14.5, fontWeight: 700 }}>{label}</span>
                        <span style={{ display: "block", color: "#8AA5A0", fontSize: 12.5, marginTop: 3 }}>{sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Q required>Contact phone</Q>
                <Field prefix={<span style={{ color: "#9FB5B0", fontSize: 15, fontWeight: 700, flex: "none", borderRight: "1px solid rgba(255,255,255,.12)", paddingRight: 12 }}>+91</span>}>
                  <input type="tel" inputMode="numeric" placeholder="10-digit mobile number" value={phone}
                    onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <SubQ>City</SubQ>
                  <Field>
                    <input value="Bengaluru" disabled style={{ ...inputStyle, color: "#6F8681", cursor: "not-allowed" }} />
                  </Field>
                </div>
                <SelectField label="Area *" value={area} onChange={setArea} placeholder="Select…">
                  {ALL_LOCALITIES.map((a) => <option key={a} value={a} style={optionStyle}>{a}</option>)}
                  <option value="Other" style={optionStyle}>Other</option>
                </SelectField>
              </div>

              <div>
                <Q required sub="Search an address or tap the map to drop the pin. This is the flat's exact location — renters see it here on the map.">
                  Exact address of the flat
                </Q>
                <ListingMapPicker
                  theme="dark"
                  markerPosition={marker}
                  onMarkerChange={handleMarkerChange}
                  height={230}
                  focusQuery={area && area !== "Other" ? `${area}, Bengaluru` : ""}
                />
                {marker && (
                  <div style={{ marginTop: 12, padding: 13, borderRadius: 13, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.02)" }}>
                    <p style={{ color: "#6F8681", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>Pinned address</p>
                    <p style={{ color: "#E5F1EE", fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>
                      {resolvingAddr ? "Looking up address…" : (fullAddress || "Address unavailable — the pin location is saved.")}
                    </p>
                    <p style={{ color: "#6F8681", fontSize: 11, marginTop: 5 }}>{marker[0].toFixed(5)}, {marker[1].toFixed(5)}</p>
                  </div>
                )}
              </div>

              <div>
                <SelectField
                  label="Nearby landmark"
                  value={landmark}
                  onChange={setLandmark}
                  disabled={landmarkOptions.length === 0}
                  placeholder={resolvingAddr ? "Finding the best landmark nearby…" : landmarkOptions.length === 0 ? "Drop a pin on the map above first…" : "Select a nearby landmark…"}
                >
                  {landmarkOptions.map((o) => <option key={o} value={o} style={optionStyle}>{o}</option>)}
                </SelectField>
                {landmark && landmarkOptions.length > 0 && (
                  <p style={{ color: "#6F8681", fontSize: 11.5, marginTop: 8, lineHeight: 1.45 }}>
                    Auto-picked the most prominent spot within 1&nbsp;km — change it if you&apos;d prefer another.
                  </p>
                )}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <Q>Home type</Q>
                <ChipRow options={FLAT_TYPES} value={flatType} onPick={setFlatType} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <SelectField label="Bedrooms" value={String(bedrooms)} onChange={(v) => setBedrooms(Number(v))}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n} style={optionStyle}>{n}</option>)}
                </SelectField>
                <SelectField label="Bathrooms" value={String(bathrooms)} onChange={(v) => setBathrooms(Number(v))}>
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n} style={optionStyle}>{n}</option>)}
                </SelectField>
              </div>
              <div>
                <Q>Furnishing</Q>
                <ChipRow options={FURNISHINGS} value={furnishing} onPick={setFurnishing} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <SelectField label="Max flatmates" value={String(maxFlatmates)} onChange={(v) => setMaxFlatmates(Number(v))}>
                  {[0, 1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n} style={optionStyle}>{n}</option>)}
                </SelectField>
                <SelectField label="Preferred gender" value={genderPref} onChange={setGenderPref}>
                  {GENDER_PREFS.map(([v, l]) => <option key={v} value={v} style={optionStyle}>{l}</option>)}
                </SelectField>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div>
                <Q required>Monthly rent</Q>
                <Field
                  accent
                  prefix={<span style={{ color: MINT, fontSize: 20, fontWeight: 800, flex: "none" }}>₹</span>}
                  suffix={<span style={{ color: "#6F8681", fontSize: 13, fontWeight: 600, flex: "none" }}>/ month</span>}
                >
                  <input type="number" min="0" placeholder="35,000" value={rent}
                    onChange={(e) => setRent(e.target.value)} style={{ ...inputStyle, fontSize: 19, fontWeight: 700 }} />
                </Field>
              </div>
              <div>
                <Q>Security deposit</Q>
                <Field prefix={<span style={{ color: "#6F8681", fontSize: 16, fontWeight: 700, flex: "none" }}>₹</span>}>
                  <input type="number" min="0" placeholder="1,00,000" value={deposit}
                    onChange={(e) => setDeposit(e.target.value)} style={inputStyle} />
                </Field>
              </div>
              <div>
                <Q>Available from</Q>
                <Field>
                  <input type="date" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} style={inputStyle} />
                </Field>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <div>
                <Q>Who can live here?</Q>
                <ChipMulti options={OCCUPANTS} selected={occupantsAllowed} onToggle={toggleIn(setOccupantsAllowed)} />
              </div>
              <div>
                <Q>Amenities</Q>
                <ChipMulti options={MUST_HAVES} selected={amenities} onToggle={toggleIn(setAmenities)} />
              </div>
              <div>
                <Q>Lifestyle nearby</Q>
                <ChipMulti options={LIFESTYLE} selected={lifestyle} onToggle={toggleIn(setLifestyle)} />
              </div>
              <div>
                <Q>House rules / tags</Q>
                <ChipMulti options={RULE_OPTIONS} selected={houseRules} onToggle={toggleIn(setHouseRules)} />
              </div>
            </>
          )}

          {step === 6 && (
            <>
              <div>
                <Q>Listing title</Q>
                <Field>
                  <input type="text" placeholder="e.g. Bright 2 BHK in HSR" value={title}
                    onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
                </Field>
              </div>
              <div>
                <Q>Description</Q>
                <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the flat, the vibe, and what makes it special…"
                  style={{
                    width: "100%", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.13)",
                    borderRadius: 14, padding: 15, color: "#F1F6F4", fontSize: 14.5, lineHeight: 1.5,
                    outline: "none", resize: "none", fontFamily: "inherit",
                  }} />
              </div>
              <div>
                <Q sub="Add a few clear photos — you can select many at once from your gallery.">
                  Photos {photoPreviews.length > 0 && <span style={{ color: "#6F8681", fontWeight: 600 }}>· {photoPreviews.length} added</span>}
                </Q>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                  {photoPreviews.map((src, i) => (
                    <div key={src} style={{ position: "relative", aspectRatio: "4/3", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,.13)" }}>
                      <img src={src} alt={`Photo ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button type="button" onClick={() => removePhoto(i)} aria-label={`Remove photo ${i + 1}`}
                        style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: "50%", border: "none", background: "rgba(4,17,15,.75)", color: "#fff", fontSize: 15, lineHeight: 1, cursor: "pointer" }}>
                        ×
                      </button>
                      {i === 0 && (
                        <span style={{ position: "absolute", bottom: 6, left: 6, padding: "2px 7px", borderRadius: 5, background: "rgba(4,17,15,.75)", color: "#fff", fontSize: 9, fontWeight: 800, letterSpacing: ".04em" }}>COVER</span>
                      )}
                    </div>
                  ))}
                  <label style={{
                    aspectRatio: "4/3", borderRadius: 14, cursor: "pointer",
                    border: "1px dashed rgba(94,234,212,.4)", background: "rgba(94,234,212,.05)",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center", padding: 10,
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={MINT} strokeWidth="1.6" aria-hidden>
                      <path d="M12 6v12M6 12h12" strokeLinecap="round" />
                    </svg>
                    <span style={{ color: MINT, fontSize: 12.5, fontWeight: 700 }}>
                      {photoPreviews.length ? "Add more" : "Tap to upload"}
                    </span>
                    <input type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
                  </label>
                </div>
              </div>

              {/* Listing summary — the desktop form's final recap. */}
              <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.02)", padding: 15 }}>
                <p style={{ color: "#F1F6F4", fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Listing summary</p>
                {[
                  ["Property ID", propertyId],
                  ["Posted by", postedBy[0].toUpperCase() + postedBy.slice(1)],
                  ["Area", area || "—"],
                  ["Home", `${flatType} · ${furnishing}`],
                  ["Rent", rent ? `₹${Number(rent).toLocaleString("en-IN")}/mo` : "—"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0" }}>
                    <span style={{ color: "#8AA5A0", fontSize: 12.5 }}>{k}</span>
                    <span style={{ color: "#E5F1EE", fontSize: 12.5, fontWeight: 700, textAlign: "right", minWidth: 0 }}>{v}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {(err || uploadMsg) && (
          <p style={{ color: err ? "#FCA5A5" : "#8AA5A0", fontSize: 13, fontWeight: 600, marginTop: 18, lineHeight: 1.45 }}>
            {err || uploadMsg}
          </p>
        )}
      </div>

      {/* STICKY FOOTER */}
      <div style={{
        position: "sticky", bottom: 0, zIndex: 5,
        padding: "14px 20px calc(18px + env(safe-area-inset-bottom,0px))",
        background: "linear-gradient(180deg,rgba(10,24,23,0),#0A1817 32%)",
        borderTop: "1px solid rgba(255,255,255,.06)",
      }}>
        <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
          {step > 1 && (
            <button type="button" onClick={onBack} aria-label="Back" disabled={saving}
              style={{ flex: "none", width: 54, height: 54, borderRadius: 100, border: "1px solid rgba(255,255,255,.16)", background: "rgba(255,255,255,.04)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F1F6F4" strokeWidth="1.9" aria-hidden>
                <path d="M14.5 5.5 8 12l6.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <button type="button" onClick={onNext} disabled={saving}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              background: MINT, color: "#04211D", fontWeight: 800, fontSize: 16.5,
              padding: "8px 8px 8px 24px", borderRadius: 100, border: "none",
              cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1, fontFamily: "inherit",
            }}>
            {saving ? "Publishing…" : step === TOTAL_STEPS ? "Publish my flat" : "Continue"}
            <span style={{ flex: "none", width: 38, height: 38, borderRadius: "50%", background: "rgba(4,33,29,.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#04211D" strokeWidth="2" aria-hidden>
                <path d="M4.5 12h14M13 6.5 18.5 12 13 17.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 14 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6F8681" strokeWidth="2" aria-hidden>
            <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
            <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" strokeLinecap="round" />
          </svg>
          <span style={{ color: "#6F8681", fontSize: 12.5, fontWeight: 600 }}>100% Free to list · No Hidden Charges</span>
        </div>
      </div>
    </div>
  );
}
