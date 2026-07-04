// src/components/sections/SmartMatch.jsx
// Interactive questionnaire: Area -> Budget -> Timeline -> Results.
// Follows user rule #5: "Find the Right Home — Without the Guesswork".

import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { ChevronLeft, ChevronRight, MapPin, Search, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { getListings, FILTER_OPTIONS } from "../../lib/store";
import { isFirebaseConfigured } from "../../lib/firebase";
import { getListingsData, isListingPubliclyVisible } from "../../lib/firestoreStore";
import PropertyModal from "../PropertyModal";
import Tilt3D from "../ui/Tilt3D";

const EASE = [0.22, 1, 0.36, 1];

const POPULAR_AREAS = ["Indiranagar", "HSR Layout", "Koramangala", "Bellandur", "Whitefield", "Mahadevpura", "Jayanagar", "Hebbal"];
const BUDGET_OPTIONS = [
  { label: "₹10k - ₹25k", min: 10000, max: 25000 },
  { label: "₹25k - ₹50k", min: 25000, max: 50000 },
  { label: "₹50k - ₹75k", min: 50000, max: 75000 },
  { label: "₹75k - ₹1.5L+", min: 75000, max: 200000 },
];
const TIMELINE_OPTIONS = ["Immediate", "Within 15 days", "Within 30 days", "Flexible"];

function localityFromListing(listing) {
  return String(listing.address || "").split(",")[0].trim() || "Bengaluru";
}

/** Prefer primary image; many Firestore rows only populate `images[]` or alternate keys. */
function listingImageUrl(listing) {
  const keys = ["image", "coverImage", "thumbnail", "photo", "photoUrl", "mainImage", "heroImage"];
  for (const k of keys) {
    const u = String(listing?.[k] || "").trim();
    if (u) return u;
  }
  const imgs = listing?.images;
  if (Array.isArray(imgs)) {
    const first = imgs.map((x) => String(x || "").trim()).find(Boolean);
    if (first) return first;
  }
  return "";
}

/**
 * `/map` href from Smart Match selections — aligned with MapView URL parsing:
 * `locality`, `minRent`, `maxRent`, `availability`, optional `openFilters=1`.
 */
export function buildSmartMatchMapHref(selections, { openFilters = false } = {}) {
  const params = new URLSearchParams();
  const area = String(selections?.area || "").trim();
  if (area && area !== "Flexible") {
    params.set("locality", area);
  }
  const b = selections?.budget;
  if (b && Number.isFinite(Number(b.min)) && Number.isFinite(Number(b.max))) {
    params.set("minRent", String(b.min));
    params.set("maxRent", String(b.max));
  }
  const timeline = String(selections?.timeline || "").trim();
  if (timeline && timeline !== "Flexible" && FILTER_OPTIONS.availability.includes(timeline)) {
    params.set("availability", timeline);
  }
  if (openFilters) params.set("openFilters", "1");
  const qs = params.toString();
  return qs ? `/map?${qs}` : openFilters ? "/map?openFilters=1" : "/map";
}

function isBangaloreListing(listing) {
  const t = `${listing.address || ""} ${listing.location || ""}`.toLowerCase();
  if (t.includes("bangalore") || t.includes("bengaluru")) return true;
  const loc = localityFromListing(listing).toLowerCase();
  if (POPULAR_AREAS.some((a) => loc === a.toLowerCase() || loc.includes(a.toLowerCase()))) return true;
  const lat = Number(listing.lat);
  const lng = Number(listing.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= 12.72 && lat <= 13.22 && lng >= 77.38 && lng <= 77.82) return true;
  return false;
}

function PropertyCard({ listing, delay, onClick }) {
  const { ref, inView } = useInView({ threshold: 0.12, triggerOnce: true });
  const [imgFailed, setImgFailed] = useState(false);
  const loc = localityFromListing(listing);
  const bhkCompact = String(listing.bhk || "").replace(/\s+/g, "");
  const imgSrc = listingImageUrl(listing);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: EASE }}
      className="snap-start flex-shrink-0 w-[260px] sm:w-[288px] md:w-full min-w-0"
    >
      <Tilt3D intensity={5} scale={1.02} className="h-full rounded-2xl">
        <button
          type="button"
          onClick={onClick}
          className="
            w-full text-left rounded-2xl border border-rose-100/80
            bg-white overflow-hidden
            shadow-[0_4px_20px_rgba(15,23,42,0.08)]
            hover:shadow-[0_12px_36px_rgba(185,28,28,0.12)]
            hover:border-rose-200/90
            transition-all duration-300
          "
        >
          <div className="relative w-full h-[180px] overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
            {imgSrc && !imgFailed ? (
              <img
                src={imgSrc}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm font-semibold px-4 text-center">
                Photo coming soon
              </div>
            )}
            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg text-[11px] font-bold text-rose-600 shadow-sm border border-rose-100">
              {listing.availability || "Available"}
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-1.5 text-rose-600 mb-1">
              <MapPin size={12} fill="currentColor" fillOpacity={0.2} />
              <span className="text-[11px] font-bold uppercase tracking-wider">{loc}</span>
            </div>
            <div className="text-[16px] font-extrabold text-slate-900 mb-1">{bhkCompact} {listing.propertyType || "Apartment"}</div>
            <div className="text-[15px] font-bold text-emerald-600">{listing.price || `₹ ${listing.monthlyRent}`}</div>
          </div>
        </button>
      </Tilt3D>
    </motion.div>
  );
}

export default function SmartMatch() {
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const [step, setStep] = useState(0); // 0: Start, 1: Area, 2: Budget, 3: Timeline, 4: Results
  const [selections, setSelections] = useState({ area: "", budget: null, timeline: "" });
  const [listings, setListings] = useState([]);
  const [selectedListing, setSelectedListing] = useState(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const rows = isFirebaseConfigured ? await getListingsData() : [];
        if (alive) setListings(rows.filter(isListingPubliclyVisible).filter(isBangaloreListing));
      } catch {
        if (alive) setListings([]);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const filteredMatches = useMemo(() => {
    if (step < 4) return [];
    return listings.filter(l => {
      const matchArea = selections.area === "Flexible" || !selections.area || localityFromListing(l).toLowerCase().includes(selections.area.toLowerCase());
      const rent = l.monthlyRent || 0;
      const matchBudget = !selections.budget || (rent >= selections.budget.min && rent <= selections.budget.max);
      const matchTimeline = selections.timeline === "Flexible" || !selections.timeline || (l.availability || "").toLowerCase().includes(selections.timeline.toLowerCase());
      return matchArea && matchBudget && matchTimeline;
    }).slice(0, 8);
  }, [listings, step, selections]);

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const reset = () => {
    setStep(0);
    setSelections({ area: "", budget: null, timeline: "" });
  };

  const scrollBy = (delta) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <section id="smart-match" className="py-24 sm:py-32 bg-white overflow-hidden relative">
      {/* Background Accents */}
      <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-rose-50/50 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-1/4 h-1/4 bg-blue-50/50 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-black text-slate-900 mb-4"
          >
            Find the <span className="text-rose-600">Right Home</span> — Without the Guesswork
          </motion.h2>
          <p className="text-slate-500 max-w-2xl mx-auto">
            Skip the endless scrolling. Tell us what you need, and we'll match you with the perfect home in Bangalore.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xl shadow-slate-200/50 min-h-[400px] flex flex-col">
            
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div 
                  key="step0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col items-center justify-center flex-1 text-center"
                >
                  <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mb-6">
                    <Search className="text-rose-600" size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">Ready to find your match?</h3>
                  <p className="text-slate-500 mb-8 max-w-sm">3 quick questions to narrow down the best properties for you.</p>
                  <button 
                    onClick={nextStep}
                    className="bg-rose-600 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                  >
                    Get Started <ArrowRight size={20} />
                  </button>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col flex-1"
                >
                  <div className="flex items-center gap-2 text-rose-600 font-bold mb-6">
                    <div className="w-8 h-8 rounded-full border-2 border-rose-600 flex items-center justify-center text-sm">1</div>
                    <span>Select Preferred Area</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[...POPULAR_AREAS, "Flexible"].map(area => (
                      <button
                        key={area}
                        onClick={() => { setSelections(p => ({...p, area})); nextStep(); }}
                        className={`p-4 rounded-xl border-2 text-sm font-bold transition-all ${selections.area === area ? 'border-rose-600 bg-rose-50 text-rose-600' : 'border-slate-200 bg-white text-slate-600 hover:border-rose-200'}`}
                      >
                        {area}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div 
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col flex-1"
                >
                  <div className="flex items-center gap-2 text-rose-600 font-bold mb-6">
                    <button onClick={prevStep} className="mr-2 text-slate-400 hover:text-slate-600"><ArrowLeft size={20} /></button>
                    <div className="w-8 h-8 rounded-full border-2 border-rose-600 flex items-center justify-center text-sm">2</div>
                    <span>Monthly Budget</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {BUDGET_OPTIONS.map(opt => (
                      <button
                        key={opt.label}
                        onClick={() => { setSelections(p => ({...p, budget: opt})); nextStep(); }}
                        className={`p-6 rounded-2xl border-2 text-lg font-bold transition-all ${selections.budget?.label === opt.label ? 'border-rose-600 bg-rose-50 text-rose-600' : 'border-slate-200 bg-white text-slate-600 hover:border-rose-200'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div 
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col flex-1"
                >
                  <div className="flex items-center gap-2 text-rose-600 font-bold mb-6">
                    <button onClick={prevStep} className="mr-2 text-slate-400 hover:text-slate-600"><ArrowLeft size={20} /></button>
                    <div className="w-8 h-8 rounded-full border-2 border-rose-600 flex items-center justify-center text-sm">3</div>
                    <span>When do you want to move?</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {TIMELINE_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        onClick={() => { setSelections(p => ({...p, timeline: opt})); nextStep(); }}
                        className={`p-6 rounded-2xl border-2 text-lg font-bold transition-all ${selections.timeline === opt ? 'border-rose-600 bg-rose-50 text-rose-600' : 'border-slate-200 bg-white text-slate-600 hover:border-rose-200'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div 
                  key="step4"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col flex-1"
                >
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2 text-emerald-600 font-bold">
                      <CheckCircle2 size={24} />
                      <span>{filteredMatches.length} Matches Found</span>
                    </div>
                    <button onClick={reset} className="text-slate-400 hover:text-rose-600 text-sm font-bold flex items-center gap-1">
                      <ArrowLeft size={16} /> Reset
                    </button>
                  </div>

                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex gap-2">
                        <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-full text-xs font-bold">{selections.area}</span>
                        <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-xs font-bold">{selections.budget?.label}</span>
                      </div>
                      <div className="flex gap-2 md:hidden">
                        <button type="button" onClick={() => scrollBy(-300)} className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center hover:bg-white transition-colors"><ChevronLeft size={20} /></button>
                        <button type="button" onClick={() => scrollBy(300)} className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center hover:bg-white transition-colors"><ChevronRight size={20} /></button>
                      </div>
                    </div>

                    <div
                      ref={scrollRef}
                      className="flex md:grid md:grid-cols-2 gap-4 overflow-x-auto md:overflow-x-visible scroll-smooth pb-4 scrollbar-hide snap-x md:snap-none"
                    >
                      {filteredMatches.length > 0 ? (
                        filteredMatches.map((l, i) => (
                          <PropertyCard 
                            key={l.id} 
                            listing={l} 
                            delay={i * 0.1} 
                            onClick={() => setSelectedListing(l)} 
                          />
                        ))
                      ) : (
                        <div className="w-full py-12 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
                          <p className="text-slate-400 font-medium mb-4">No perfect matches for these specific filters.</p>
                          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <button
                              type="button"
                              onClick={() => navigate(buildSmartMatchMapHref(selections))}
                              className="bg-rose-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-rose-700"
                            >
                              Search map with these choices
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate("/map")}
                              className="bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold"
                            >
                              Explore all listings
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col items-center justify-center gap-3">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full flex-wrap">
                      <button
                        type="button"
                        onClick={() => navigate("/contact")}
                        className="inline-flex items-center gap-2 rounded-2xl border-2 border-rose-600 bg-white px-6 py-3 text-sm font-bold text-rose-600 shadow-sm transition-colors hover:bg-rose-50"
                      >
                        Talk to a consultant
                        <ArrowRight size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(buildSmartMatchMapHref(selections))}
                        className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rose-200 transition-colors hover:bg-rose-700"
                      >
                        Open matches on map
                        <ArrowRight size={18} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(buildSmartMatchMapHref(selections, { openFilters: true }))}
                      className="text-sm font-bold text-slate-600 underline decoration-rose-300 decoration-2 underline-offset-4 hover:text-rose-700"
                    >
                      Same search, show filter panel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>
      </div>

      {selectedListing && (
        <PropertyModal
          property={selectedListing}
          listings={listings}
          onSelectListing={(l) => setSelectedListing(l)}
          onClose={() => setSelectedListing(null)}
        />
      )}
    </section>
  );
}
