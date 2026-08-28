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
 * Three deliberate departures from the design mockup, each load-bearing:
 *  - The mockup collects the address as free text. Location here keeps the real
 *    map picker, because latitude/longitude are what put a listing on /map and
 *    drive distance scoring in lib/recommend.js — a typed address alone would
 *    publish homes that never appear anywhere.
 *  - Chip labels reuse the canonical vocabularies from data/preferenceOptions
 *    (FURNISHINGS, OCCUPANTS, MUST_HAVES, FLAT_TYPES) rather than the mockup's
 *    prose ("Gated security", "Fully furnished"). lib/inventoryMatch.js scores
 *    listings by exact string match against those lists, so re-typing the
 *    labels would quietly stop new listings from matching anyone.
 *  - "Are you the owner?" maps to the real posted_by roles (owner / tenant /
 *    broker) that downstream logic branches on, not the mockup's
 *    Owner/Family member/Caretaker, which nothing consumes.
 */
import { useEffect, useMemo, useState } from "react";
import ListingMapPicker from "./ListingMapPicker";
import { reverseGeocode, nearbyLandmarks } from "../lib/geocode";
import { createInventoryItem, uploadInventoryPhotos, generatePropertyId } from "../lib/inventory";
import { fetchAllUserRequirements } from "../lib/userRequirements";
import { matchListingToRequirements } from "../lib/inventoryMatch";
import { ALL_LOCALITIES, FLAT_TYPES, FURNISHINGS, OCCUPANTS, MUST_HAVES } from "../data/preferenceOptions";

const MINT = "#5EEAD4";
const TOTAL_STEPS = 6;

const PROPERTY_TYPES = [
  ["Apartment", "M6 3h12v18H6z M9 7h1.5M13.5 7H15M9 11h1.5M13.5 11H15M9 15h1.5M13.5 15H15"],
  ["Independent House", "M4 11 12 4l8 7v9H4z M10 20v-5h4v5"],
  ["Studio / 1RK", "M4 14v5h16v-5M5.5 14V10a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v4M3 14h18"],
  ["PG / Co-living", ""],
];
const FACINGS = ["East", "West", "North", "South", "Not sure"];
const PARKINGS = ["None", "Bike", "Car", "Both"];
const BATHROOMS = ["1", "2", "3", "4+"];
const DEPOSIT_PRESETS = ["1 month", "2 months", "3 months", "Custom"];
const RULE_OPTIONS = ["Pets allowed", "Vegetarians Only", "No Smoking"];
const REACH_TIMES = ["Morning", "Afternoon", "Evening", "Anytime"];
const PHOTO_SLOTS = ["Living room", "Bedroom", "Kitchen", "Bathroom"];
const POSTER_ROLES = [["owner", "Owner"], ["tenant", "Tenant"], ["broker", "Broker"]];

const STEP_COPY = [
  ["Let's get started 👋", "Tell us about your flat & we'll take care of the rest."],
  ["A few more details", "The things renters ask about before they even call."],
  ["What's the rent?", "Set your price — you can always change it later."],
  ["What's included?", "The extras that make your flat stand out."],
  ["Show it off", "Photos do most of the selling for you."],
  ["How do we reach you?", "Only our team sees this — never shown publicly."],
];

/* ── shared bits ───────────────────────────────────────────────────────────── */

function Q({ children, sub }) {
  return (
    <>
      <div style={{ color: "#F1F6F4", fontSize: 17, fontWeight: 700, marginBottom: sub ? 6 : 12 }}>{children}</div>
      {sub && <div style={{ color: "#8AA5A0", fontSize: 13, marginBottom: 13 }}>{sub}</div>}
    </>
  );
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

function Toggle({ on, onChange, title, sub, gold }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, width: "100%",
        border: `1px solid ${gold ? "rgba(232,163,61,.3)" : "rgba(255,255,255,.1)"}`,
        borderRadius: 14, padding: 16, textAlign: "left",
        background: gold ? "rgba(232,163,61,.06)" : "rgba(255,255,255,.02)",
        cursor: "pointer", fontFamily: "inherit",
      }}
    >
      <span>
        <span style={{ display: "block", color: "#F1F6F4", fontSize: 15, fontWeight: 700 }}>{title}</span>
        <span style={{ display: "block", color: gold ? "#C9AE85" : "#8AA5A0", fontSize: 13, marginTop: 3 }}>{sub}</span>
      </span>
      <span style={{
        flex: "none", width: 48, height: 28, borderRadius: 100, position: "relative",
        background: on ? MINT : "rgba(255,255,255,.16)", transition: "background .25s ease",
      }}>
        <span style={{
          position: "absolute", top: 3, left: on ? 23 : 3, width: 22, height: 22, borderRadius: "50%",
          background: on ? "#04211D" : "#0A1817", transition: "left .25s cubic-bezier(.16,1,.3,1)",
        }} />
      </span>
    </button>
  );
}

/* ── page ──────────────────────────────────────────────────────────────────── */

export default function ListMyFlatMobile({ user, onPublished }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // 1 — location & basics
  const [marker, setMarker] = useState(null);
  const [fullAddress, setFullAddress] = useState("");
  const [area, setArea] = useState("");
  const [landmark, setLandmark] = useState("");
  const [resolving, setResolving] = useState(false);
  const [propertyType, setPropertyType] = useState("Apartment");
  const [flatType, setFlatType] = useState("2 BHK");
  const [availableFrom, setAvailableFrom] = useState("");

  // 2 — the home
  const [furnishing, setFurnishing] = useState("Fully Furnished");
  const [builtUpArea, setBuiltUpArea] = useState("");
  const [floorNumber, setFloorNumber] = useState("");
  const [totalFloors, setTotalFloors] = useState("");
  const [bathrooms, setBathrooms] = useState("2");
  const [facing, setFacing] = useState("");
  const [parking, setParking] = useState("");

  // 3 — money
  const [rent, setRent] = useState("");
  const [depositPreset, setDepositPreset] = useState("1 month");
  const [depositCustom, setDepositCustom] = useState("");
  const [maintenance, setMaintenance] = useState("");
  const [negotiable, setNegotiable] = useState(false);

  // 4 — what's included
  const [amenities, setAmenities] = useState([]);
  const [occupants, setOccupants] = useState([]);
  const [houseRules, setHouseRules] = useState([]);

  // 5 — photos & description
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [wantsPhotographer, setWantsPhotographer] = useState(false);
  const [description, setDescription] = useState("");

  // 6 — contact
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [postedBy, setPostedBy] = useState("owner");
  const [bestTime, setBestTime] = useState("");

  const propertyId = useMemo(() => generatePropertyId(), []);

  // Deposit resolves to a real number: the "N month" presets multiply the rent,
  // "Custom" takes the typed amount.
  const depositValue = useMemo(() => {
    const r = Number(String(rent).replace(/[^\d]/g, "")) || 0;
    if (depositPreset === "Custom") return Number(String(depositCustom).replace(/[^\d]/g, "")) || 0;
    return r * (Number(depositPreset.charAt(0)) || 1);
  }, [rent, depositPreset, depositCustom]);

  useEffect(() => () => photoPreviews.forEach((u) => URL.revokeObjectURL(u)), [photoPreviews]);

  // The pin is the only source of the exact address and of latitude/longitude.
  // `area` stays a separate, explicitly-chosen locality (below) rather than
  // anything parsed out of the geocoder: lib/recommend.js matches listings to
  // seekers on that exact vocabulary, so a free-text "Agara, Karnataka" here
  // would publish a home that no search ever surfaces.
  const handleMarker = async (pos) => {
    setMarker(pos);
    setErr("");
    if (!pos) { setFullAddress(""); setLandmark(""); return; }
    setResolving(true);
    try {
      const [r, near] = await Promise.all([
        reverseGeocode(pos[0], pos[1]),
        nearbyLandmarks(pos[0], pos[1], { limit: 12 }),
      ]);
      setFullAddress(r?.display || "");
      setLandmark((near || [])[0]?.display || "");
    } catch {
      setFullAddress(""); setLandmark("");
    } finally {
      setResolving(false);
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

  const validate = () => {
    if (step === 1) {
      if (!area) return "Select the flat's area.";
      if (!marker) return "Drop a pin on the map so renters can find your flat.";
      if (!availableFrom) return "Pick the date it's available from.";
    }
    if (step === 3 && !(Number(String(rent).replace(/[^\d]/g, "")) > 0)) return "Add the expected monthly rent.";
    if (step === 6) {
      if (!name.trim()) return "Add your name.";
      if (!/^\d{10}$/.test(phone.replace(/\D/g, ""))) return "Add a 10-digit phone number.";
    }
    return "";
  };

  const submit = async () => {
    setSaving(true);
    setErr("");
    try {
      let images = [];
      if (photoFiles.length) images = await uploadInventoryPhotos(photoFiles, propertyId);
      const draft = {
        propertyId, postedBy, phone: phone.replace(/\D/g, ""),
        area, fullAddress, landmark,
        latitude: marker?.[0], longitude: marker?.[1],
        rent: Number(String(rent).replace(/[^\d]/g, "")) || 0,
        deposit: depositValue,
        availableFrom,
        flatType,
        bedrooms: Number(String(flatType).charAt(0)) || 1,
        bathrooms: Number(String(bathrooms).replace(/\D/g, "")) || 1,
        furnishing,
        occupantsAllowed: occupants.length ? occupants : [...OCCUPANTS],
        amenities, houseRules, lifestyle: [],
        title: `${flatType} in ${area || "Bengaluru"}`,
        description, images,
        propertyType, builtUpArea, floorNumber, totalFloors, facing, parking,
        maintenanceAmount: maintenance, rentNegotiable: negotiable,
        bestTimeToReach: bestTime, wantsPhotographer,
      };
      const row = await createInventoryItem(draft, { ...user, name: name || user?.name });
      let matches = [];
      try {
        matches = matchListingToRequirements(row, await fetchAllUserRequirements());
      } catch { /* matching is a nice-to-have; never block a successful publish */ }
      onPublished?.(row, matches);
    } catch (e) {
      setErr(e?.message || "Could not publish your listing. Please try again.");
      setSaving(false);
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
          <div style={{ fontFamily: "'Caveat',cursive", fontWeight: 700, fontSize: 38, lineHeight: 1.05, color: "#fff", marginTop: 20 }}>
            List your flat.
          </div>
          <div style={{ fontFamily: "'Caveat',cursive", fontWeight: 700, fontSize: 31, lineHeight: 1.15, marginTop: 2 }}>
            <span style={{ color: MINT }}>Fast, free &amp; </span>
            <span style={{ color: "#E8A33D", borderBottom: "3px solid rgba(232,163,61,.85)", paddingBottom: 2 }}>effortless.</span>
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
                <Q>Which area is it in?</Q>
                <Field>
                  <select value={area} onChange={(e) => setArea(e.target.value)}
                    style={{ ...inputStyle, appearance: "none", cursor: "pointer", color: area ? "#F1F6F4" : "#6F8681" }}>
                    <option value="" style={{ background: "#0A1817" }}>Select the locality…</option>
                    {ALL_LOCALITIES.map((a) => <option key={a} value={a} style={{ background: "#0A1817" }}>{a}</option>)}
                  </select>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7E9994" strokeWidth="1.8" style={{ flex: "none" }} aria-hidden>
                    <path d="M6 9.5 12 15.5 18 9.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Field>
              </div>

              <div>
                <Q>Now drop a pin on your building</Q>
                <ListingMapPicker
                  theme="dark"
                  markerPosition={marker}
                  onMarkerChange={handleMarker}
                  height={230}
                  focusQuery={area && area !== "Other" ? `${area}, Bengaluru` : ""}
                />
                <div style={{ color: resolving ? "#9FB5B0" : "#6F8681", fontSize: 12.5, marginTop: 9, lineHeight: 1.45 }}>
                  {resolving ? "Finding the address…" : fullAddress || "Search or tap the map to drop a pin on your building."}
                </div>
              </div>

              <div>
                <Q>What type of property is it?</Q>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 9 }}>
                  {PROPERTY_TYPES.map(([label]) => {
                    const on = propertyType === label;
                    return (
                      <button key={label} type="button" onClick={() => setPropertyType(label)}
                        style={{
                          border: `1px solid ${on ? MINT : "rgba(255,255,255,.13)"}`,
                          background: on ? "rgba(94,234,212,.10)" : "rgba(255,255,255,.02)",
                          color: on ? MINT : "#9FB5B0",
                          borderRadius: 13, padding: "16px 8px", fontSize: 12.5, fontWeight: 600,
                          cursor: "pointer", fontFamily: "inherit", lineHeight: 1.25,
                        }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Q>How many BHK?</Q>
                <ChipRow options={FLAT_TYPES} value={flatType} onPick={setFlatType} />
              </div>

              <div>
                <Q>Available from</Q>
                <Field>
                  <input type="date" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} style={inputStyle} />
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <Q>How is it furnished?</Q>
                <ChipRow options={FURNISHINGS} value={furnishing} onPick={setFurnishing} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <div style={{ color: "#F1F6F4", fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Built-up area</div>
                  <Field suffix={<span style={{ color: "#6F8681", fontSize: 13, fontWeight: 600, flex: "none" }}>sq ft</span>}>
                    <input type="text" inputMode="numeric" placeholder="1150" value={builtUpArea}
                      onChange={(e) => setBuiltUpArea(e.target.value)} style={{ ...inputStyle, padding: "15px 0" }} />
                  </Field>
                </div>
                <div>
                  <div style={{ color: "#F1F6F4", fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Floor</div>
                  <Field suffix={
                    <span style={{ display: "flex", alignItems: "center", gap: 4, flex: "none", color: "#6F8681", fontSize: 13, fontWeight: 600 }}>
                      of
                      <input type="text" inputMode="numeric" placeholder="12" value={totalFloors}
                        onChange={(e) => setTotalFloors(e.target.value)}
                        style={{ ...inputStyle, width: 28, flex: "none", padding: "15px 0", fontSize: 13, color: "#9FB5B0" }} />
                    </span>
                  }>
                    <input type="text" inputMode="numeric" placeholder="4" value={floorNumber}
                      onChange={(e) => setFloorNumber(e.target.value)} style={{ ...inputStyle, padding: "15px 0" }} />
                  </Field>
                </div>
              </div>
              <div>
                <Q>Bathrooms</Q>
                <ChipRow options={BATHROOMS} value={bathrooms} onPick={setBathrooms} />
              </div>
              <div>
                <Q>Which way does it face?</Q>
                <ChipRow options={FACINGS} value={facing} onPick={setFacing} />
              </div>
              <div>
                <Q>Parking available</Q>
                <ChipRow options={PARKINGS} value={parking} onPick={setParking} />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <Q>Expected monthly rent</Q>
                <Field
                  accent
                  prefix={<span style={{ color: MINT, fontSize: 20, fontWeight: 800, flex: "none" }}>₹</span>}
                  suffix={<span style={{ color: "#6F8681", fontSize: 13, fontWeight: 600, flex: "none" }}>/ month</span>}
                >
                  <input type="text" inputMode="numeric" placeholder="32,000" value={rent}
                    onChange={(e) => setRent(e.target.value)} style={{ ...inputStyle, fontSize: 19, fontWeight: 700 }} />
                </Field>
              </div>
              <div>
                <Q>Security deposit</Q>
                <ChipRow options={DEPOSIT_PRESETS} value={depositPreset} onPick={setDepositPreset} />
                {depositPreset === "Custom" ? (
                  <div style={{ marginTop: 12 }}>
                    <Field prefix={<span style={{ color: "#6F8681", fontSize: 16, fontWeight: 700, flex: "none" }}>₹</span>}>
                      <input type="text" inputMode="numeric" placeholder="80,000" value={depositCustom}
                        onChange={(e) => setDepositCustom(e.target.value)} style={inputStyle} />
                    </Field>
                  </div>
                ) : depositValue > 0 && (
                  <div style={{ color: "#6F8681", fontSize: 12.5, marginTop: 9 }}>
                    That&apos;s ₹{depositValue.toLocaleString("en-IN")} upfront.
                  </div>
                )}
              </div>
              <div>
                <Q>Monthly maintenance</Q>
                <Field prefix={<span style={{ color: "#6F8681", fontSize: 16, fontWeight: 700, flex: "none" }}>₹</span>}>
                  <input type="text" inputMode="numeric" placeholder="2,500 (or leave blank if included)"
                    value={maintenance} onChange={(e) => setMaintenance(e.target.value)} style={inputStyle} />
                </Field>
              </div>
              <Toggle on={negotiable} onChange={setNegotiable}
                title="Rent is negotiable" sub="We'll flag it to serious tenants" />
            </>
          )}

          {step === 4 && (
            <>
              <div>
                <Q sub="Pick everything that applies">What does the flat include?</Q>
                <ChipMulti options={MUST_HAVES} selected={amenities}
                  onToggle={(v) => setAmenities((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v])} />
              </div>
              <div>
                <Q sub="Leave blank to welcome everyone">Preferred tenants</Q>
                <ChipMulti options={OCCUPANTS} selected={occupants}
                  onToggle={(v) => setOccupants((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v])} />
              </div>
              <div>
                <Q>House rules</Q>
                <ChipMulti options={RULE_OPTIONS} selected={houseRules}
                  onToggle={(v) => setHouseRules((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v])} />
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <div>
                <Q sub="Listings with 5+ real photos get rented almost twice as fast. Our agent can shoot them for you instead.">
                  Add photos of your flat
                </Q>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                  {photoPreviews.map((src, i) => (
                    <div key={src} style={{ position: "relative", aspectRatio: "4/3", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,.13)" }}>
                      <img src={src} alt={`Photo ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button type="button" onClick={() => removePhoto(i)} aria-label={`Remove photo ${i + 1}`}
                        style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: "50%", border: "none", background: "rgba(4,17,15,.75)", color: "#fff", fontSize: 15, lineHeight: 1, cursor: "pointer" }}>
                        ×
                      </button>
                    </div>
                  ))}
                  {PHOTO_SLOTS.slice(Math.min(photoPreviews.length, PHOTO_SLOTS.length - 1)).map((slot, i) => {
                    const first = i === 0 && photoPreviews.length === 0;
                    return (
                      <label key={slot} style={{
                        aspectRatio: "4/3", borderRadius: 14, cursor: "pointer",
                        border: `1px dashed ${first ? "rgba(94,234,212,.4)" : "rgba(255,255,255,.16)"}`,
                        background: first ? "rgba(94,234,212,.05)" : "rgba(255,255,255,.02)",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
                      }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={first ? MINT : "#7E9994"} strokeWidth="1.6" aria-hidden>
                          <path d="M12 6v12M6 12h12" strokeLinecap="round" />
                        </svg>
                        <span style={{ color: first ? MINT : "#7E9994", fontSize: 12.5, fontWeight: 700 }}>{slot}</span>
                        <input type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
                      </label>
                    );
                  })}
                </div>
              </div>
              <Toggle gold on={wantsPhotographer} onChange={setWantsPhotographer}
                title="Send a movEazy photographer" sub="Free. Usually within 48 hours." />
              <div>
                <Q>Anything else tenants should know?</Q>
                <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Corner flat with a park-facing balcony, 5 minutes from Hebbal metro."
                  style={{
                    width: "100%", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.13)",
                    borderRadius: 14, padding: 15, color: "#F1F6F4", fontSize: 14.5, lineHeight: 1.5,
                    outline: "none", resize: "none", fontFamily: "inherit",
                  }} />
              </div>
            </>
          )}

          {step === 6 && (
            <>
              <div>
                <Q>Your name</Q>
                <Field>
                  <input type="text" placeholder="Rakesh Kumar" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
                </Field>
              </div>
              <div>
                <Q>Phone number</Q>
                <Field prefix={<span style={{ color: "#9FB5B0", fontSize: 15, fontWeight: 700, flex: "none", borderRight: "1px solid rgba(255,255,255,.12)", paddingRight: 12 }}>+91</span>}>
                  <input type="tel" inputMode="numeric" placeholder="98765 43210" value={phone}
                    onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
                </Field>
                <div style={{ color: "#6F8681", fontSize: 12.5, marginTop: 9 }}>
                  Shared only with renters who book a visit.
                </div>
              </div>
              <div>
                <Q>Are you the owner?</Q>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                  {POSTER_ROLES.map(([v, label]) => (
                    <Chip key={v} label={label} on={postedBy === v} onClick={() => setPostedBy(v)} />
                  ))}
                </div>
              </div>
              <div>
                <Q>Best time to reach you</Q>
                <ChipRow options={REACH_TIMES} value={bestTime} onPick={setBestTime} />
              </div>
            </>
          )}
        </div>

        {err && (
          <p style={{ color: "#FCA5A5", fontSize: 13, fontWeight: 600, marginTop: 18, lineHeight: 1.45 }}>{err}</p>
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
