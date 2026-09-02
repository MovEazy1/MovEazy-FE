import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { addVisitRequestData, getListingPrivateData, isListingPubliclyVisible } from "../lib/firestoreStore";
import { canReadListingPrivatePhones } from "../lib/accessControl";
import { isSupabaseConfigured } from "../lib/supabase";
import { triggerVisitNotificationEmail } from "../lib/emailService";
import { findNearbyListings } from "../lib/geo";
import { isListingSaved, toggleSavedListing } from "../lib/userActivity";
import { submitListingInterestFull, logSavedListingChange } from "../lib/crmSync";
import { buildBrokerWhatsAppUrl, logBrokerWhatsAppContact } from "../lib/brokerWhatsApp";
import MovEAZYLogo from "./branding/MovEAZYLogo";

function MediaElement({ src, alt, style, firstImage }) {
  if (!src) return null;
  const isVideo = src.match(/\.(mp4|webm|ogg|mov)$/i) || src.includes('video');
  if (isVideo) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center" }}>
        {firstImage && (
          <img src={firstImage} alt="" style={{ position: "absolute", width: "115%", height: "115%", objectFit: "cover", filter: "blur(30px) brightness(0.8)", opacity: 0.9 }} />
        )}
        <video src={src} style={{ ...style, objectFit: "contain", maxWidth: "100%", maxHeight: "100%", position: "relative", zIndex: 1 }} controls playsInline preload="metadata" />
      </div>
    );
  }
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center" }}>
      {/* Blurred background layer */}
      <img src={src} alt="" style={{ position: "absolute", width: "115%", height: "115%", objectFit: "cover", filter: "blur(25px) brightness(0.85)", opacity: 0.9 }} />
      {/* Main image layer */}
      <img src={src} alt={alt} loading="lazy" style={{ ...style, objectFit: "contain", position: "relative", zIndex: 1, maxWidth: "100%", maxHeight: "100%" }} />
    </div>
  );
}

export default function PropertyModal({ property, onClose, listings = [], onSelectListing, onSavedChange, initialShowVisitForm = false }) {
  const { user } = useAuth();
  const [visitForm, setVisitForm] = useState({ time: "", notes: "" });
  const [visitSuccess, setVisitSuccess] = useState("");
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [applyMode, setApplyMode] = useState("entire_unit");
  const [adultsSharing, setAdultsSharing] = useState(1);
  const [applyNotes, setApplyNotes] = useState("");
  const [applyMessage, setApplyMessage] = useState("");
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 768 : false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "unset"; };
  }, []);

  useEffect(() => {
    if (initialShowVisitForm) setShowVisitForm(true);
  }, [property?.id, initialShowVisitForm]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [isSaved, setIsSaved] = useState(false);
  const [shareText, setShareText] = useState("↗ Share");
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const [resolvedBrokerPhone, setResolvedBrokerPhone] = useState("");

  useEffect(() => {
    let cancelled = false;
    const id = property?.id;
    if (!id || !isSupabaseConfigured || !user || !canReadListingPrivatePhones(user, property)) {
      setResolvedBrokerPhone("");
      return undefined;
    }
    (async () => {
      try {
        const priv = await getListingPrivateData(String(id));
        const line = String(priv?.agentPhone || priv?.ownerPhone || "").trim();
        if (!cancelled) setResolvedBrokerPhone(line);
      } catch {
        if (!cancelled) setResolvedBrokerPhone("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [property?.id, property, user]);

  const handleShare = () => {
    const origin = window.location.origin;
    const url = `${origin}/map?listingId=${encodeURIComponent(String(property?.id || ""))}`;
    const title = property?.title ? `MovEazy · ${property.title}` : "MovEazy listing";

    const done = () => {
      setShareText("✓ Copied!");
      setTimeout(() => setShareText("↗ Share"), 2000);
    };

    // Prefer native share on mobile (WhatsApp/Telegram etc.)
    if (navigator.share) {
      navigator
        .share({
          title,
          text: property?.address ? `${property.address}` : "View this listing on MovEazy",
          url,
        })
        .then(() => done())
        .catch(() => {
          // fall back to clipboard
          navigator.clipboard?.writeText?.(url).finally(done);
        });
      return;
    }

    navigator.clipboard?.writeText?.(url).finally(done);
  };

  const scrollRef = useRef(null);

  useEffect(() => {
    if (!property?.id) return;
    setActiveMediaIndex(0);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [property?.id]);

  useEffect(() => {
    if (!property?.id) return;
    setIsSaved(isListingSaved(user, property.id));
  }, [user, property?.id]);

  const nearbyListings = useMemo(() => {
    if (!property || !Number.isFinite(Number(property.lat)) || !Number.isFinite(Number(property.lng))) return [];
    return findNearbyListings(
      { lat: Number(property.lat), lng: Number(property.lng) },
      listings.filter(isListingPubliclyVisible),
      { excludeId: property.id, limit: 4, maxKm: 35 }
    );
  }, [property?.id, property?.lat, property?.lng, listings]);

  const brokerCallLine = String(resolvedBrokerPhone || property?.contact || "").trim();
  const brokerWhatsAppUrl = useMemo(() => {
    if (!property || !brokerCallLine) return null;
    return buildBrokerWhatsAppUrl({ user, property, privatePhone: resolvedBrokerPhone });
  }, [brokerCallLine, user, property, resolvedBrokerPhone]);

  if (!property) return null;

  const showBrokerDirectLine = Boolean(brokerCallLine && user && canReadListingPrivatePhones(user, property));

  const offMarket = !isListingPubliclyVisible(property);

  const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=1000";
  const rawMedia = Array.isArray(property.images) && property.images.length > 0 ? property.images : [property.image];
  const cleaned = rawMedia
    .map((u) => String(u ?? "").trim())
    .filter((u) => u.length > 0 && u !== "undefined" && u !== "null");
  const uniqueMedia = [...new Set(cleaned)];
  const images = uniqueMedia.length > 0 ? uniqueMedia : [PLACEHOLDER_IMAGE];
  const isVideoUrl = (u) => String(u).match(/\.(mp4|webm|ogg|mov)$/i) || String(u).includes("video");
  const firstImageUrl = images.find((u) => !isVideoUrl(u)) || PLACEHOLDER_IMAGE;

  const numericRent = Number(String(property.monthlyRent || property.rent || "0").replace(/[^0-9.]/g, "")) || 0;
  const parseMoney = (raw) => {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    // If the value contains letters (like "3 months", "Including"), don't parse as number
    if (/[a-zA-Z]/.test(s)) return null;
    const n = Number(s.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const depositFromField = parseMoney(property.securityDeposit);
  const maintenanceFromField = parseMoney(property.maintenanceCost);
  const securityDeposit = depositFromField ?? (numericRent > 0 ? Math.round(numericRent * 2.5) : 0);
  const maintenance = maintenanceFromField ?? (numericRent > 0 ? Math.round(numericRent * 0.08) : 0);
  const formatInr = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN")}`;
  // Show raw string (e.g. "3 months") if it contains text, otherwise format as INR
  const rawDeposit = String(property.securityDeposit || "").trim();
  
  // Robust deposit display logic
  let finalDeposit = "";
  if (rawDeposit) {
    if (/[a-zA-Z]/.test(rawDeposit)) {
      finalDeposit = rawDeposit; // e.g. "3 months"
    } else {
      const num = Number(rawDeposit.replace(/[^0-9.]/g, ""));
      if (num > 0 && num <= 15) {
        finalDeposit = `${num} months`; // Auto-append months for small numbers
      } else {
        finalDeposit = formatInr(num); // Format as currency for large numbers
      }
    }
  } else {
    finalDeposit = formatInr(securityDeposit);
  }

  const depositSidebar = finalDeposit;
  const maintenanceSidebar =
    maintenanceFromField != null
      ? formatInr(maintenanceFromField)
      : String(property.maintenanceCost || "").trim()
        ? String(property.maintenanceCost)
        : formatInr(maintenance);
  const dash = (v) => {
    if (v == null || v === "") return "—";
    if (Array.isArray(v) && v.length === 0) return "—";
    return String(v);
  };
  const amenities = property.amenities && property.amenities.length ? property.amenities : [];
  const furnishings = property.furnishings && property.furnishings.length ? property.furnishings : [];
  // Who listed this home — shown consistently as a badge (owner / broker / tenant).
  const listedByRaw = String(
    property.postedBy || property.posted_by || property.listedBy || property.listerType || ""
  ).toLowerCase();
  const listedByLabel =
    listedByRaw === "broker" ? "Broker" : listedByRaw === "tenant" ? "Tenant" : listedByRaw === "owner" ? "Owner" : "";
  const builtUpLabel = property.builtUpArea
    ? `${property.builtUpArea}${property.areaUnit ? ` ${property.areaUnit}` : ""}`
    : "—";
  const floorLabel =
    property.floorNumber || property.totalFloors
      ? `${dash(property.floorNumber)} of ${dash(property.totalFloors)} floors`
      : "—";
  const detailRows = [
    ["Security deposit", depositSidebar],
    ["Area unit", dash(property.areaUnit) !== "—" ? property.areaUnit : "sq ft"],
    ["Brokerage", dash(property.brokerage)],
    ["Maintenance", property.maintenanceCost ? dash(property.maintenanceCost) : formatInr(maintenance)],
    ["Built-up area", builtUpLabel],
    ["Furnishing (type)", dash(property.furnishing)],
    ["Bathrooms", dash(property.bathrooms)],
    ["Balcony", dash(property.balcony)],
    ["Available from", dash(property.availableFrom || property.availability)],
    ["Floor / total floors", floorLabel],
    ["Lease type", dash(property.leaseType)],
    ["Age of property", dash(property.ageOfProperty)],
    ["Parking", dash(property.parkingInfo) !== "—" ? property.parkingInfo : property.parking?.join(", ") || "—"],
    ["Gas pipeline", dash(property.gasPipeline)],
    ["Gated community", dash(property.gatedCommunity)],
    ["Source URL", property.sourceUrl ? property.sourceUrl : "—"],
  ];

  const submitVisit = async (e) => {
    e.preventDefault();
    if (offMarket) {
      alert("This listing is no longer on the market.");
      return;
    }
    if (!user) {
      alert("Please log in to schedule a visit.");
      return;
    }
    if (!isSupabaseConfigured) {
      alert("Booking isn't available right now — please try again later.");
      return;
    }
    try {
      await addVisitRequestData({
        listingId: property.id,
        listingTitle: property.title,
        customerEmail: user.email,
        customerPhone: user.phone || "",
        sellerEmail: property.sellerEmail || property.ownerEmail || "",
        visitTime: visitForm.time,
        notes: visitForm.notes
      });
      triggerVisitNotificationEmail({
        customerEmail: user.email,
        customerPhone: user.phone || "",
        sellerEmail: property.sellerEmail || property.ownerEmail || "",
        visitTime: visitForm.time,
        notes: visitForm.notes,
        listingId: property.id
      });
    } catch (err) {
      alert(err?.message || "Could not submit your request — please try again.");
      return;
    }
    setVisitSuccess("Visit scheduled successfully! The seller has been notified.");
    setTimeout(() => {
      setVisitSuccess("");
      setShowVisitForm(false);
    }, 2500);
  };

  const badgeStyles = {
    padding: "6px 12px",
    background: "#f1f5f9",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#334155",
    display: "flex",
    alignItems: "center",
    gap: "6px"
  };

  const activeMedia = images[activeMediaIndex] || images[0];
  const isActiveVideo = String(activeMedia || "").match(/\.(mp4|webm|ogg|mov)$/i) || String(activeMedia || "").includes("video");
  const goPrevMedia = () => setActiveMediaIndex((prev) => (prev - 1 + images.length) % images.length);
  const goNextMedia = () => setActiveMediaIndex((prev) => (prev + 1) % images.length);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: el.offsetTop - 50, // slightly offset for header
        behavior: "smooth"
      });
    }
  };

  const submitInterest = async () => {
    if (offMarket) {
      setApplyMessage("This listing is no longer on the market.");
      return;
    }
    try {
      await submitListingInterestFull(user, {
        listingId: property.id,
        listingTitle: property.title,
        seller: property.seller,
        contact: property.contact,
        sellerEmail: property.sellerEmail || "",
        tenancyPreference: applyMode,
        adultsSharing,
        notes: applyNotes,
      });
      setApplyMessage("Interest saved. Admins and the seller are notified by email when EmailJS is configured. Track status under Saved · activity or your dashboard.");
      setApplyNotes("");
    } catch (e) {
      setApplyMessage(e instanceof Error ? e.message : "Could not complete submission. Please try again.");
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed", inset: 0, zIndex: 99999, background: "rgba(15, 23, 42, 0.95)",
          display: "flex", justifyContent: "center", alignItems: "center", padding: isMobile ? "8px" : "20px"
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 50, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.98 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          style={{
            background: "linear-gradient(180deg, #fffdfd 0%, #fff8f8 100%)", width: "100%", maxWidth: "1100px", height: isMobile ? "95vh" : "90vh",
            borderRadius: isMobile ? "14px" : "16px", overflow: "hidden", display: "flex", flexDirection: "column",
            position: "relative", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — close sits in the row so it never covers Save / Share */}
          <div
            style={{
              padding: isMobile ? "12px 14px" : "16px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              background: "#000000",
              borderBottom: "1px solid #27272a",
              zIndex: 10,
            }}
          >
            <div style={{ display: "flex", gap: isMobile ? "10px" : "16px", alignItems: "center", minWidth: 0, flex: "1 1 auto" }}>
              <div
                onClick={() => onClose()}
                style={{ cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}
              >
                <MovEAZYLogo variant="dark" size={isMobile ? "sm" : "md"} />
              </div>
              <div style={{ display: "flex", gap: isMobile ? "10px" : "16px", color: "#cbd5e1", fontWeight: 600, fontSize: isMobile ? "12px" : "14px", flexWrap: "wrap", minWidth: 0 }}>
                <span onClick={() => scrollTo("overview")} style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = "#fff"} onMouseLeave={(e) => e.target.style.color = "#cbd5e1"}>Overview</span>
                {nearbyListings.length > 0 && typeof onSelectListing === "function" ? (
                  <span onClick={() => scrollTo("nearby-homes")} style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = "#fff"} onMouseLeave={(e) => e.target.style.color = "#cbd5e1"}>Nearby</span>
                ) : null}
                <span onClick={() => scrollTo("facts")} style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = "#fff"} onMouseLeave={(e) => e.target.style.color = "#cbd5e1"}>Facts & Features</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0, marginLeft: "auto" }}>
              <button
                type="button"
                onClick={() => {
                  const now = toggleSavedListing(user, property.id, property.title);
                  setIsSaved(now);
                  void logSavedListingChange(user, property.id, now, property.title);
                  onSavedChange?.();
                }}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #475569", borderRadius: "8px", padding: "6px 12px", fontWeight: 600, fontSize: "13px", cursor: "pointer", color: isSaved ? "#ff3131" : "#f1f5f9", transition: "all 0.2s" }}
                onMouseEnter={(e) => {
                  if (!isSaved) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                    e.currentTarget.style.borderColor = "#94a3b8";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSaved) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                    e.currentTarget.style.borderColor = "#475569";
                  }
                }}
              >
                {isMobile ? (isSaved ? "♥" : "♡") : (isSaved ? "♥ Saved" : "♡ Save")}
              </button>
              <button type="button" onClick={handleShare} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #475569", borderRadius: "8px", padding: "6px 12px", fontWeight: 600, fontSize: "13px", cursor: "pointer", color: "#f1f5f9", transition: "all 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.borderColor = "#94a3b8"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "#475569"; }}>
                {isMobile ? "↗" : shareText}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "999px",
                  border: "1px solid #475569",
                  background: "rgba(255,255,255,0.05)",
                  color: "#f1f5f9",
                  fontWeight: 800,
                  fontSize: "18px",
                  lineHeight: 1,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
                aria-label="Close property modal"
              >
                ×
              </button>
            </div>
          </div>

          {offMarket ? (
            <div
              role="status"
              style={{
                padding: "10px 16px",
                background: "#fffbeb",
                borderBottom: "1px solid #fcd34d",
                color: "#92400e",
                fontSize: "13px",
                fontWeight: 600,
                textAlign: "center",
                lineHeight: 1.45,
              }}
            >
              This home is off market — new interest and tour requests are closed. (Same policy as major rental marketplaces: sellers withdraw; only MovEazy admin can permanently remove a listing.)
            </div>
          ) : null}

          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", position: "relative" }}>
            {/* Gallery: column layout so dots + thumbnails sit above the title (no overlap) */}
            <div
              style={{
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                padding: "10px 10px 14px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: isMobile ? 240 : 380,
                  flexShrink: 0,
                  overflow: "hidden",
                  background: "#0f172a",
                  borderRadius: "14px",
                }}
              >
                <MediaElement src={images[activeMediaIndex]} alt={property.title} firstImage={firstImageUrl} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                {isActiveVideo && (
                  <div style={{ position: "absolute", top: "10px", left: "10px", background: "rgba(15,23,42,0.7)", color: "white", fontSize: "11px", fontWeight: 700, borderRadius: "999px", padding: "5px 9px" }}>
                    VIDEO
                  </div>
                )}
                {images.length > 1 && (
                  <div
                    style={{ position: "absolute", inset: 0 }}
                    onTouchStart={(e) => setTouchStartX(e.changedTouches?.[0]?.clientX ?? null)}
                    onTouchEnd={(e) => {
                      if (touchStartX == null) return;
                      const endX = e.changedTouches?.[0]?.clientX ?? touchStartX;
                      const delta = endX - touchStartX;
                      if (Math.abs(delta) >= 40) {
                        if (delta < 0) goNextMedia();
                        else goPrevMedia();
                      }
                      setTouchStartX(null);
                    }}
                  />
                )}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); goPrevMedia(); }}
                      style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "34px", height: "34px", borderRadius: "999px", border: "1px solid #e2e8f0", background: "rgba(255,255,255,0.92)", color: "#0f172a", fontWeight: 700, zIndex: 10, cursor: "pointer", pointerEvents: "auto" }}
                      aria-label="Previous media"
                    >
                      {"<"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); goNextMedia(); }}
                      style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", width: "34px", height: "34px", borderRadius: "999px", border: "1px solid #e2e8f0", background: "rgba(255,255,255,0.92)", color: "#0f172a", fontWeight: 700, zIndex: 10, cursor: "pointer", pointerEvents: "auto" }}
                      aria-label="Next media"
                    >
                      {">"}
                    </button>
                  </>
                )}
              </div>
              {images.length > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveMediaIndex(idx)}
                      style={{
                        width: idx === activeMediaIndex ? "22px" : "8px",
                        height: "8px",
                        borderRadius: "999px",
                        border: "none",
                        background: idx === activeMediaIndex ? "#334155" : "#cbd5e1",
                        transition: "all 0.2s ease",
                      }}
                      aria-label={`Go to media ${idx + 1}`}
                    />
                  ))}
                </div>
              )}
              {images.length > 1 && (
                <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px", WebkitOverflowScrolling: "touch" }}>
                  {images.map((src, idx) => {
                    const isVideoThumb = String(src || "").match(/\.(mp4|webm|ogg|mov)$/i) || String(src || "").includes("video");
                    return (
                      <button
                        key={`${src}-${idx}`}
                        type="button"
                        onClick={() => setActiveMediaIndex(idx)}
                        style={{
                          border: idx === activeMediaIndex ? "2px solid #334155" : "1px solid #cbd5e1",
                          borderRadius: "10px",
                          padding: 0,
                          background: "white",
                          minWidth: "72px",
                          width: "72px",
                          height: "52px",
                          overflow: "hidden",
                          position: "relative",
                        }}
                        aria-label={`Select media ${idx + 1}`}
                      >
                        {isVideoThumb ? (
                          <video
                            src={src}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            muted
                            onError={(e) => {
                              const btn = e.currentTarget.closest("button");
                              if (btn) btn.style.display = "none";
                            }}
                          />
                        ) : (
                          <img
                            src={src}
                            alt=""
                            loading="lazy"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={(e) => {
                              const btn = e.currentTarget.closest("button");
                              if (btn) btn.style.display = "none";
                            }}
                          />
                        )}
                        {isVideoThumb && (
                          <span style={{ position: "absolute", right: "4px", bottom: "4px", fontSize: "9px", color: "white", background: "rgba(0,0,0,0.7)", borderRadius: "999px", padding: "2px 5px", fontWeight: 700 }}>
                            VIDEO
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Content Area */}
            <div style={{ display: "flex", flexWrap: "wrap", padding: isMobile ? "14px" : "32px", gap: isMobile ? "18px" : "40px", maxWidth: "1000px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
              
              {/* Left Column (Details) */}
              <div id="overview" style={{ flex: "1 1 500px", minWidth: 0 }}>
                {property.badge && (
                  <div style={{ background: "#fef2f2", color: "#ff3131", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 700, display: "inline-block", marginBottom: "12px" }}>
                    {property.badge.toUpperCase()}
                  </div>
                )}
                <h1 style={{ fontSize: "28px", margin: "0 0 8px", fontWeight: 800, color: "#0f172a" }}>{property.title}</h1>
                <p style={{ fontSize: "16px", color: "#64748b", margin: "0 0 16px" }}>{property.address || property.areas || "Location not provided"}</p>
                
                <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
                  <div style={badgeStyles}>🏢 {property.propertyType || property.type || "Apartment"}</div>
                  <div style={badgeStyles}>🛏️ {property.bhk || "2 BHK"}</div>
                  <div style={badgeStyles}>🛋️ {property.furnishing || "Semi"}</div>
                  <div style={badgeStyles}>🚗 {property.parking && property.parking.length > 0 ? property.parking.join(", ") : "Available"}</div>
                  <div style={badgeStyles}>👨‍👩‍👧‍👦 {property.preferredTenants && property.preferredTenants.length > 0 ? property.preferredTenants.join(", ") : "Anyone"}</div>
                  <div
                    style={{
                      ...badgeStyles,
                      border: "1px solid #bbf7d0",
                      background: "#ecfdf5",
                      color: "#14532d",
                    }}
                  >
                    📅 {property.availability || "Immediate"}
                  </div>
                  {listedByLabel && (
                    <div
                      style={{
                        ...badgeStyles,
                        border: "1px solid #fbcfc4",
                        background: "#fff5f2",
                        color: "#b23a28",
                      }}
                    >
                      🏷️ Listed by {listedByLabel}
                    </div>
                  )}
                </div>

                <div style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)", padding: "20px", borderRadius: "12px", marginBottom: "24px", border: "1px solid #bbf7d0" }}>
                  <h2 style={{ margin: "0 0 10px", fontSize: "17px", color: "#0f172a" }}>Availability and rent share</h2>
                  <p style={{ margin: "0 0 14px", fontSize: "14px", color: "#475569", lineHeight: 1.55 }}>
                    Listed availability is shown on the badge above. If you share with flatmates, your portion of the monthly rent is an estimate only — final split depends on bedrooms agreed with the owner.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0,1fr))", gap: "10px" }}>
                    {[1, 2, 3, 4].map((n) => {
                      const share = numericRent > 0 ? Math.round(numericRent / n) : 0;
                      return (
                        <div key={n} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                          <div style={{ fontSize: "11px", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>{n === 1 ? "Solo" : `${n} people`}</div>
                          <div style={{ fontSize: "15px", fontWeight: 800, color: "#15803d", marginTop: "6px" }}>{share > 0 ? formatInr(share) : "—"}</div>
                          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>per person / mo</div>
                        </div>
                      );
                    })}
                  </div>
                  {property.bhk === "Roommate needed" ? (
                    <p style={{ margin: "12px 0 0", fontSize: "13px", color: "#92400e", fontWeight: 600 }}>This listing is tagged for roommate matching — use Apply below and mention your move-in timeline.</p>
                  ) : null}
                </div>

                <div style={{ background: "#f8fafc", padding: "24px", borderRadius: "12px", marginBottom: "32px", border: "1px solid #e2e8f0" }}>
                  <h2 style={{ margin: "0 0 12px", fontSize: "18px", color: "#0f172a" }}>What's special</h2>
                  <p style={{ margin: 0, fontSize: "15px", color: "#475569", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                    {property.description || "Stunning property located in a prime neighborhood. Contact the seller to learn more about the unprecedented amenities and layout. Perfect for those looking for comfort and convenience in one place."}
                  </p>
                </div>

                {nearbyListings.length > 0 && typeof onSelectListing === "function" ? (
                  <div id="nearby-homes" style={{ marginBottom: "32px" }}>
                    <h2 style={{ margin: "0 0 8px", fontSize: "18px", color: "#0f172a" }}>Nearby homes</h2>
                    <p style={{ margin: "0 0 14px", fontSize: "14px", color: "#64748b", lineHeight: 1.5 }}>
                      Other listings in this neighbourhood — tap a card to switch without closing the map.
                    </p>
                    <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "6px", WebkitOverflowScrolling: "touch" }}>
                      {nearbyListings.map((n) => {
                        const img = n.image || n.images?.[0];
                        const km = typeof n._distanceKm === "number" ? n._distanceKm.toFixed(1) : "?";
                        return (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              const { _distanceKm: _d, ...rest } = n;
                              onSelectListing(rest);
                            }}
                            style={{
                              flex: "0 0 auto",
                              width: "min(200px, 72vw)",
                              textAlign: "left",
                              border: "1px solid #e2e8f0",
                              borderRadius: "12px",
                              overflow: "hidden",
                              background: "white",
                              cursor: "pointer",
                              padding: 0,
                              boxShadow: "0 2px 10px rgba(15,23,42,0.06)",
                            }}
                          >
                            {img ? (
                              <img src={img} alt="" style={{ width: "100%", height: "100px", objectFit: "cover", display: "block" }} />
                            ) : (
                              <div style={{ height: "100px", background: "#f1f5f9" }} />
                            )}
                            <div style={{ padding: "10px 12px 12px" }}>
                              <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>{km} km away</div>
                              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", lineHeight: 1.35 }}>{n.title}</div>
                              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", lineHeight: 1.35 }}>{n.address}</div>
                              <div style={{ fontSize: "13px", fontWeight: 800, color: "#16a34a", marginTop: "6px" }}>{n.price || `₹ ${n.monthlyRent}`}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div id="facts" style={{ marginBottom: "32px" }}>
                  <h2 style={{ margin: "0 0 16px", fontSize: "18px", color: "#0f172a" }}>Facts, features & policies</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div style={{ background: "#f1f5f9", padding: "12px", borderRadius: "8px" }}>
                      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Availability</div>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{property.availability || "Immediate"}</div>
                    </div>
                    <div style={{ background: "#f1f5f9", padding: "12px", borderRadius: "8px" }}>
                      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Listed By</div>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{property.seller || property.company || "Owner"}</div>
                    </div>
                    <div style={{ background: "#f1f5f9", padding: "12px", borderRadius: "8px" }}>
                      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Broker contact</div>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>
                        {showBrokerDirectLine
                          ? brokerCallLine
                          : "Not published on the public map — request a visit or apply and MovEazy coordinates with the broker."}
                      </div>
                    </div>
                    <div style={{ background: "#f1f5f9", padding: "12px", borderRadius: "8px" }}>
                      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Source</div>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{property.source || "Direct"}</div>
                    </div>
                    <div style={{ background: "#f1f5f9", padding: "12px", borderRadius: "8px" }}>
                      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Coordinates</div>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{property.lat && property.lng ? `${property.lat}, ${property.lng}` : "Not available"}</div>
                    </div>
                    <div style={{ background: "#f1f5f9", padding: "12px", borderRadius: "8px" }}>
                      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Move-in</div>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{property.availableFrom || property.availability || "Immediate"}</div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: "32px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                  <div style={{ padding: "14px 16px", fontSize: "18px", fontWeight: 700, color: "#0f172a", borderBottom: "1px solid #e2e8f0" }}>
                    Listing specifications <span style={{ fontSize: "13px", fontWeight: 500, color: "#64748b" }}>(from listing / broker)</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0 20px", padding: "0 16px" }}>
                    {detailRows.map(([label, value], idx) => (
                      <div key={label} style={{ padding: "12px 0", borderBottom: idx < detailRows.length - 1 ? "1px solid #e2e8f0" : "none" }}>
                        <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>{label}</div>
                        <div style={{ fontSize: "15px", fontWeight: 600, color: "#0f172a", wordBreak: "break-word" }}>
                          {label === "Source URL" && value !== "—" ? (
                            <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>
                              {value}
                            </a>
                          ) : (
                            value
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: "32px" }}>
                  <h2 style={{ margin: "0 0 12px", fontSize: "18px", color: "#0f172a" }}>Furnishings</h2>
                  {furnishings.length ? (
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0,1fr))", gap: "10px" }}>
                      {furnishings.map((item) => (
                        <div key={item} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px 12px", fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                          {item}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>—</p>
                  )}
                </div>

                <div style={{ marginBottom: "32px" }}>
                  <h2 style={{ margin: "0 0 12px", fontSize: "18px", color: "#0f172a" }}>Amenities</h2>
                  {amenities.length ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                      {amenities.map((item) => (
                        <span key={item} style={{ background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3", padding: "7px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 600 }}>
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>—</p>
                  )}
                </div>
              </div>

              {/* Right Column (Sticky Action Card) */}
              <div style={{ flex: "1 1 320px", position: "relative" }}>
                <div style={{ position: "sticky", top: "32px", background: "white", padding: "24px", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)" }}>
                  <div style={{ fontSize: "32px", fontWeight: 800, color: "#16a34a", marginBottom: "4px" }}>
                    {property.price || `₹ ${property.monthlyRent || 0}`}
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "20px" }}>Rent per month</div>

                  <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px", marginBottom: "16px", background: offMarket ? "#f1f5f9" : "#fafafa", opacity: offMarket ? 0.85 : 1 }}>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", marginBottom: "10px" }}>Apply interest</div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "6px" }}>How do you want to rent?</label>
                    <select
                      value={applyMode}
                      onChange={(e) => setApplyMode(e.target.value)}
                      disabled={offMarket}
                      style={{ width: "100%", marginBottom: "10px", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                    >
                      <option value="entire_unit">Whole unit (family / solo)</option>
                      <option value="seeking_flatmate">Looking for a flatmate for this home</option>
                      <option value="open_to_share">Open to sharing rent with others</option>
                    </select>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "6px" }}>People splitting rent (incl. you)</label>
                    <select
                      value={adultsSharing}
                      onChange={(e) => setAdultsSharing(Number(e.target.value))}
                      disabled={offMarket}
                      style={{ width: "100%", marginBottom: "10px", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? "person" : "people"}
                        </option>
                      ))}
                    </select>
                    <textarea
                      rows={2}
                      value={applyNotes}
                      onChange={(e) => setApplyNotes(e.target.value)}
                      disabled={offMarket}
                      placeholder="Optional note (move-in date, budget, pets…)"
                      style={{ width: "100%", marginBottom: "10px", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box", resize: "vertical" }}
                    />
                    <button
                      type="button"
                      onClick={submitInterest}
                      disabled={offMarket}
                      style={{
                        width: "100%",
                        padding: "12px",
                        background: offMarket ? "#94a3b8" : "#0f172a",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: 800,
                        fontSize: "14px",
                        cursor: offMarket ? "not-allowed" : "pointer",
                      }}
                    >
                      Submit interest
                    </button>
                    {applyMessage ? (
                      <div style={{ marginTop: "10px", fontSize: "12px", color: "#166534", fontWeight: 600, lineHeight: 1.45 }}>{applyMessage}</div>
                    ) : null}
                    <p style={{ margin: "10px 0 0", fontSize: "11px", color: "#94a3b8", lineHeight: 1.45 }}>
                      {!user?.email ? "Signed out: we still save this on this device under a guest profile. Sign in to sync across devices." : null}
                    </p>
                  </div>

                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px", marginBottom: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#475569", marginBottom: "6px" }}>
                      <span>Security deposit</span><strong style={{ color: "#0f172a" }}>{depositSidebar}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#475569", marginBottom: "6px" }}>
                      <span>Maintenance (est.)</span><strong style={{ color: "#0f172a" }}>{maintenanceSidebar}</strong>
                    </div>

                  </div>

                  {showVisitForm ? (
                    <form onSubmit={submitVisit} style={{ display: "flex", flexDirection: "column", gap: "12px", opacity: offMarket ? 0.6 : 1, pointerEvents: offMarket ? "none" : "auto" }}>
                      <h3 style={{ margin: "0 0 8px", fontSize: "16px" }}>Schedule a Visit</h3>
                      {visitSuccess ? (
                        <div style={{ background: "#dcfce7", color: "#166534", padding: "12px", borderRadius: "8px", fontWeight: 600, textAlign: "center", fontSize: "13px" }}>
                          {visitSuccess}
                        </div>
                      ) : (
                        <>
                          <input type="text" required placeholder="Date & Time (e.g. Tomorrow 5PM)" value={visitForm.time} onChange={(e) => setVisitForm({ ...visitForm, time: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", boxSizing: "border-box", fontSize: "14px" }} />
                          <textarea rows={2} placeholder="Any questions?" value={visitForm.notes} onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", boxSizing: "border-box", fontSize: "14px" }} />
                          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                            <button type="button" onClick={() => setShowVisitForm(false)} style={{ flex: 1, padding: "12px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                            <button type="submit" style={{ flex: 2, padding: "12px", background: "#ff3131", color: "white", border: "none", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}>Confirm</button>
                          </div>
                        </>
                      )}
                    </form>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <button type="button" disabled={offMarket} onClick={() => !offMarket && setShowVisitForm(true)} style={{ width: "100%", padding: "14px", background: offMarket ? "#cbd5e1" : "#ff3131", color: "white", border: "none", borderRadius: "8px", fontSize: "15px", fontWeight: 700, cursor: offMarket ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                        Request a tour
                      </button>
                      <button type="button" disabled={offMarket} onClick={() => !offMarket && setShowVisitForm(true)} style={{ width: "100%", padding: "14px", background: offMarket ? "#f1f5f9" : "white", color: offMarket ? "#94a3b8" : "#ff3131", border: offMarket ? "1px solid #e2e8f0" : "1px solid #ff3131", borderRadius: "8px", fontSize: "15px", fontWeight: 700, cursor: offMarket ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                        Check availability
                      </button>
                      {showBrokerDirectLine && brokerCallLine ? (
                        <>
                          <a
                            href={`tel:${brokerCallLine.replace(/\s/g, "")}`}
                            style={{
                              display: "block",
                              textAlign: "center",
                              width: "100%",
                              padding: "14px",
                              background: "#f8fafc",
                              color: "#0f172a",
                              border: "1px solid #cbd5e1",
                              borderRadius: "8px",
                              fontSize: "15px",
                              fontWeight: 700,
                              cursor: "pointer",
                              textDecoration: "none",
                              boxSizing: "border-box",
                            }}
                          >
                            Call broker: {brokerCallLine}
                          </a>
                          <a
                            href={brokerWhatsAppUrl || "#"}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => {
                              if (!brokerWhatsAppUrl) {
                                e.preventDefault();
                                return;
                              }
                              void logBrokerWhatsAppContact({
                                user,
                                property,
                                privatePhone: resolvedBrokerPhone,
                                source: "property_modal_direct_line",
                              });
                            }}
                            style={{
                              display: "block",
                              textAlign: "center",
                              width: "100%",
                              padding: "14px",
                              background: "#ecfdf3",
                              color: "#166534",
                              border: "1px solid #86efac",
                              borderRadius: "8px",
                              fontSize: "15px",
                              fontWeight: 700,
                              cursor: "pointer",
                              textDecoration: "none",
                              boxSizing: "border-box",
                            }}
                          >
                            WhatsApp broker
                          </a>
                        </>
                      ) : (
                        <div
                          style={{
                            padding: "14px",
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#475569",
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            textAlign: "center",
                            lineHeight: 1.45,
                          }}
                        >
                          Broker numbers are protected. Use <strong>Request a tour</strong> or <strong>Apply</strong> — our team connects you after verification.
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: "20px", display: "flex", gap: "12px", alignItems: "flex-start", background: "#f8fafc", padding: "12px", borderRadius: "8px" }}>
                    <div style={{ fontSize: "20px" }}>💡</div>
                    <div style={{ fontSize: "12px", color: "#475569", lineHeight: "1.5" }}>
                      <strong>MovEazy Guarantee available.</strong> Avoid unfair deductions and secure your deposit with our legal support.
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
