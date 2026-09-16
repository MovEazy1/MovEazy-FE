import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { coverMedia, isVideoUrl, orderListingMedia } from "../lib/listingMedia";

/**
 * One-card-at-a-time swipeable browsing surface — placeholder visual design,
 * built to be restyled without touching the swipe mechanics or the
 * shortlist/skip/schedule wiring around it. Pattern lifted from
 * HowItWorks.jsx's EngineSection demo deck, pointed at real listings.
 *
 * Right swipe = shortlist, left swipe = skip. Tap buttons are the
 * non-gesture fallback for the same two actions.
 */
const EASE = [0.22, 1, 0.36, 1];

function cardCover(listing) {
  const photos = orderListingMedia(listing.images || []);
  return coverMedia([listing.image, ...photos]);
}

function rentLabel(listing) {
  const rent = Number(String(listing.monthlyRent || listing.rent || 0).toString().replace(/[^0-9.]/g, "")) || 0;
  return rent > 0 ? `₹${rent.toLocaleString("en-IN")}` : listing.price || "Price on request";
}

export default function SwipeDeck({
  listings = [],
  onSwipeRight,
  onSwipeLeft,
  onOpenDetails,
  onScheduleVisit,
  onExhausted,
  emptyLabel = "No homes to show right now.",
}) {
  const [index, setIndex] = useState(0);
  const [flyDir, setFlyDir] = useState(1);
  const exhaustedFired = useRef(false);

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

  const advance = (dir, listing) => {
    setFlyDir(dir);
    setIndex((i) => i + 1);
    if (dir > 0) onSwipeRight?.(listing);
    else onSwipeLeft?.(listing);
  };

  if (!listings.length) {
    return (
      <div style={{ padding: "48px 20px", textAlign: "center", color: "#948c83", fontSize: 14.5 }}>
        {emptyLabel}
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ padding: "48px 20px", textAlign: "center", color: "#5c554e", fontSize: 14.5 }}>
        You've seen everything here for now.
      </div>
    );
  }

  const stack = listings.slice(index, index + 3);
  const current = listings[index];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "4px 4px 24px" }}>
      {/* Sticky "Schedule a Visit" bar — pinned to the top of the card, not the
          bottom, so booking a viewing never needs a scroll. Placeholder styling. */}
      <div
        style={{
          position: "sticky",
          top: 8,
          zIndex: 5,
          width: "100%",
          maxWidth: 360,
        }}
      >
        <button
          type="button"
          onClick={() => onScheduleVisit?.(current)}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 12,
            border: "none",
            background: "#04211D",
            color: "#fff",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 6px 18px rgba(4,33,29,0.22)",
          }}
        >
          Schedule a Visit
        </button>
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: "#948c83" }}>
        {index + 1} of {listings.length}
      </div>

      <div style={{ position: "relative", width: "100%", maxWidth: 360, height: 420 }}>
        <AnimatePresence>
          {stack.map((listing, i) => {
            const top = i === 0;
            const cover = cardCover(listing);
            const coverIsVideo = isVideoUrl(cover);
            return (
              <motion.div
                key={listing.id}
                drag={top ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                onDragEnd={(_e, info) => {
                  if (info.offset.x > 120) advance(1, listing);
                  else if (info.offset.x < -120) advance(-1, listing);
                }}
                initial={{ scale: 0.94, y: 20, opacity: 0 }}
                animate={{ scale: 1 - i * 0.04, y: i * 14, opacity: 1, zIndex: 10 - i }}
                exit={{ x: flyDir * 420, y: -60, rotate: flyDir * 14, opacity: 0, transition: { duration: 0.4, ease: EASE } }}
                transition={{ duration: 0.35, ease: EASE }}
                whileDrag={{ rotate: 0 }}
                style={{
                  position: "absolute",
                  inset: 0,
                  cursor: top ? "grab" : "default",
                  background: "#fff",
                  borderRadius: 20,
                  overflow: "hidden",
                  border: "1px solid #e9e3db",
                  boxShadow: "0 10px 34px rgba(23,20,18,.14)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ position: "relative", height: 220, background: "#efe7dc", flexShrink: 0 }}>
                  {cover ? (
                    coverIsVideo ? (
                      <video src={cover} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <img src={cover} alt={listing.title} loading="lazy" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
                    )
                  ) : null}
                  {Number.isFinite(listing.matchScore) && (
                    <span
                      style={{
                        position: "absolute", top: 12, left: 12,
                        background: "rgba(4,33,29,0.85)", color: "#5EEAD4",
                        fontSize: 12, fontWeight: 800, padding: "5px 11px", borderRadius: 999,
                      }}
                    >
                      {Math.round(listing.matchScore)}% match
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontWeight: 800, fontSize: 20, color: "#171412", letterSpacing: "-0.01em" }}>{rentLabel(listing)}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#171412", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{listing.title}</div>
                  <div style={{ fontSize: 12.5, color: "#5c554e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{listing.address}</div>
                  {listing.matchReasons?.length ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                      {listing.matchReasons.slice(0, 3).map((reason) => (
                        <span key={reason} style={{ background: "#E4F6F1", color: "#0E7C68", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>
                          {reason}
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
                      fontSize: 12.5, fontWeight: 700, color: "#d8412b",
                    }}
                  >
                    View details →
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Tap fallback for anyone not dragging. */}
      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        <button
          type="button"
          aria-label="Skip"
          onClick={() => advance(-1, current)}
          style={{
            width: 52, height: 52, borderRadius: "50%", border: "1px solid #e9e3db",
            background: "#fff", color: "#948c83", fontSize: 20, cursor: "pointer",
          }}
        >
          ✕
        </button>
        <button
          type="button"
          aria-label="Shortlist"
          onClick={() => advance(1, current)}
          style={{
            width: 52, height: 52, borderRadius: "50%", border: "none",
            background: "#ee5b45", color: "#fff", fontSize: 20, cursor: "pointer",
            boxShadow: "0 6px 18px rgba(238,91,69,.32)",
          }}
        >
          ♥
        </button>
      </div>
    </div>
  );
}
