import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import PageShell from "../components/layout/PageShell";
import { getListings } from "../lib/store";
import PropertyModal from "../components/PropertyModal";
import { isFirebaseConfigured } from "../lib/firebase";
import { getListingsData, isListingPubliclyVisible } from "../lib/firestoreStore";
import SmartImage from "../components/SmartImage";
import { motion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1];

const CATEGORY_CHIPS = [
  { label: "Apartments", emoji: "🏢" },
  { label: "Independent Houses", emoji: "🏡" },
  { label: "Family Friendly", emoji: "👨‍👩‍👧" },
  { label: "Immediate Move-In", emoji: "⚡" },
];

export default function HomeV2() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [viewingProperty, setViewingProperty] = useState(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const data = isFirebaseConfigured ? await getListingsData({ limitCount: 12 }) : getListings().slice(0, 12);
        if (alive) setListings(data.filter(isListingPubliclyVisible));
      } catch {
        if (alive) setListings(getListings().slice(0, 12).filter(isListingPubliclyVisible));
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const goMap = () => navigate("/map?openFilters=1");

  return (
    <PageShell variant="marketing" overlayOnly>
      <Navbar variant="marketing" />

      <main className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-8 py-8 pb-16">

        {/* ── Hero Search ──────────────────────────────────────────── */}
        <section className="mb-8">
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="text-[26px] sm:text-[32px] font-bold text-[#222222] mb-5 leading-tight"
          >
            Find your next home in Bengaluru
          </motion.h1>

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
            className="flex items-center rounded-full border border-[#dddddd] h-16 px-2 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.12)] transition-shadow"
          >
            <button
              type="button"
              onClick={goMap}
              className="flex-1 px-4 border-r border-[#dddddd] text-left bg-transparent outline-none"
            >
              <div className="text-[11px] font-bold text-[#222222]">Where</div>
              <div className="text-[13px] text-[#6a6a6a] mt-0.5">Indiranagar, HSR, Whitefield…</div>
            </button>
            <button
              type="button"
              onClick={goMap}
              className="flex-1 px-4 border-r border-[#dddddd] text-left bg-transparent outline-none"
            >
              <div className="text-[11px] font-bold text-[#222222]">When</div>
              <div className="text-[13px] text-[#6a6a6a] mt-0.5">Add move-in date</div>
            </button>
            <button
              type="button"
              onClick={goMap}
              className="flex-1 px-4 text-left bg-transparent outline-none"
            >
              <div className="text-[11px] font-bold text-[#222222]">Who</div>
              <div className="text-[13px] text-[#6a6a6a] mt-0.5">Family, bachelor, company</div>
            </button>
            <button
              type="button"
              onClick={goMap}
              aria-label="Search on map"
              className="w-12 h-12 rounded-full bg-[#ff385c] text-white text-xl flex items-center justify-center hover:bg-[#e00b41] transition-colors shrink-0 mr-0.5"
            >
              ⌕
            </button>
          </motion.div>
        </section>

        {/* ── Category chips ───────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.14, ease: EASE }}
          className="mb-10 grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {CATEGORY_CHIPS.map(({ label, emoji }) => (
            <button
              key={label}
              type="button"
              onClick={goMap}
              className="flex items-center gap-2.5 rounded-2xl bg-[#f7f7f7] border border-[#dddddd] px-4 py-3.5 text-[13px] font-500 text-[#222222] hover:bg-[#f0f0f0] hover:border-[#b0b0b0] transition-all text-left"
            >
              <span className="text-lg">{emoji}</span>
              {label}
            </button>
          ))}
        </motion.section>

        {/* ── Listings grid ────────────────────────────────────────── */}
        <section>
          <div className="flex justify-between items-center mb-5 gap-3 flex-wrap">
            <h2 className="text-[20px] font-semibold text-[#222222]">
              Homes we think you&apos;ll love
            </h2>
            <button
              type="button"
              onClick={() => navigate("/map")}
              className="text-[13px] font-medium text-[#222222] underline underline-offset-2 hover:text-[#ff385c] transition-colors"
            >
              View all on map
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
            {listings.map((listing, i) => {
              const image =
                listing.image ||
                listing.images?.[0] ||
                "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=800";
              const isVideo = image.match(/\.(mp4|webm|ogg|mov)$/i) || image.includes("video");
              return (
                <motion.article
                  key={listing.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: i * 0.04, ease: EASE }}
                  onClick={() => setViewingProperty(listing)}
                  className="group bg-white rounded-2xl border border-[#ebebeb] cursor-pointer hover:shadow-[0_8px_28px_rgba(0,0,0,0.10)] transition-all duration-300 overflow-hidden"
                >
                  {/* Image */}
                  <div className="relative overflow-hidden">
                    {isVideo ? (
                      <video
                        src={image}
                        className="w-full h-52 object-cover group-hover:scale-105 transition-transform duration-500"
                        autoPlay
                        muted
                        loop
                        playsInline
                      />
                    ) : (
                      <SmartImage
                        src={image}
                        alt={listing.title}
                        className="w-full h-52 object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    )}
                    <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm rounded-full px-2.5 py-1 text-[11px] font-semibold text-[#222222] shadow-sm">
                      Verified
                    </span>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center text-[#222222] hover:text-[#ff385c] transition-colors shadow-sm"
                      aria-label="Save listing"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                  </div>

                  {/* Content */}
                  <div className="p-3.5">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-[14px] font-semibold text-[#222222] line-clamp-1 leading-snug">
                        {listing.title}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[13px]">★</span>
                        <span className="text-[13px] font-medium text-[#222222]">4.8</span>
                      </div>
                    </div>
                    <p className="text-[13px] text-[#6a6a6a] mt-1 line-clamp-1">
                      {listing.address || listing.location || "Bengaluru"}
                    </p>
                    <p className="text-[13px] text-[#6a6a6a]">
                      {listing.availability || "Immediate"} · {listing.bhk}
                    </p>
                    <p className="mt-2 text-[14px] text-[#222222]">
                      <span className="font-bold">{listing.price || `₹ ${listing.monthlyRent?.toLocaleString()}`}</span>
                      <span className="font-normal text-[#6a6a6a]"> / month</span>
                    </p>
                  </div>
                </motion.article>
              );
            })}
          </div>

          {listings.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-full bg-[#f7f7f7] flex items-center justify-center text-3xl mb-4">🏠</div>
              <p className="text-[15px] font-semibold text-[#222222]">Loading listings…</p>
              <p className="text-[13px] text-[#6a6a6a] mt-1">Fetching verified homes for you.</p>
            </div>
          )}
        </section>

      </main>

      <Footer />

      {viewingProperty && (
        <PropertyModal
          property={viewingProperty}
          listings={listings}
          onSelectListing={(l) => setViewingProperty(l)}
          onClose={() => setViewingProperty(null)}
        />
      )}
    </PageShell>
  );
}
