import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { uploadListingFiles } from "../lib/firestoreStore";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import PageShell from "../components/layout/PageShell";

const BRAND_RED = "#ff3131";
const AREAS = [
  "Indiranagar","Koramangala","HSR Layout","Bellandur","Whitefield","Marathalli",
  "BTM Layout","Hebbal","Electronic City","Hoodi","Sarjapur Road","Banaswadi",
  "Frazer Town","Jayanagar","JP Nagar","Banashankari","Rajajinagar","Malleshwaram",
  "Yelahanka","Thanisandra","Hennur","Kengeri","Bommanahalli","Domlur",
  "Mahadevapura","KR Puram","Brookefield","Varthur","Other",
];
const AMENITY_OPTIONS = [
  ["ac","AC"],["wifi","WiFi"],["parking","Parking"],["tv","TV"],
  ["refrigerator","Fridge"],["washing_machine","Washing Machine"],
  ["microwave","Microwave"],["sofa","Sofa"],["dining_table","Dining Table"],
];
const RULE_OPTIONS = [
  "No Smoking","No Pets","No Alcohol","Vegetarians Only",
  "Working Professionals Only","No Brokerage","Fully Furnished",
];

function slugify(t) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

const inp = "w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-[14px] text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-red-400 focus:ring-2 focus:ring-red-100";

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

const STEPS = ["The Essentials", "Describe Your Space", "Photos & Publish"];

export default function ListMyFlat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type:"", text:"" });
  const [errors, setErrors] = useState({});

  // Step 1
  const [listingType, setListingType] = useState("room"); // "room" | "flat"
  const [area, setArea] = useState("");
  const [locationDetails, setLocationDetails] = useState("");
  const [rent, setRent] = useState("");
  const [deposit, setDeposit] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");
  const [isAgent, setIsAgent] = useState(false);
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [maxFlatmates, setMaxFlatmates] = useState(1);
  const [gender, setGender] = useState("any");

  // Step 2
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isFurnished, setIsFurnished] = useState(true);
  const [amenities, setAmenities] = useState({});
  const [houseRules, setHouseRules] = useState({});
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  // Step 3
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);

  useEffect(() => {
    if (!user) navigate(`/login?next=${encodeURIComponent("/list-my-flat")}`, { replace: true });
  }, [user, navigate]);

  // Auto-generate title whenever area or listing type changes
  useEffect(() => {
    if (area) {
      const prefix = listingType === "flat" ? "Flat Available" : "Flatmate Wanted";
      setTitle(`${prefix} in ${area}`);
    }
  }, [area, listingType]);

  const toggleAmenity = k => setAmenities(p => ({ ...p, [k]: !p[k] }));
  const toggleRule   = k => setHouseRules(p => ({ ...p, [k]: !p[k] }));

  const handlePhotos = (e) => {
    const files = Array.from(e.target.files);
    setPhotoFiles(p => [...p, ...files]);
    setPhotoPreviews(p => [...p, ...files.map(f => URL.createObjectURL(f))]);
  };
  const removePhoto = i => {
    setPhotoFiles(p => p.filter((_,idx) => idx !== i));
    setPhotoPreviews(p => p.filter((_,idx) => idx !== i));
  };

  const validateStep = () => {
    const e = {};
    if (step === 0) {
      if (!area)  e.area = "Please select an area";
      if (!rent)  e.rent = "Please enter rent";
    }
    if (step === 1) {
      if (!title.trim()) e.title = "Please enter a title";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep()) setStep(s => Math.min(s+1, 2)); };
  const back = () => { setErrors({}); setStep(s => Math.max(s-1, 0)); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg({ type:"", text:"" });
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const slug = `${slugify((title||"listing").slice(0,40))}-${Math.floor(Math.random()*9000000+1000000)}`;
      let images = [];
      if (photoFiles.length) images = await uploadListingFiles(photoFiles, id);
      const latN = parseFloat(lat) || 12.9716;
      const lngN = parseFloat(lng) || 77.5946;

      await addDoc(collection(db, "listings"), {
        id,
        slug,
        display_title:       title.trim() || `Flatmate Wanted in ${area}`,
        title:               title.trim() || `Flatmate Wanted in ${area}`,
        description:         description.trim(),
        monthly_rent:        String(Number(rent) || 0),
        security_deposit:    deposit ? String(Number(deposit)) : "0",
        bedroom_count:       Number(bedrooms),
        bathroom_count:      Number(bathrooms),
        is_furnished:        isFurnished,
        amenities,
        house_rules:         Object.fromEntries(Object.entries(houseRules).filter(([,v])=>v)),
        gender_preference:   gender,
        images,
        cover_image_url:     images[0] || "",
        totalImageCount:     images.length,
        area,
        city:                "bengaluru",
        location_details:    locationDetails.trim(),
        owner_name:          user.name || user.email?.split("@")[0] || "Owner",
        owner_picture:       "",
        is_verified:         false,
        view_count:          0,
        nearby_localities:   [],
        created_at:          now,
        bumped_at:           now,
        max_flatmates:       Number(maxFlatmates),
        current_flatmates:   0,
        precise_coordinates: { x: lngN, y: latN },
        listing_type:        listingType,
        is_agent:            isAgent,
        available_from:      availableFrom || null,
        owner_uid:           user.uid,
        owner_email:         user.email,
        sellerEmail:         user.email?.toLowerCase().trim(),
        marketStatus:        "published",
        updatedAt:           serverTimestamp(),
      });

      setMsg({ type:"ok", text:"Your listing is live! Redirecting…" });
      setTimeout(() => navigate("/new-listings"), 2000);
    } catch (err) {
      console.error(err);
      setMsg({ type:"err", text: err?.message || "Something went wrong." });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <PageShell variant="marketing" overlayOnly className="antialiased" style={{ background:"#f0ebe3" }}>
      <Navbar variant="marketing" />

      <main className="max-w-2xl mx-auto px-4 pb-16 pt-8">

        {/* Step tabs */}
        <div className="flex items-center rounded-full p-1 mb-8" style={{ background:"#1c1917" }}>
          {STEPS.map((s,i) => (
            <button key={s} type="button"
              onClick={() => i < step && setStep(i)}
              className="flex-1 py-2.5 rounded-full text-[13px] font-bold transition-all"
              style={{ background: i===step?"white":"transparent", color: i===step?"#1c1917":"rgba(255,255,255,0.5)", cursor: i<step?"pointer":"default" }}>
              {s}
            </button>
          ))}
        </div>

        {/* ── STEP 1: The Essentials ── */}
        {step === 0 && (
          <div>
            <Card>
              <div className="p-6">
                <p className="text-[15px] font-extrabold text-gray-900 mb-4">What are you listing?</p>
                <div className="grid grid-cols-2 gap-3">
                  {[["room","Vacant Room","Looking for a flatmate"],["flat","Entire Flat","Rent out the whole property"]].map(([v,label,sub]) => (
                    <button key={v} type="button" onClick={() => setListingType(v)}
                      className="text-left p-4 rounded-xl border-2 transition-all"
                      style={{ borderColor: listingType===v ? BRAND_RED : "#e2e8f0", background: listingType===v ? "#fff5f5" : "white" }}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                          style={{ borderColor: listingType===v ? BRAND_RED : "#d1d5db" }}>
                          {listingType===v && <div className="w-2 h-2 rounded-full" style={{ background:BRAND_RED }} />}
                        </div>
                        <span className="text-[14px] font-extrabold text-gray-900">{label}</span>
                      </div>
                      <p className="text-[12px] text-gray-500 ml-6">{sub}</p>
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6 grid grid-cols-2 gap-4">
                <div>
                  <Label>City</Label>
                  <input value="Bengaluru" disabled className={inp + " bg-gray-50 cursor-not-allowed"} />
                </div>
                <div>
                  <Label required>Area</Label>
                  <select value={area} onChange={e => setArea(e.target.value)} className={inp}>
                    <option value="">Koramangala, BTM Layout…</option>
                    {AREAS.map(a => <option key={a}>{a}</option>)}
                  </select>
                  {errors.area && <p className="text-[11px] text-red-500 mt-1 font-semibold">{errors.area}</p>}
                </div>
                <div className="col-span-2">
                  <Label>Precise / Nearby Address</Label>
                  <input value={locationDetails} onChange={e => setLocationDetails(e.target.value)}
                    placeholder="e.g., Near Forum Mall, 100 Feet Road" className={inp} />
                </div>
                <div>
                  <Label required>Monthly Rent (₹)</Label>
                  <input type="number" value={rent} onChange={e => setRent(e.target.value)} placeholder="25,000" min="0" className={inp} />
                  {errors.rent && <p className="text-[11px] text-red-500 mt-1 font-semibold">{errors.rent}</p>}
                </div>
                <div>
                  <Label>Security Deposit</Label>
                  <input type="number" value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="50,000" min="0" className={inp} />
                </div>
                <div>
                  <Label>Available From</Label>
                  <input type="date" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)} className={inp} />
                </div>
                <div>
                  <Label>Looking For</Label>
                  <select value={gender} onChange={e => setGender(e.target.value)} className={inp}>
                    <option value="any">Co-ed / Any</option>
                    <option value="female">Girls Only</option>
                    <option value="male">Boys Only</option>
                  </select>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <p className="text-[14px] font-extrabold text-gray-900 mb-3">Are you an Agent/Broker?</p>
                {[["false","No, I'm the owner/existing tenant"],["true","Yes, I'm an agent/broker"]].map(([v,label]) => (
                  <button key={v} type="button" onClick={() => setIsAgent(v==="true")}
                    className="w-full flex items-center gap-3 p-3 rounded-xl mb-2 text-left border transition-all"
                    style={{ borderColor: String(isAgent)===v ? BRAND_RED : "#e2e8f0", background: String(isAgent)===v ? "#fff5f5" : "white" }}>
                    <div className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                      style={{ borderColor: String(isAgent)===v ? BRAND_RED : "#d1d5db" }}>
                      {String(isAgent)===v && <div className="w-2 h-2 rounded-full" style={{ background:BRAND_RED }} />}
                    </div>
                    <span className="text-[13px] font-medium text-gray-700">{label}</span>
                  </button>
                ))}
                <p className="text-[11px] text-gray-400 mt-1">Being transparent builds trust with renters</p>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <p className="text-[14px] font-extrabold text-gray-900 mb-3">Your flat size <span className="text-red-500">*</span></p>
                <div className="flex gap-2 flex-wrap mb-4">
                  {[1,2,3,4].map(n => (
                    <button key={n} type="button" onClick={() => setBedrooms(n)}
                      className="px-5 py-2 rounded-xl text-[13px] font-bold border-2 transition-all"
                      style={{ borderColor: bedrooms===n ? BRAND_RED : "#e2e8f0", background: bedrooms===n ? BRAND_RED : "white", color: bedrooms===n ? "white" : "#374151" }}>
                      {n === 4 ? "4+ BHK" : `${n} BHK`}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Bathrooms</Label>
                    <select value={bathrooms} onChange={e => setBathrooms(Number(e.target.value))} className={inp}>
                      {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Max Flatmates Allowed</Label>
                    <select value={maxFlatmates} onChange={e => setMaxFlatmates(Number(e.target.value))} className={inp}>
                      {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ── STEP 2: Describe Your Space ── */}
        {step === 1 && (
          <div>
            <Card>
              <div className="p-6">
                <div className="mb-4">
                  <Label required>Listing Title</Label>
                  <input value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Flatmate Wanted in Koramangala" className={inp} />
                  {errors.title && <p className="text-[11px] text-red-500 mt-1 font-semibold">{errors.title}</p>}
                </div>
                <div>
                  <Label>Description</Label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="Describe the flat, the vibe, what you're looking for in a flatmate…"
                    rows={4} className={inp + " resize-none"} />
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <p className="text-[14px] font-extrabold text-gray-900 mb-3">Furnishing</p>
                <div className="flex gap-2">
                  {[["true","Fully Furnished"],["false","Unfurnished"]].map(([v,l]) => (
                    <Chip key={v} label={l} active={String(isFurnished)===v} onClick={() => setIsFurnished(v==="true")} />
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <p className="text-[14px] font-extrabold text-gray-900 mb-3">Amenities</p>
                <div className="flex flex-wrap gap-2">
                  {AMENITY_OPTIONS.map(([key,label]) => (
                    <Chip key={key} label={label} active={!!amenities[key]} onClick={() => toggleAmenity(key)} />
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <p className="text-[14px] font-extrabold text-gray-900 mb-3">House Rules / Tags</p>
                <div className="flex flex-wrap gap-2">
                  {RULE_OPTIONS.map(rule => (
                    <Chip key={rule} label={rule} active={!!houseRules[rule]} onClick={() => toggleRule(rule)} />
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <p className="text-[14px] font-extrabold text-gray-900 mb-1">Map Coordinates <span className="text-[12px] font-normal text-gray-400">(optional — helps renters find you on the map)</span></p>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <Label>Latitude</Label>
                    <input type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} placeholder="12.9716" className={inp} />
                  </div>
                  <div>
                    <Label>Longitude</Label>
                    <input type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} placeholder="77.5946" className={inp} />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ── STEP 3: Photos & Publish ── */}
        {step === 2 && (
          <div>
            <Card>
              <div className="p-6">
                <p className="text-[15px] font-extrabold text-gray-900 mb-1">Upload Photos</p>
                <p className="text-[12px] text-gray-400 mb-4">Good photos get 3× more enquiries. Add at least 3.</p>
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-gray-50 hover:border-red-300 hover:bg-red-50 transition-all">
                    <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className="text-[14px] font-semibold text-gray-600">Click to upload photos</p>
                    <p className="text-[12px] text-gray-400 mt-1">JPG, PNG, WEBP — multiple files</p>
                  </div>
                  <input type="file" accept="image/*" multiple onChange={handlePhotos} className="hidden" />
                </label>
                {photoPreviews.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-4">
                    {photoPreviews.map((src,i) => (
                      <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200">
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removePhoto(i)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center border-none cursor-pointer">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Summary */}
            <Card>
              <div className="p-6">
                <p className="text-[14px] font-extrabold text-gray-900 mb-3">Listing Summary</p>
                <div className="space-y-2 text-[13px] text-gray-600">
                  <div className="flex justify-between"><span>Type</span><span className="font-semibold text-gray-900">{listingType === "room" ? "Vacant Room" : "Entire Flat"}</span></div>
                  <div className="flex justify-between"><span>Area</span><span className="font-semibold text-gray-900">{area || "—"}</span></div>
                  <div className="flex justify-between"><span>Rent</span><span className="font-semibold text-gray-900">₹{rent ? Number(rent).toLocaleString("en-IN") : "—"}</span></div>
                  <div className="flex justify-between"><span>Size</span><span className="font-semibold text-gray-900">{bedrooms} BHK</span></div>
                  <div className="flex justify-between"><span>For</span><span className="font-semibold text-gray-900 capitalize">{gender === "any" ? "Co-ed" : gender === "female" ? "Girls Only" : "Boys Only"}</span></div>
                  <div className="flex justify-between"><span>Photos</span><span className="font-semibold text-gray-900">{photoPreviews.length}</span></div>
                </div>
              </div>
            </Card>

            {msg.text && (
              <div className={`mb-4 p-4 rounded-xl text-[13px] font-medium border ${msg.type==="ok"?"bg-green-50 text-green-800 border-green-200":"bg-red-50 text-red-700 border-red-200"}`}>
                {msg.text}
              </div>
            )}

            <button type="button" onClick={handleSubmit} disabled={saving}
              className="w-full py-4 rounded-2xl text-[16px] font-bold text-white transition-opacity disabled:opacity-60"
              style={{ background:`linear-gradient(135deg,${BRAND_RED},#ef4444)` }}>
              {saving ? "Publishing your listing…" : "Publish Listing →"}
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
            : <div />
          }
          {step < 2 && (
            <button type="button" onClick={next}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-bold text-white transition-opacity hover:opacity-90"
              style={{ background:`linear-gradient(135deg,${BRAND_RED},#ef4444)` }}>
              Continue →
            </button>
          )}
        </div>

      </main>
      <Footer />
    </PageShell>
  );
}
