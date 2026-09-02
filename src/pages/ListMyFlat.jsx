import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import PageShell from "../components/layout/PageShell";
import ListingMapPicker from "../components/ListingMapPicker";
import ListMyFlatMobile from "../components/ListMyFlatMobile";
import { reverseGeocode, nearbyLandmarks } from "../lib/geocode";
import { createInventoryItem, uploadInventoryPhotos, generatePropertyId } from "../lib/inventory";
import { fetchAllUserRequirements } from "../lib/userRequirements";
import { matchListingToRequirements } from "../lib/inventoryMatch";
import { fetchSlotsForProperty, addVisitSlot, deleteVisitSlot } from "../lib/visits";
import {
  ALL_LOCALITIES, FLAT_TYPES, FURNISHINGS, OCCUPANTS,
  MUST_HAVES, LIFESTYLE,
} from "../data/preferenceOptions";

const BRAND_RED = "#ff3131";
const RULE_OPTIONS = [
  "No Smoking", "No Pets", "No Alcohol", "Vegetarians Only",
  "Working Professionals Only", "No Brokerage", "Fully Furnished",
];
const POSTER_ROLES = [
  ["owner", "Owner", "I own this property"],
  ["tenant", "Tenant", "I live here / passing it on"],
  ["broker", "Broker / Agent", "I'm listing on behalf of an owner"],
];

/** Compact / affordable homes earn a ₹10,000 wallet reward, credited on a successful sale. */
const WALLET_REWARD_TYPES = ["1 RK", "1 BHK", "Room in Preoccupied flat"];
const WALLET_REWARD_AMOUNT = 10000;
const fmtWallet = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const inp = "w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-[14px] text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-red-400 focus:ring-2 focus:ring-red-100";

/** Phone-width only: the posting form gets its own mobile layout (components/ListMyFlatMobile.jsx).
 *  Tablet and desktop keep the three-step form below. Tracked live so a rotation
 *  or resize swaps layouts instead of stranding a half-filled form. */
function useIsPhone() {
  const query = "(max-width: 767px)";
  const [isPhone, setIsPhone] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setIsPhone(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isPhone;
}

function Label({ children, required }) {
  return (
    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="px-3.5 py-1.5 rounded-full text-[12px] font-bold border transition-all"
      style={{ borderColor: active ? BRAND_RED : "#e2e8f0", background: active ? "#fff5f5" : "white", color: active ? BRAND_RED : "#64748b" }}>
      {label}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4 ${className}`}>
      {children}
    </div>
  );
}

/** A multi-select chip group backed by a string[] in state. */
function ChipMulti({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o} label={o} active={selected.includes(o)} onClick={() => onToggle(o)} />
      ))}
    </div>
  );
}

const STEPS = ["Who & Where", "The Home", "Publish"];

export default function ListMyFlat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [published, setPublished] = useState(null); // { row, matches }
  const [showDashboard, setShowDashboard] = useState(false); // tenant: leads + visit-slots view

  // Step 1 — who & where
  const [postedBy, setPostedBy] = useState("owner");
  const [area, setArea] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [marker, setMarker] = useState(null); // [lat, lng]
  const [resolvingAddr, setResolvingAddr] = useState(false);
  const [landmarkOptions, setLandmarkOptions] = useState([]);

  // Step 2 — the home (Train My Broker parity)
  const [flatType, setFlatType] = useState("2 BHK");
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [furnishing, setFurnishing] = useState("Fully Furnished");
  const [rent, setRent] = useState("");
  const [deposit, setDeposit] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");
  const [maxFlatmates, setMaxFlatmates] = useState(1);
  const [genderPref, setGenderPref] = useState("any");
  const [occupantsAllowed, setOccupantsAllowed] = useState([...OCCUPANTS]);
  const [amenities, setAmenities] = useState([]);
  const [lifestyle, setLifestyle] = useState([]);
  const [houseRules, setHouseRules] = useState([]);

  // Step 3 — describe
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [uploadMsg, setUploadMsg] = useState("");

  const propertyId = useMemo(() => generatePropertyId(), []);

  useEffect(() => {
    if (!user) navigate(`/auth?next=${encodeURIComponent("/list-my-flat")}`, { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (area) setTitle((t) => t || `${flatType} in ${area}`);
  }, [area, flatType]);

  const toggleIn = (setter) => (v) =>
    setter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  // The map is the only source of the flat's exact address: whenever the pin
  // moves (map click or address search), reverse-geocode it into a readable
  // address and store both the address text and the coordinates.
  const handleMarkerChange = async (pos) => {
    setMarker(pos);
    if (errors.fullAddress) setErrors((e) => ({ ...e, fullAddress: "" }));
    if (!pos) { setFullAddress(""); setLandmarkOptions([]); setLandmark(""); return; }
    setResolvingAddr(true);
    // Resolve the exact address, and pull nearby named places to offer as landmarks.
    try {
      const [r, near] = await Promise.all([
        reverseGeocode(pos[0], pos[1]),
        nearbyLandmarks(pos[0], pos[1], { limit: 12 }),
      ]);
      setFullAddress(r?.display || "");
      const opts = (near || []).map((n) => n.display);
      setLandmarkOptions(opts);
      // near is already sorted best-first (most prominent place within 1km), so
      // pre-fill the landmark with the top pick; the user can still change it.
      setLandmark(opts[0] || "");
    } catch {
      setFullAddress("");
      setLandmarkOptions([]);
      setLandmark("");
    } finally {
      setResolvingAddr(false);
    }
  };

  // Bulk photo picker — accepts a multi-selection straight from the gallery.
  const addPhotos = (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    setPhotoFiles((prev) => [...prev, ...files]);
    setPhotoPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  };
  const removePhoto = (i) => {
    setPhotoPreviews((prev) => { URL.revokeObjectURL(prev[i]); return prev.filter((_, idx) => idx !== i); });
    setPhotoFiles((prev) => prev.filter((_, idx) => idx !== i));
  };

  const validateStep = () => {
    const e = {};
    if (step === 0) {
      if (!area) e.area = "Select the flat's area";
      if (!marker) e.fullAddress = "Drop a pin on the map to set the exact address";
    }
    if (step === 1) {
      if (!rent) e.rent = "Enter the monthly rent";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep()) setStep((s) => Math.min(s + 1, 2)); };
  const back = () => { setErrors({}); setStep((s) => Math.max(s - 1, 0)); };

  const buildDraft = (images = []) => ({
    propertyId,
    postedBy,
    phone: user?.phone || "",
    area,
    nearbyAreas: [],
    fullAddress,
    landmark,
    latitude: marker?.[0] ?? null,
    longitude: marker?.[1] ?? null,
    rent,
    deposit,
    availableFrom,
    flatType,
    bedrooms,
    bathrooms,
    furnishing,
    maxFlatmates,
    genderPref,
    occupantsAllowed,
    amenities,
    lifestyle,
    houseRules,
    title,
    description,
    images,
  });

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSaving(true);
    setErrors({});
    setUploadMsg("");
    try {
      // 1) Upload the gallery photos, then 2) store the inventory row in the DB.
      let images = [];
      if (photoFiles.length) {
        setUploadMsg(`Uploading ${photoFiles.length} photo${photoFiles.length > 1 ? "s" : ""}…`);
        images = await uploadInventoryPhotos(photoFiles, propertyId, (d, t) => setUploadMsg(`Uploading photos… ${d}/${t}`));
      }
      setUploadMsg("");
      const row = await createInventoryItem(buildDraft(images), user);
      // Map the new flat against every active seeker requirement.
      let matches = [];
      try {
        const requirements = await fetchAllUserRequirements();
        matches = matchListingToRequirements(row, requirements, { min: 40 }).slice(0, 8);
      } catch { /* matching is best-effort */ }
      setPublished({ row, matches });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setErrors({ submit: err?.message || "Something went wrong while publishing." });
    } finally {
      setSaving(false);
      setUploadMsg("");
    }
  };

  if (!user) return null;

  /* ── Success / mapping screen ── */
  if (published) {
    const { row, matches } = published;
    const isBroker = postedBy === "broker";
    const isOwner = postedBy === "owner";
    const isTenant = postedBy === "tenant";
    const roleLabel = isBroker ? "Broker" : isTenant ? "Tenant" : "Owner";
    const rewardEligible = WALLET_REWARD_TYPES.includes(flatType);
    const walletAmount = rewardEligible ? WALLET_REWARD_AMOUNT : 0;
    const listingTitle = row.title || title || `${flatType} in ${area || "Bengaluru"}`;

    return (
      <PageShell variant="marketing" overlayOnly className="antialiased" style={{ background: "#f0ebe3" }}>
        <Navbar variant="marketing" />
        <main className="max-w-2xl mx-auto px-4 pb-16 pt-8">
          {/* Published confirmation (owner & tenant get a wallet top-right) */}
          <Card>
            <div className="p-8 text-center relative">
              {(isOwner || isTenant) && (
                <button
                  type="button"
                  onClick={() => { if (isTenant) setShowDashboard((v) => !v); }}
                  className="absolute top-4 right-4 inline-flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors"
                  style={{
                    borderColor: rewardEligible ? "#86efac" : "#e5e7eb",
                    background: rewardEligible ? "#ecfdf5" : "#f9fafb",
                    cursor: isTenant ? "pointer" : "default",
                  }}
                  title={isTenant ? "Open your property dashboard" : "Your MovEazy wallet"}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke={rewardEligible ? "#16a34a" : "#94a3b8"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12" /><path d="M16 12h.01" /></svg>
                  <span className="text-left leading-tight">
                    <span className="block text-[9px] font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>Wallet</span>
                    <span className="block text-[14px] font-extrabold" style={{ color: rewardEligible ? "#15803d" : "#334155" }}>{fmtWallet(walletAmount)}</span>
                  </span>
                </button>
              )}
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "#dcfce7" }}>
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              </div>
              <h1 className="text-[24px] font-extrabold text-gray-900 mb-1">Your listing is published! 🎉</h1>
              <p className="text-[13px] text-gray-500 mb-4">It's saved to MovEazy and visible to matching renters. Keep this Property ID for any enquiries.</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: "#1c1917" }}>
                  <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.5)" }}>Property ID</span>
                  <span className="text-[16px] font-extrabold text-white tracking-wider">{row.property_id}</span>
                </div>
                <span className="inline-flex items-center px-3 py-2 rounded-xl text-[12px] font-bold" style={{ background: "#fff5f5", color: BRAND_RED }}>
                  Listed by {roleLabel}
                </span>
              </div>
              {rewardEligible && (isOwner || isTenant) && (
                <p className="mt-4 text-[12px] font-semibold" style={{ color: "#15803d" }}>
                  🎉 You've earned {fmtWallet(WALLET_REWARD_AMOUNT)} — credited to your wallet once this home is sold through a MovEazy on-ground executive.
                </p>
              )}
            </div>
          </Card>

          {isTenant && showDashboard ? (
            <PropertyLeadDashboard
              propertyId={row.property_id}
              listingTitle={listingTitle}
              leads={matches}
              walletAmount={walletAmount}
              rewardEligible={rewardEligible}
              onClose={() => setShowDashboard(false)}
            />
          ) : (
            <>
              {/* Ground-agent verification */}
              <Card>
                <div className="p-6 flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center" style={{ background: "#fff5f5" }}>
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke={BRAND_RED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                  </div>
                  <div>
                    <p className="text-[15px] font-extrabold text-gray-900 mb-1">A ground agent will verify your property</p>
                    <p className="text-[13px] text-gray-600 leading-relaxed">
                      One of our MovEazy ground agents will visit <span className="font-semibold">{row.full_address || row.area || "your flat"}</span> to verify the details and photos.
                      We'll call you on <span className="font-semibold">{row.phone || "your number"}</span> to schedule a convenient time. Verified listings get a trust badge and far more enquiries.
                    </p>
                    <span className="inline-block mt-3 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: "#fef9c3", color: "#a16207" }}>
                      Status: Pending verification
                    </span>
                  </div>
                </div>
              </Card>

              {/* Role-specific next step */}
              {isBroker && (
                <>
                  <div className="rounded-2xl overflow-hidden mb-4" style={{ background: "linear-gradient(135deg,#1c1917,#3b2b28)" }}>
                    <div className="p-6">
                      <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "#e0a83b" }}>Listing as a broker?</p>
                      <p className="text-[18px] font-extrabold text-white leading-snug mb-1">Add your <span style={{ color: "#ff6b57" }}>next property</span> in minutes.</p>
                      <p className="text-[13px] mb-4" style={{ color: "rgba(255,255,255,0.72)" }}>
                        The more verified homes you list, the more renters we match you with. Post another property now, or manage everything from your broker dashboard.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <button type="button" onClick={() => window.location.reload()}
                          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold text-white"
                          style={{ background: `linear-gradient(135deg,${BRAND_RED},#ef4444)` }}>
                          List another property
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                        <button type="button" onClick={() => navigate("/broker")}
                          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold"
                          style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}>
                          Go to broker dashboard
                        </button>
                      </div>
                    </div>
                  </div>
                  <BrokerPlanCard />
                </>
              )}

              {isOwner && (
                <div className="rounded-2xl overflow-hidden mb-4" style={{ background: "linear-gradient(135deg,#1c1917,#3b2b28)" }}>
                  <div className="p-6">
                    <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "#e0a83b" }}>Own more than one place?</p>
                    <p className="text-[18px] font-extrabold text-white leading-snug mb-1">List <span style={{ color: "#ff6b57" }}>another property</span> and reach more renters.</p>
                    <p className="text-[13px] mb-4" style={{ color: "rgba(255,255,255,0.72)" }}>
                      Every home you list gets verified and matched to real seekers. Add your next one in a couple of minutes.
                    </p>
                    <button type="button" onClick={() => window.location.reload()}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold text-white"
                      style={{ background: `linear-gradient(135deg,${BRAND_RED},#ef4444)` }}>
                      List another property
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </div>
                </div>
              )}

              {isTenant && (
                <div className="rounded-2xl overflow-hidden mb-4" style={{ background: "linear-gradient(135deg,#1c1917,#3b2b28)" }}>
                  <div className="p-6">
                    <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "#e0a83b" }}>Moving out yourself?</p>
                    <p className="text-[18px] font-extrabold text-white leading-snug mb-1">Now let us find <span style={{ color: "#ff6b57" }}>your</span> next home.</p>
                    <p className="text-[13px] mb-4" style={{ color: "rgba(255,255,255,0.72)" }}>
                      You're passing this flat on because you're moving somewhere new. Our AI broker learns exactly what you want and hands you a shortlist worth your time — not a search dump.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={() => navigate("/?find=1")}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold text-white"
                        style={{ background: `linear-gradient(135deg,${BRAND_RED},#ef4444)` }}>
                        Find my next flat
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                      <button type="button" onClick={() => setShowDashboard(true)}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold"
                        style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}>
                        Open property dashboard
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Secondary: who this flat already matches */}
              {matches.length > 0 && (
                <Card>
                  <div className="p-6">
                    <p className="text-[14px] font-extrabold text-gray-900 mb-1">Already matches {matches.length} active seeker{matches.length > 1 ? "s" : ""}</p>
                    <p className="text-[12px] text-gray-500 mb-4">People whose Find My Flat requirements line up with your listing right now.</p>
                    <div className="space-y-2">
                      {matches.map((m, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50">
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-gray-800 truncate">
                              {m.requirement.email || m.requirement.customer_name || m.requirement.name || `Seeker #${String(m.requirement.user_id || i + 1).slice(0, 6)}`}
                            </p>
                            <p className="text-[11px] text-gray-500 truncate">{m.reasons.join(" · ") || "Requirement match"}</p>
                          </div>
                          <span className="shrink-0 ml-3 px-2.5 py-1 rounded-full text-[12px] font-extrabold text-white" style={{ background: m.score >= 80 ? "#16a34a" : m.score >= 60 ? BRAND_RED : "#e0a83b" }}>
                            {m.score}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => navigate("/map")}
                  className="flex-1 py-3.5 rounded-2xl text-[14px] font-bold text-gray-700 border border-gray-200 bg-white">
                  View on map
                </button>
                <button type="button" onClick={() => window.location.reload()}
                  className="flex-1 py-3.5 rounded-2xl text-[14px] font-bold text-gray-700 border border-gray-200 bg-white">
                  {isBroker ? "List another property" : "List another flat"}
                </button>
              </div>
            </>
          )}
        </main>
        <Footer />
      </PageShell>
    );
  }

  // Phones get their own posting layout. It reports the created row back up so
  // the success screen above stays the one implementation for both layouts —
  // seeding the fields that screen reads (role, flat type, area, title) from
  // the row it just created, since the mobile form holds its own state.
  if (isPhone) {
    return (
      <ListMyFlatMobile
        user={user}
        onPublished={(row, matches) => {
          setPostedBy(row.posted_by || "owner");
          setFlatType(row.flat_type || "");
          setArea(row.area || "");
          setTitle(row.title || "");
          setPublished({ row, matches });
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    );
  }

  return (
    <PageShell variant="marketing" overlayOnly className="antialiased" style={{ background: "#f0ebe3" }}>
      <Navbar variant="marketing" />

      <main className="max-w-2xl mx-auto px-4 pb-16 pt-8">
        {/* Step tabs */}
        <div className="flex items-center rounded-full p-1 mb-8" style={{ background: "#1c1917" }}>
          {STEPS.map((s, i) => (
            <button key={s} type="button"
              onClick={() => i < step && setStep(i)}
              className="flex-1 py-2.5 rounded-full text-[13px] font-bold transition-all"
              style={{ background: i === step ? "white" : "transparent", color: i === step ? "#1c1917" : "rgba(255,255,255,0.5)", cursor: i < step ? "pointer" : "default" }}>
              {s}
            </button>
          ))}
        </div>

        {/* ── STEP 1: Who & Where ── */}
        {step === 0 && (
          <div>
            <Card>
              <div className="p-6">
                <p className="text-[15px] font-extrabold text-gray-900 mb-4">Who's posting this flat?</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {POSTER_ROLES.map(([v, label, sub]) => (
                    <button key={v} type="button" onClick={() => setPostedBy(v)}
                      className="text-left p-3.5 rounded-xl border-2 transition-all"
                      style={{ borderColor: postedBy === v ? BRAND_RED : "#e2e8f0", background: postedBy === v ? "#fff5f5" : "white" }}>
                      <span className="text-[13px] font-extrabold text-gray-900 block mb-0.5">{label}</span>
                      <span className="text-[11px] text-gray-500 leading-tight block">{sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            {/* 1 — Area */}
            <Card>
              <div className="p-6 grid grid-cols-2 gap-4">
                <div>
                  <Label>City</Label>
                  <input value="Bengaluru" disabled className={inp + " bg-gray-50 cursor-not-allowed"} />
                </div>
                <div>
                  <Label required>Area</Label>
                  <select value={area} onChange={(e) => setArea(e.target.value)} className={inp}>
                    <option value="">Select a locality…</option>
                    {ALL_LOCALITIES.map((a) => <option key={a}>{a}</option>)}
                    <option value="Other">Other</option>
                  </select>
                  {errors.area && <p className="text-[11px] text-red-500 mt-1 font-semibold">{errors.area}</p>}
                </div>
              </div>
            </Card>

            {/* 2 — Exact address, map-based */}
            <Card>
              <div className="p-6">
                <p className="text-[14px] font-extrabold text-gray-900 mb-1">
                  Exact Address of the Flat <span className="text-red-500">*</span>
                </p>
                <p className="text-[12px] text-gray-400 mb-3">Search an address or tap the map to drop the pin. This is the flat's exact location — renters see it here on the map.</p>
                <ListingMapPicker markerPosition={marker} onMarkerChange={handleMarkerChange} height={280} focusQuery={area && area !== "Other" ? `${area}, Bengaluru` : ""} />
                {marker && (
                  <div className="mt-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">Pinned address</p>
                    <p className="text-[13px] font-semibold text-gray-800">
                      {resolvingAddr ? "Looking up address…" : (fullAddress || "Address unavailable — the pin location is saved.")}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">{marker[0].toFixed(5)}, {marker[1].toFixed(5)}</p>
                  </div>
                )}
                {errors.fullAddress && <p className="text-[11px] text-red-500 mt-2 font-semibold">{errors.fullAddress}</p>}
              </div>
            </Card>

            {/* 3 — Nearby landmark, pre-filled from the map (best place within 1km) */}
            <Card>
              <div className="p-6">
                <Label>Nearby Landmark</Label>
                <select value={landmark} onChange={(e) => setLandmark(e.target.value)}
                  disabled={landmarkOptions.length === 0} className={inp + (landmarkOptions.length === 0 ? " bg-gray-50 cursor-not-allowed text-gray-400" : "")}>
                  <option value="">
                    {resolvingAddr ? "Finding the best landmark nearby…" : landmarkOptions.length === 0 ? "Drop a pin on the map above first…" : "Select a nearby landmark…"}
                  </option>
                  {landmarkOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                {landmark && landmarkOptions.length > 0 && (
                  <p className="text-[11px] text-gray-400 mt-1.5">Auto-picked the most prominent spot within 1&nbsp;km — change it if you'd prefer another.</p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ── STEP 2: The Home ── */}
        {step === 1 && (
          <div>
            <Card>
              <div className="p-6">
                <p className="text-[14px] font-extrabold text-gray-900 mb-3">Home type</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {FLAT_TYPES.map((t) => (
                    <Chip key={t} label={t} active={flatType === t} onClick={() => setFlatType(t)} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Bedrooms</Label>
                    <select value={bedrooms} onChange={(e) => setBedrooms(Number(e.target.value))} className={inp}>
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Bathrooms</Label>
                    <select value={bathrooms} onChange={(e) => setBathrooms(Number(e.target.value))} className={inp}>
                      {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6 grid grid-cols-2 gap-4">
                <div>
                  <Label required>Monthly Rent (₹)</Label>
                  <input type="number" min="0" value={rent} onChange={(e) => setRent(e.target.value)} placeholder="35,000" className={inp} />
                  {errors.rent && <p className="text-[11px] text-red-500 mt-1 font-semibold">{errors.rent}</p>}
                </div>
                <div>
                  <Label>Security Deposit (₹)</Label>
                  <input type="number" min="0" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="1,00,000" className={inp} />
                </div>
                <div>
                  <Label>Available From</Label>
                  <input type="date" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} className={inp} />
                </div>
                <div>
                  <Label>Furnishing</Label>
                  <select value={furnishing} onChange={(e) => setFurnishing(e.target.value)} className={inp}>
                    {FURNISHINGS.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Max Flatmates</Label>
                  <select value={maxFlatmates} onChange={(e) => setMaxFlatmates(Number(e.target.value))} className={inp}>
                    {[0, 1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Preferred Tenant Gender</Label>
                  <select value={genderPref} onChange={(e) => setGenderPref(e.target.value)} className={inp}>
                    <option value="any">Co-ed / Any</option>
                    <option value="female">Girls Only</option>
                    <option value="male">Boys Only</option>
                  </select>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <p className="text-[14px] font-extrabold text-gray-900 mb-3">Who can live here?</p>
                <ChipMulti options={OCCUPANTS} selected={occupantsAllowed} onToggle={toggleIn(setOccupantsAllowed)} />
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <p className="text-[14px] font-extrabold text-gray-900 mb-3">Amenities</p>
                <ChipMulti options={MUST_HAVES} selected={amenities} onToggle={toggleIn(setAmenities)} />
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <p className="text-[14px] font-extrabold text-gray-900 mb-3">Lifestyle nearby</p>
                <ChipMulti options={LIFESTYLE} selected={lifestyle} onToggle={toggleIn(setLifestyle)} />
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <p className="text-[14px] font-extrabold text-gray-900 mb-3">House Rules / Tags</p>
                <ChipMulti options={RULE_OPTIONS} selected={houseRules} onToggle={toggleIn(setHouseRules)} />
              </div>
            </Card>
          </div>
        )}

        {/* ── STEP 3: Publish ── */}
        {step === 2 && (
          <div>
            <Card>
              <div className="p-6">
                <div className="mb-4">
                  <Label>Listing Title</Label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Bright 2 BHK in HSR" className={inp} />
                </div>
                <div>
                  <Label>Description</Label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the flat, the vibe, and what makes it special…"
                    rows={4} className={inp + " resize-none"} />
                </div>
              </div>
            </Card>

            {/* Photos — bulk upload straight from the gallery */}
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[14px] font-extrabold text-gray-900">Photos</p>
                  <span className="text-[11px] text-gray-400">{photoPreviews.length} added</span>
                </div>
                <p className="text-[12px] text-gray-400 mb-3">Add a few clear photos — you can select many at once from your gallery.</p>

                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-gray-200 rounded-xl px-4 py-7 text-center hover:border-red-300 hover:bg-red-50/40 transition-colors">
                    <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className="text-[13px] font-bold text-gray-700">Tap to upload photos</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Select multiple from your gallery · JPG, PNG, WEBP</p>
                  </div>
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
                </label>

                {photoPreviews.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {photoPreviews.map((src, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removePhoto(i)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[11px] leading-none flex items-center justify-center">×</button>
                        {i === 0 && <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-bold">COVER</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <p className="text-[14px] font-extrabold text-gray-900 mb-3">Listing Summary</p>
                <div className="space-y-2 text-[13px] text-gray-600">
                  <Row k="Property ID" v={propertyId} mono />
                  <Row k="Posted by" v={postedBy[0].toUpperCase() + postedBy.slice(1)} />
                  <Row k="Area" v={area || "—"} />
                  <Row k="Address" v={fullAddress || "—"} />
                  <Row k="Landmark" v={landmark || "—"} />
                  <Row k="Type" v={flatType} />
                  <Row k="Rent" v={rent ? `₹${Number(rent).toLocaleString("en-IN")}` : "—"} />
                  <Row k="Location pin" v={marker ? `${marker[0].toFixed(4)}, ${marker[1].toFixed(4)}` : "Not set"} />
                  <Row k="Amenities" v={amenities.length ? `${amenities.length} selected` : "—"} />
                  <Row k="Photos" v={photoPreviews.length ? `${photoPreviews.length} added` : "None"} />
                </div>
              </div>
            </Card>

            {errors.submit && (
              <div className="mb-4 p-4 rounded-xl text-[13px] font-medium border bg-red-50 text-red-700 border-red-200">
                {errors.submit}
              </div>
            )}

            <button type="button" onClick={handleSubmit} disabled={saving}
              className="w-full py-4 rounded-2xl text-[16px] font-bold text-white transition-opacity disabled:opacity-60"
              style={{ background: `linear-gradient(135deg,${BRAND_RED},#ef4444)` }}>
              {saving ? (uploadMsg || "Publishing & matching…") : "Publish Listing →"}
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          {step > 0
            ? <button type="button" onClick={back}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] font-bold text-gray-700 hover:bg-gray-50 transition-colors">
                ← Back
              </button>
            : <div />}
          {step < 2 && (
            <button type="button" onClick={next}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: `linear-gradient(135deg,${BRAND_RED},#ef4444)` }}>
              Continue →
            </button>
          )}
        </div>
      </main>
      <Footer />
    </PageShell>
  );
}

function Row({ k, v, mono }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="shrink-0">{k}</span>
      <span className={`font-semibold text-gray-900 text-right truncate ${mono ? "tracking-wider" : ""}`}>{v}</span>
    </div>
  );
}

const toMin = (hhmm) => {
  // Number("") is 0, so an empty <input type="time"> would otherwise read as
  // midnight and silently generate a full day of slots — demand real HH:MM.
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? "").trim());
  if (!m) return NaN;
  const h = Number(m[1]), min = Number(m[2]);
  return h > 23 || min > 59 ? NaN : h * 60 + min;
};
const toHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/**
 * property_visit_slots stores one timestamp per bookable slot (no end column),
 * so a "10:00-13:00" window is saved as the individual start times inside it.
 * That keeps seekers booking a precise time instead of a vague range.
 */
function buildTimes(from, to, stepMin) {
  const a = toMin(from), b = toMin(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !stepMin || b <= a) return [];
  const out = [];
  for (let t = a; t + stepMin <= b; t += stepMin) out.push(toHHMM(t));
  return out;
}
const fmtDateChip = (ymd) =>
  ymd ? new Date(`${ymd}T00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "";
const fmtTimeOnly = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }) : "";

const fmtSlot = (iso) =>
  iso ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) : "";

/**
 * Tenant "property dashboard" — shown after a tenant publishes. Leads at the top,
 * a per-property visit-slot editor, and the wallet-credit note.
 */
function PropertyLeadDashboard({ propertyId, listingTitle, leads = [], walletAmount, rewardEligible, onClose }) {
  const [slots, setSlots] = useState([]);
  const [fromT, setFromT] = useState("10:00");
  const [toT, setToT] = useState("13:00");
  const [every, setEvery] = useState(60);
  const [capacity, setCapacity] = useState(5);
  const [dates, setDates] = useState([]);
  const [dateDraft, setDateDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const loadSlots = async () => {
    try { setSlots(await fetchSlotsForProperty(propertyId)); } catch { /* ignore */ }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (propertyId) loadSlots(); }, [propertyId]);

  const times = useMemo(() => buildTimes(fromT, toT, every), [fromT, toT, every]);
  const willCreate = times.length * dates.length;
  const todayYMD = new Date().toISOString().slice(0, 10);

  const addDate = () => {
    if (!dateDraft) return;
    setDates((d) => (d.includes(dateDraft) ? d : [...d, dateDraft].sort()));
    setDateDraft("");
  };

  // One time window applied across every date the poster picked, then the form
  // resets so another window can be added on top.
  const addSlotGroup = async () => {
    setMsg({ type: "", text: "" });
    if (!times.length) { setMsg({ type: "err", text: "The end time needs to be later than the start time." }); return; }
    if (!dates.length) { setMsg({ type: "err", text: "Add at least one date for this time slot." }); return; }
    setBusy(true);
    let added = 0, skipped = 0;
    try {
      for (const d of dates) {
        for (const t of times) {
          try {
            await addVisitSlot(propertyId, new Date(`${d}T${t}`).toISOString(), capacity);
            added += 1;
          } catch (e) {
            // (property_id, slot_at) is unique - a time that already exists is
            // not a failure, just nothing to do.
            const m = String(e?.message || "").toLowerCase();
            if (m.includes("duplicate") || m.includes("unique")) skipped += 1;
            else throw e;
          }
        }
      }
      await loadSlots();
      setDates([]);
      setMsg({ type: "ok", text: `Added ${added} visit time${added === 1 ? "" : "s"}${skipped ? ` · ${skipped} already existed` : ""}. Add another time slot below if you like.` });
    } catch (e) {
      setMsg({ type: "err", text: e?.message?.includes("row-level") ? "This account can't add slots yet — our team will set them up when they call you." : (e?.message || "Could not add these times.") });
    } finally { setBusy(false); }
  };

  const grouped = useMemo(() => {
    const byDay = new Map();
    for (const s of slots) {
      const iso = s.slot_at || s.slotAt || s.when;
      if (!iso) continue;
      const d = new Date(iso);
      const key = d.toISOString().slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push({ ...s, _iso: iso, _t: d.getTime() });
    }
    return [...byDay.entries()]
      .map(([key, items]) => ({ key, items: items.sort((a, b) => a._t - b._t) }))
      .sort((a, b) => a.items[0]._t - b.items[0]._t);
  }, [slots]);

  const removeSlot = async (id) => {
    setBusy(true);
    try { await deleteVisitSlot(id); await loadSlots(); } catch { /* ignore */ } finally { setBusy(false); }
  };

  return (
    <>
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Property dashboard</p>
              <p className="text-[15px] font-extrabold text-gray-900 truncate">{listingTitle}</p>
            </div>
            <button type="button" onClick={onClose} className="shrink-0 text-[12px] font-bold text-gray-500 hover:text-gray-800">← Back to summary</button>
          </div>

          {/* Leads count */}
          <div className="rounded-2xl p-5 mb-2" style={{ background: "linear-gradient(135deg,#fff5f5,#fef2f2)", border: "1px solid #fbcfc4" }}>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: BRAND_RED }}>Leads</p>
            <div className="flex items-baseline gap-2">
              <span className="text-[34px] font-extrabold text-gray-900 leading-none">{leads.length}</span>
              <span className="text-[13px] text-gray-500">seeker{leads.length === 1 ? "" : "s"} matched to this home</span>
            </div>
          </div>
          {leads.length > 0 && (
            <div className="space-y-2 mt-3">
              {leads.map((m, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-gray-800 truncate">
                      {m.requirement?.email || m.requirement?.customer_name || m.requirement?.name || `Seeker #${String(m.requirement?.user_id || i + 1).slice(0, 6)}`}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">{(m.reasons || []).join(" · ") || "Requirement match"}</p>
                  </div>
                  {Number.isFinite(m.score) && (
                    <span className="shrink-0 ml-3 px-2.5 py-1 rounded-full text-[12px] font-extrabold text-white" style={{ background: m.score >= 80 ? "#16a34a" : m.score >= 60 ? BRAND_RED : "#e0a83b" }}>{m.score}%</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Visit times */}
      <Card>
        <div className="p-6">
          <p className="text-[14px] font-extrabold text-gray-900 mb-1">Visit times</p>
          <p className="text-[12px] text-gray-500 mb-4">Add the slots when seekers can come see this home. They'll be able to book these.</p>
          <div className="rounded-2xl border border-gray-200 p-4 sm:p-5">
            <p className="text-[12px] font-bold uppercase tracking-wide text-gray-400 mb-3">Add a time slot</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label>From</Label>
                <input type="time" value={fromT} onChange={(e) => setFromT(e.target.value)} className={inp} />
              </div>
              <div>
                <Label>To</Label>
                <input type="time" value={toT} onChange={(e) => setToT(e.target.value)} className={inp} />
              </div>
              <div>
                <Label>Each visit</Label>
                <select value={every} onChange={(e) => setEvery(Number(e.target.value))} className={inp}>
                  {[15, 30, 45, 60, 90, 120].map((n) => (
                    <option key={n} value={n}>{n < 60 ? `${n} min` : n === 60 ? "1 hour" : `${n / 60} hours`}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Seats</Label>
                <select value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className={inp}>
                  {[1, 2, 3, 4, 5, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <Label>Dates for this time slot</Label>
              <div className="flex gap-2">
                <input
                  type="date"
                  min={todayYMD}
                  value={dateDraft}
                  onChange={(e) => setDateDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDate(); } }}
                  className={inp}
                />
                <button type="button" onClick={addDate} disabled={!dateDraft}
                  className="h-[46px] shrink-0 px-4 rounded-xl text-[13px] font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  + Add date
                </button>
              </div>

              {dates.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {dates.map((d) => (
                    <span key={d} className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full text-[12px] font-bold bg-gray-100 text-gray-700">
                      {fmtDateChip(d)}
                      <button type="button" onClick={() => setDates((x) => x.filter((v) => v !== d))}
                        aria-label={`Remove ${fmtDateChip(d)}`}
                        className="w-4 h-4 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-900">×</button>
                    </span>
                  ))}
                  <button type="button" onClick={() => setDates([])} className="text-[12px] font-bold text-gray-400 hover:text-gray-600 px-1">Clear all</button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100">
              <p className="text-[12px] text-gray-500">
                {times.length === 0
                  ? "Set an end time later than the start time."
                  : dates.length === 0
                    ? <>{times.length} visit{times.length === 1 ? "" : "s"} per day — add the dates to use them on.</>
                    : <>Creates <span className="font-extrabold text-gray-800">{willCreate}</span> visit time{willCreate === 1 ? "" : "s"} · {times[0]}–{toT} on {dates.length} date{dates.length === 1 ? "" : "s"}</>}
              </p>
              <button type="button" onClick={addSlotGroup} disabled={busy || !willCreate}
                className="h-[46px] px-5 rounded-xl text-[13px] font-bold text-white disabled:opacity-60"
                style={{ background: `linear-gradient(135deg,${BRAND_RED},#ef4444)` }}>
                {busy ? "Adding…" : "Add these times"}
              </button>
            </div>
          </div>
          {msg.text && (
            <p className={`text-[12px] mt-2 font-semibold ${msg.type === "ok" ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>
          )}
          <div className="mt-5">
            {slots.length === 0 ? (
              <p className="text-[12px] text-gray-400">No visit times added yet.</p>
            ) : (
              <>
                <p className="text-[12px] font-bold uppercase tracking-wide text-gray-400 mb-2">
                  Added times ({slots.length})
                </p>
                <div className="space-y-3">
                  {grouped.map((g) => (
                    <div key={g.key} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <p className="text-[12px] font-extrabold text-gray-700 mb-2">{fmtDateChip(g.key)}</p>
                      <div className="flex flex-wrap gap-2">
                        {g.items.map((s) => (
                          <span key={s.id} className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-white border border-gray-200 text-[12px] font-bold text-gray-800">
                            {fmtTimeOnly(s._iso)}
                            <button type="button" onClick={() => removeSlot(s.id)} disabled={busy}
                              aria-label={`Remove ${fmtSlot(s._iso)}`}
                              className="w-4 h-4 rounded-full flex items-center justify-center text-gray-400 hover:bg-red-100 hover:text-red-600 disabled:opacity-50">×</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Wallet credit note */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12" /><path d="M16 12h.01" /></svg>
          <p className="text-[13px] leading-relaxed" style={{ color: "#065f46" }}>
            {rewardEligible
              ? <>Your <span className="font-extrabold">{fmtWallet(walletAmount)}</span> reward will be <span className="font-semibold">credited to your wallet once this property is sold through our on-ground executive.</span></>
              : <>Cash rewards apply to 1 RK / 1 BHK / room listings. When this home is sold through our on-ground executive, any applicable reward is credited to your wallet.</>}
          </p>
        </div>
      </div>

      <button type="button" onClick={onClose}
        className="w-full py-3.5 rounded-2xl text-[14px] font-bold text-gray-700 border border-gray-200 bg-white">
        Back to summary
      </button>
    </>
  );
}

/**
 * Broker upsell — a ₹1,999/mo guaranteed-leads plan. No payment gateway is wired yet,
 * so the CTA registers interest; the team activates and collects payment on confirmation.
 */
function BrokerPlanCard() {
  const [requested, setRequested] = useState(false);
  return (
    <Card className="!mb-4" >
      <div className="p-6">
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <p className="text-[15px] font-extrabold text-gray-900">Guaranteed Leads plan</p>
          <span className="text-[20px] font-extrabold text-gray-900">₹1,999<span className="text-[12px] font-semibold text-gray-400">/month</span></span>
        </div>
        <ul className="text-[13px] text-gray-600 leading-relaxed mb-4 space-y-1.5 mt-2">
          <li className="flex gap-2"><span style={{ color: "#16a34a" }}>✓</span> <span><span className="font-semibold text-gray-800">100 leads guaranteed</span> every month.</span></li>
          <li className="flex gap-2"><span style={{ color: "#16a34a" }}>✓</span> <span>If we don't deliver 100 leads, your <span className="font-semibold text-gray-800">full amount is refunded</span>.</span></li>
          <li className="flex gap-2"><span style={{ color: "#16a34a" }}>✓</span> <span>Priority matching across all your listed properties.</span></li>
        </ul>
        {requested ? (
          <div className="p-3 rounded-xl text-[13px] font-semibold" style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0" }}>
            Requested — our team will confirm your Guaranteed Leads plan and set up payment.
          </div>
        ) : (
          <button type="button" onClick={() => setRequested(true)}
            className="w-full py-3 rounded-xl text-[14px] font-bold text-white"
            style={{ background: `linear-gradient(135deg,${BRAND_RED},#ef4444)` }}>
            Get the ₹1,999 Guaranteed Leads plan
          </button>
        )}
        <p className="text-[11px] text-gray-400 mt-2">Billed monthly · cancel anytime · 100-lead guarantee or full refund.</p>
      </div>
    </Card>
  );
}
