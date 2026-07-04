import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getListings } from "../../lib/store";
import { getListingsData, isListingPubliclyVisible } from "../../lib/firestoreStore";
import { isFirebaseConfigured } from "../../lib/firebase";
import cozyRoom from "../../assets/images/Cozy_modern_living_room.png";

const EASE = [0.22, 1, 0.36, 1];

export default function MarketingFeaturedListings() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = isFirebaseConfigured ? await getListingsData({ limitCount: 6 }) : [];
        if (alive) setListings(data.filter(isListingPubliclyVisible).slice(0, 6));
      } catch {
        if (alive) setListings([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="mkt-listings max-w-[1330px] mx-auto w-full rounded-[20px] px-6 sm:px-11 py-12 sm:py-16">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: EASE }}
        className="text-center max-w-2xl mx-auto"
      >
        <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-bold text-[#111827] leading-tight">
          Find the Right Home Without the Guesswork
        </h2>
        <p className="mt-4 text-base text-[#6b7280] leading-relaxed">
          Curated, verified rentals across Bengaluru — updated daily.
        </p>
      </motion.div>

      <div className="mt-10 grid sm:grid-cols-2 gap-6">
        {listings.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="mkt-listing-card animate-pulse h-[280px] bg-stone-100 rounded-2xl" />
            ))
          : listings.map((l, i) => (
              <motion.article
                key={l.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: EASE }}
                className="mkt-listing-card bg-white rounded-2xl overflow-hidden border border-stone-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/map?listingId=${encodeURIComponent(String(l.id))}`)}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/map?listingId=${encodeURIComponent(String(l.id))}`)}
                role="button"
                tabIndex={0}
              >
                <img
                  src={l.image || l.images?.[0] || cozyRoom}
                  alt=""
                  className="w-full h-48 object-cover"
                  draggable={false}
                />
                <div className="p-5">
                  <h3 className="font-bold text-lg text-[#111826] line-clamp-1">{l.title || "Verified listing"}</h3>
                  <p className="text-sm text-[#64748b] mt-1">{l.address || l.location || "Bengaluru"}</p>
                  <p className="mt-2 text-[#ff3131] font-bold text-lg">{l.price || (l.monthlyRent ? `₹${l.monthlyRent.toLocaleString("en-IN")}` : "Rent on request")}</p>
                  <p className="text-xs text-stone-500 mt-1">{l.bhk || "—"} · View details →</p>
                </div>
              </motion.article>
            ))}
      </div>

      <div className="mt-10 flex justify-center">
        <button type="button" className="mkt-btn-primary mkt-btn-red px-10" onClick={() => navigate("/map?openFilters=1")}>
          View all listings
        </button>
      </div>
    </section>
  );
}
