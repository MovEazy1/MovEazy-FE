import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, BedDouble, Bath, Layers, ShieldCheck, MapPin, CalendarCheck, CheckCircle2 } from "lucide-react";
import { coverMedia, isVideoUrl, orderListingMedia } from "../lib/listingMedia";
import { formatPostedAgo } from "../lib/formatTime";

/**
 * One-card-at-a-time swipeable browsing surface. Right swipe = shortlist,
 * left swipe = skip; tap buttons are the non-gesture fallback for the same
 * two actions. "Schedule a Visit" is a sticky bar above the deck rather than
 * a button buried at the bottom of a long listing page.
 */
const EASE = [0.22, 1, 0.36, 1];
const T = {
  ink: "#04211D",
  teal: "#0E7C68",
  mint: "#5EEAD4",
  mintSoft: "#E4F6F1",
  cream: "#F7FAF8",
  line: "#e9e3db",
  text: "#171412",
  textDim: "#5c554e",
  textMute: "#948c83",
  coral: "#ee5b45",
};

function cardCover(listing) {
  const photos = orderListingMedia(listing.images || []);
  return coverMedia([listing.image, ...photos]);
}

function rentLabel(listing) {
  const rent = Number(String(listing.monthlyRent || listing.rent || 0).toString().replace(/[^0-9.]/g, "")) || 0;
  return rent > 0 ? `₹${rent.toLocaleString("en-IN")}` : listing.price || "Price on request";
}

/** Up to 4 highlight chips: personalised match reasons first, amenities fill the rest. */
function highlightsFor(listing) {
  const out = [...(listing.matchReasons || [])];
  for (const a of listing.amenities || []) {
    if (out.length >= 4) break;
    if (!out.includes(a)) out.push(a);
  }
  return out.slice(0, 4);
}

function Stat({ icon: Icon, value }) {
  if (value == null || value === "") return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: T.textDim }}>
      <Icon size={14} strokeWidth={2} />
      {value}
    </span>
  );
}

function SwipeCard({ listing, index, top, onSwiped, onOpenDetails, position }) {
  const cover = cardCover(listing);
  const coverIsVideo = isVideoUrl(cover);
  const postedAgo = formatPostedAgo(listing.postedAt);
  const bedrooms = listing.bedrooms || (typeof listing.bhk === "string" ? listing.bhk.match(/\d+/)?.[0] : null);
  const highlights = highlightsFor(listing);

  // Plain state, not a bound MotionValue — a MotionValue wired into style.x
  // fights framer-motion's own exit animation on that same property, which
  // left the outgoing card stuck on-screen instead of unmounting.
  const [dragX, setDragX] = useState(0);
  const likeOpacity = Math.max(0, Math.min(1, (dragX - 20) / 100));
  const skipOpacity = Math.max(0, Math.min(1, (-dragX - 20) / 100));

  return (
    <motion.div
      drag={top ? "x" : false}
      style={{ position: "absolute", inset: 0, cursor: top ? "grab" : "default", zIndex: 10 - index, isolation: "isolate" }}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDrag={top ? (_e, info) => setDragX(info.offset.x) : undefined}
      onDragEnd={(_e, info) => {
        setDragX(0);
        if (info.offset.x > 120) onSwiped(1, listing);
        else if (info.offset.x < -120) onSwiped(-1, listing);
      }}
      initial={{ scale: 0.94, y: 20, opacity: 0 }}
      animate={{ scale: 1 - index * 0.04, y: index * 14, opacity: 1 }}
      exit={{ x: position * 420, y: -60, rotate: position * 14, opacity: 0, transition: { duration: 0.4, ease: EASE } }}
      transition={{ duration: 0.35, ease: EASE }}
      whileDrag={{ rotate: 0 }}
    >
      <div
        style={{
          height: "100%",
          background: "#fff",
          borderRadius: 22,
          overflow: "hidden",
          border: `1px solid ${T.line}`,
          boxShadow: "0 10px 34px rgba(23,20,18,.14)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ position: "relative", height: "56%", background: "#efe7dc", flexShrink: 0 }}>
          {cover ? (
            coverIsVideo ? (
              <video src={cover} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <img src={cover} alt={listing.title} loading="lazy" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
            )
          ) : null}

          {top && (
            <>
              <motion.div style={{ position: "absolute", inset: 0, background: T.teal, opacity: likeOpacity }} />
              <motion.div style={{ position: "absolute", inset: 0, background: T.coral, opacity: skipOpacity }} />
            </>
          )}

          <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", alignItems: "center", gap: 8 }}>
            {listing.isVerified ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(4,33,29,.72)", color: T.mint, fontSize: 11, fontWeight: 700, padding: "4px 9px", borderRadius: 999 }}>
                <ShieldCheck size={12} /> Verified
              </span>
            ) : null}
            <span style={{ flex: 1 }} />
            {postedAgo ? (
              <span style={{ background: "rgba(4,33,29,.72)", color: "#fff", fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: 999 }}>
                {postedAgo}
              </span>
            ) : null}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 5, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 21, color: T.text, letterSpacing: "-0.01em" }}>{rentLabel(listing)}</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.textDim, whiteSpace: "nowrap" }}>
              {listing.bhk || (bedrooms ? `${bedrooms} BHK` : "Home")}{listing.furnishing ? ` · ${listing.furnishing}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, color: T.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <MapPin size={13} style={{ flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{listing.address || listing.location}</span>
          </div>

          <div style={{ display: "flex", gap: 14, marginTop: 2 }}>
            <Stat icon={BedDouble} value={bedrooms ? `${bedrooms} Bed` : null} />
            <Stat icon={Bath} value={listing.bathrooms ? `${listing.bathrooms} Bath` : null} />
            <Stat icon={Layers} value={listing.floorNumber ? `Floor ${listing.floorNumber}` : null} />
          </div>

          {highlights.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 10px", marginTop: 6 }}>
              {highlights.map((h) => (
                <span key={h} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: T.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <CheckCircle2 size={12} style={{ color: T.teal, flexShrink: 0 }} />
                  {h}
                </span>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => onOpenDetails?.(listing)}
            style={{
              marginTop: "auto", alignSelf: "flex-start",
              border: "none", background: "none", padding: 0, cursor: "pointer",
              fontSize: 12.5, fontWeight: 700, color: T.coral,
            }}
          >
            View details →
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function SwipeDeck({
  listings = [],
  onSwipeRight,
  onSwipeLeft,
  onOpenDetails,
  onScheduleVisit,
  onExhausted,
  emptyLabel = "No homes to show right now.",
  advanceOn,
}) {
  const [index, setIndex] = useState(0);
  const [position, setPosition] = useState(1);
  const [toast, setToast] = useState(null); // { text, tone: 'like'|'skip' }
  const exhaustedFired = useRef(false);
  const toastTimer = useRef(null);

  // A fresh listing set (new filters, new top-5 pull) should restart the deck.
  useEffect(() => {
    setIndex(0);
    exhaustedFired.current = false;
  }, [listings]);

  const done = index >= listings.length;

  useEffect(() => {
    if (done && listings.length > 0 && !exhaustedFired.current) {
      exhaustedFired.current = true;
      onExhausted?.();
    }
  }, [done, listings.length, onExhausted]);

  // Something outside the deck (a visit just booked from this card) is done
  // with the current card — move past it, but only if it's still the one on
  // top; a deep-linked property opened out of order shouldn't skip a card.
  useEffect(() => {
    if (advanceOn == null) return;
    setIndex((i) => (listings[i]?.id === advanceOn.id ? i + 1 : i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanceOn]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (tone) => {
    setToast({ tone, text: tone === "like" ? "Nice! Added to your shortlist." : "Got it — showing you fewer like this." });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  };

  const advance = (dir, listing) => {
    setPosition(dir);
    setIndex((i) => i + 1);
    if (dir > 0) { onSwipeRight?.(listing); showToast("like"); }
    else { onSwipeLeft?.(listing); showToast("skip"); }
  };

  if (!listings.length) {
    return (
      <div style={{ padding: "48px 20px", textAlign: "center", color: T.textMute, fontSize: 14.5 }}>
        {emptyLabel}
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ padding: "48px 20px", textAlign: "center", color: T.textDim, fontSize: 14.5 }}>
        You've seen everything here for now.
      </div>
    );
  }

  const stack = listings.slice(index, index + 3);
  const current = listings[index];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "4px 4px 30px" }}>
      {/* Sticky "Schedule a Visit" bar — pinned to the top of the card, not the
          bottom, so booking a viewing never needs a scroll. */}
      <div style={{ position: "sticky", top: 8, zIndex: 6, width: "100%", maxWidth: 380 }}>
        <button
          type="button"
          onClick={() => onScheduleVisit?.(current)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "12px 16px", borderRadius: 12, border: "none",
            background: T.ink, color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 6px 18px rgba(4,33,29,0.22)",
          }}
        >
          <CalendarCheck size={16} strokeWidth={2.2} />
          Schedule a Visit
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", maxWidth: 380, justifyContent: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.textMute }}>
          {index + 1} of {listings.length}
        </span>
      </div>

      <div style={{ position: "relative", width: "100%", maxWidth: 380, height: 460 }}>
        <AnimatePresence>
          {stack.map((listing, i) => (
            <SwipeCard
              key={listing.id}
              listing={listing}
              index={i}
              top={i === 0}
              position={position}
              onOpenDetails={onOpenDetails}
              onSwiped={advance}
            />
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 20,
                background: "#fff", color: toast.tone === "like" ? T.teal : T.textDim,
                fontSize: 12.5, fontWeight: 700, padding: "9px 16px", borderRadius: 999,
                boxShadow: "0 8px 22px rgba(23,20,18,.18)", whiteSpace: "nowrap",
              }}
            >
              {toast.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tap fallback for anyone not dragging. */}
      <div style={{ display: "flex", gap: 20, marginTop: 2 }}>
        <button
          type="button"
          aria-label="Skip"
          onClick={() => advance(-1, current)}
          style={{
            width: 54, height: 54, borderRadius: "50%", border: `1px solid ${T.line}`,
            background: "#fff", color: T.coral, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", boxShadow: "0 6px 18px rgba(23,20,18,.10)",
          }}
        >
          <X size={22} strokeWidth={2.4} />
        </button>
        <button
          type="button"
          aria-label="Shortlist"
          onClick={() => advance(1, current)}
          style={{
            width: 54, height: 54, borderRadius: "50%", border: "none",
            background: T.teal, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", boxShadow: "0 6px 18px rgba(14,124,104,.32)",
          }}
        >
          <Heart size={22} strokeWidth={2.4} fill="#fff" />
        </button>
      </div>
    </div>
  );
}
