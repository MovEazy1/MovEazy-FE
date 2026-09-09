import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { addVisitRequestData, getListingPrivateData, isListingPubliclyVisible } from "../lib/firestoreStore";
import { canReadListingPrivatePhones } from "../lib/accessControl";
import { isSupabaseConfigured } from "../lib/supabase";
import { triggerVisitNotificationEmail } from "../lib/emailService";
import {
  ArrowLeft, Share2, Heart, BedDouble, Users, Home as HomeIcon, CalendarDays,
  MapPin, ChevronRight, CalendarCheck, Images,
} from "lucide-react";
import logoMint from "../assets/logo/moveazy-logo-mint-dark.png";
import { useLoginModal } from "../context/LoginModalContext";
import { bookIndividual, fetchOpenVisitsForProperty, requestNextAvailableVisit } from "../lib/visits";
import { findNearbyListings } from "../lib/geo";
import { isListingSaved, toggleSavedListing } from "../lib/userActivity";
import { logSavedListingChange } from "../lib/crmSync";
import { buildBrokerWhatsAppUrl, logBrokerWhatsAppContact } from "../lib/brokerWhatsApp";

/**
 * The listing view's palette — MovEazy's emerald, not the slate-and-red mix this
 * screen had grown. Declared once so a colour can't drift per section again.
 */
const T = {
  ink: "#04211D",        // header and deep surfaces
  inkSoft: "#0A3A33",
  teal: "#0E7C68",       // primary action
  tealDark: "#0B6353",
  mint: "#5EEAD4",       // accent on dark grounds
  mintSoft: "#E4F6F1",   // accent tint on light grounds
  cream: "#F7FAF8",      // page ground
  card: "#FFFFFF",
  line: "#DCE8E5",
  lineSoft: "#EDF3F1",
  text: "#12211E",
  textDim: "#4A5B57",
  textMute: "#7A8F8A",
  gold: "#B0740F",
  goldSoft: "#FBF3E4",
  coral: "#CC3F28",
  coralSoft: "#FBEEEB",
};

/** Viewing hours a lister would plausibly agree to. */
const SUGGEST_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

const hourLabel = (h) => {
  const period = h >= 12 ? "PM" : "AM";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:00 ${period}`;
};

/**
 * "Suggest Date & Time" — pick a day, then a time on that day.
 *
 * Replaces a free-text box that accepted anything: "tomorrow eve", "asap",
 * "5", each of which someone then had to interpret before they could act on
 * it. Reports a formatted string upward so the request it feeds is unchanged.
 */
function SuggestDateTime({ value, onChange, tokens }) {
  const T = tokens;
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(null);

  const days = useMemo(() => {
    const out = [];
    const base = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      d.setHours(0, 0, 0, 0);
      out.push(d);
    }
    return out;
  }, []);

  const dayLabel = (d, i) => {
    if (i === 0) return "Today";
    if (i === 1) return "Tomorrow";
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  };

  const choose = (d, hour) => {
    const picked = new Date(d);
    picked.setHours(hour, 0, 0, 0);
    onChange(
      `${picked.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}, ${hourLabel(hour)}`,
    );
    setOpen(false);
    setDay(null);
  };

  const chip = (on) => ({
    padding: "8px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700,
    cursor: "pointer", whiteSpace: "nowrap",
    background: on ? T.mintSoft : "#fff",
    border: `1.5px solid ${on ? T.teal : T.line}`,
    color: on ? T.teal : T.textDim,
  });

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", padding: "12px 14px", borderRadius: 8, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          border: `1px solid ${value ? T.teal : T.line}`,
          background: "#fff", color: value ? T.text : T.textMute,
          fontSize: 14, fontWeight: value ? 700 : 500, textAlign: "left",
        }}
      >
        {value || "Suggest Date & Time"}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div style={{ marginTop: 8, border: `1px solid ${T.line}`, borderRadius: 10, padding: 10, background: T.cream }}>
          <p style={{ margin: "0 0 7px", fontSize: 11.5, fontWeight: 700, color: T.textMute, letterSpacing: ".04em" }}>
            {day ? "PICK A TIME" : "PICK A DAY"}
          </p>

          {!day ? (
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", maxHeight: 132, overflowY: "auto" }}>
              {days.map((d, i) => (
                <button key={d.toISOString()} type="button" onClick={() => setDay(d)} style={chip(false)}>
                  {dayLabel(d, i)}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", maxHeight: 132, overflowY: "auto" }}>
                {SUGGEST_HOURS.map((h) => (
                  <button key={h} type="button" onClick={() => choose(day, h)} style={chip(false)}>
                    {hourLabel(h)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setDay(null)}
                style={{ marginTop: 9, fontSize: 12, fontWeight: 700, color: T.teal, background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                ← Back to days
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

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
  const { openLogin } = useLoginModal();
  const [visitForm, setVisitForm] = useState({ time: "", notes: "" });
  const [visitSuccess, setVisitSuccess] = useState("");
  const [showVisitForm, setShowVisitForm] = useState(false);
  // The times the lister has actually published. Only these are offered — the
  // alternative is asking a renter to invent a time nobody agreed to.
  const [visitSlots, setVisitSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [chosenSlot, setChosenSlot] = useState("");
  const [booking, setBooking] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 768 : false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "unset"; };
  }, []);

  useEffect(() => {
    if (initialShowVisitForm) setShowVisitForm(true);
  }, [property?.id, initialShowVisitForm]);

  useEffect(() => {
    if (!property?.id) return;
    let alive = true;
    setSlotsLoading(true);
    setChosenSlot("");
    fetchOpenVisitsForProperty(property.id, { days: 21 })
      .then((rows) => { if (alive) setVisitSlots((rows || []).slice(0, 5)); })
      .catch(() => { if (alive) setVisitSlots([]); })
      .finally(() => { if (alive) setSlotsLoading(false); });
    return () => { alive = false; };
  }, [property?.id]);

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
  /**
   * "3 days ago" — how fresh a listing is, from created_at. Computed in an
   * effect rather than during render: reading the clock while rendering is
   * impure, and the value would drift between renders of the same view.
   */
  const [postedAgo, setPostedAgo] = useState("");
  useEffect(() => {
    const raw = property?.postedAt;
    if (!raw) return setPostedAgo("");
    const ms = Date.now() - new Date(raw).getTime();
    if (!Number.isFinite(ms) || ms < 0) return setPostedAgo("");
    const mins = Math.round(ms / 60000);
    if (mins < 60) return setPostedAgo(`${Math.max(mins, 1)} minute${mins === 1 ? "" : "s"} ago`);
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return setPostedAgo(`${hrs} hour${hrs === 1 ? "" : "s"} ago`);
    const days = Math.round(hrs / 24);
    if (days < 31) return setPostedAgo(`${days} day${days === 1 ? "" : "s"} ago`);
    setPostedAgo(new Date(raw).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }));
  }, [property?.postedAt]);

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
  // A figure we derived is not a figure the owner quoted. Say which is which
  // rather than presenting our arithmetic as the listing's terms.
  const depositIsEstimate = depositFromField == null;
  const maintenanceIsEstimate = maintenanceFromField == null;
  const formatInr = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN")}`;
  /** Just the amount — the "per month" is a separate label everywhere it shows. */
  const toggleSave = () => {
    const now = toggleSavedListing(user, property.id, property.title);
    setIsSaved(now);
    void logSavedListingChange(user, property.id, now, property.title);
    onSavedChange?.();
  };

  const photoBtnStyle = {
    position: "absolute", top: "12px", zIndex: 3,
    width: "38px", height: "38px", borderRadius: "50%",
    background: "rgba(255,255,255,0.94)", color: T.text,
    border: "none", display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", boxShadow: "0 2px 10px rgba(4,33,29,0.18)",
  };

  const rentDisplay = numericRent > 0 ? formatInr(numericRent) : String(property.price || "—").replace(/\s*\/\s*mo\b/i, "");
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

  const slotLabel = (iso) => {
    const d = new Date(iso);
    const day = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
    return { day, time };
  };

  /**
   * Book one of the lister's published slots.
   *
   * Writes a visit_bookings row, which is the record everything else reads:
   * my_recent_activity() puts it in the lister's notification bell, and a
   * trigger files it into the CRM against this client. Nothing here has to
   * remember to notify anyone.
   */
  const confirmSlot = async () => {
    if (!chosenSlot || offMarket) return;
    // Signing in mid-flow shouldn't lose the slot they picked.
    if (!user) { openLogin?.(() => confirmSlot()); return; }
    setBooking(true);
    try {
      await bookIndividual(user.uid, property.id, chosenSlot);
      const { day, time } = slotLabel(chosenSlot);
      setVisitSuccess(`Visit booked for ${day} at ${time}. The lister has been notified.`);
    } catch (err) {
      setVisitSuccess("");
      alert(err?.message || "Could not book that slot — please try another.");
    } finally {
      setBooking(false);
    }
  };

  /**
   * For a listing with no published times: register the interest with no slot.
   * The lister is told someone wants to view and still needs to offer a time,
   * and the CRM shows it as a visit awaiting scheduling.
   */
  const bookNextAvailable = async () => {
    if (offMarket) return;
    if (!user) { openLogin?.(() => bookNextAvailable()); return; }
    setBooking(true);
    try {
      await requestNextAvailableVisit(user.uid, property.id);
      setVisitSuccess("Requested. The lister will confirm a time with you shortly.");
    } catch (err) {
      alert(err?.message || "Could not send that request — please try again.");
    } finally {
      setBooking(false);
    }
  };

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
    background: T.lineSoft,
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 600,
    color: T.textDim,
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
    if (!el) return;
    // scrollIntoView walks the real ancestor chain. offsetTop measures from the
    // nearest *positioned* ancestor, which isn't the scroll container, so the
    // old maths landed somewhere arbitrary — usually not moving at all, which
    // made Schedule Visit look broken.
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed", top: 0, left: 0, right: 0,
          // The app's own bottom bar is fixed at z-index 190; stopping short of
          // it keeps that nav visible and working rather than covering it and
          // drawing a fake one.
          bottom: isMobile ? "calc(62px + env(safe-area-inset-bottom, 0px))" : 0,
          zIndex: 99999, background: "rgba(4, 33, 29, 0.94)",
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
            background: T.cream, width: "100%", maxWidth: "1100px", height: isMobile ? "95vh" : "90vh",
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
              background: T.ink,
              borderBottom: `1px solid ${T.inkSoft}`,
              zIndex: 10,
            }}
          >
            <div style={{ display: "flex", gap: isMobile ? "10px" : "16px", alignItems: "center", minWidth: 0, flex: "1 1 auto" }}>
              <div
                onClick={() => onClose()}
                style={{ cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}
              >
                <img
                  src={logoMint}
                  alt="MovEazy"
                  draggable={false}
                  style={{ height: isMobile ? "24px" : "30px", width: "auto", display: "block" }}
                />
              </div>
{!isMobile && (
              <div style={{ display: "flex", gap: isMobile ? "10px" : "16px", color: T.line, fontWeight: 600, fontSize: isMobile ? "12px" : "14px", flexWrap: "wrap", minWidth: 0 }}>
                <span onClick={() => scrollTo("overview")} style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = T.mint} onMouseLeave={(e) => e.target.style.color = T.line}>Overview</span>
                {nearbyListings.length > 0 && typeof onSelectListing === "function" ? (
                  <span onClick={() => scrollTo("nearby-homes")} style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = T.mint} onMouseLeave={(e) => e.target.style.color = T.line}>Nearby</span>
                ) : null}
                <span onClick={() => scrollTo("facts")} style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = T.mint} onMouseLeave={(e) => e.target.style.color = T.line}>Facts & Features</span>
              </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0, marginLeft: "auto" }}>
              <button
                type="button"
                onClick={toggleSave}
                style={{ display: isMobile ? "none" : "block", background: "rgba(255,255,255,0.05)", border: `1px solid ${T.inkSoft}`, borderRadius: "8px", padding: "6px 12px", fontWeight: 600, fontSize: "13px", cursor: "pointer", color: isSaved ? T.teal : T.lineSoft, transition: "all 0.2s" }}
                onMouseEnter={(e) => {
                  if (!isSaved) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                    e.currentTarget.style.borderColor = T.textMute;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSaved) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                    e.currentTarget.style.borderColor = T.textDim;
                  }
                }}
              >
                {isMobile ? (isSaved ? "♥" : "♡") : (isSaved ? "♥ Saved" : "♡ Save")}
              </button>
              <button type="button" onClick={handleShare} style={{ display: isMobile ? "none" : "block", background: "rgba(255,255,255,0.05)", border: `1px solid ${T.inkSoft}`, borderRadius: "8px", padding: "6px 12px", fontWeight: 600, fontSize: "13px", cursor: "pointer", color: T.lineSoft, transition: "all 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.borderColor = T.textMute; }} onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = T.textDim; }}>
                {isMobile ? "↗" : shareText}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "999px",
                  border: `1px solid ${T.inkSoft}`,
                  background: "rgba(255,255,255,0.05)",
                  color: T.lineSoft,
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
                background: T.goldSoft,
                borderBottom: "1px solid #fcd34d",
                color: T.gold,
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
                background: T.cream,
                borderBottom: `1px solid ${T.line}`,
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: isMobile ? 240 : 380,
                  flexShrink: 0,
                  overflow: "hidden",
                  background: T.ink,
                  borderRadius: "14px",
                }}
              >
                <MediaElement src={images[activeMediaIndex]} alt={property.title} firstImage={firstImageUrl} style={{ width: "100%", height: "100%", objectFit: "contain" }} />

                {/* Navigation lives on the photo, as the design has it — which
                    is also what lets the header shrink to just the logo. */}
                {isMobile && (
                  <>
                    <button
                      type="button"
                      aria-label="Back"
                      onClick={() => onClose()}
                      style={{ ...photoBtnStyle, left: "12px" }}
                    >
                      <ArrowLeft size={20} strokeWidth={2.2} />
                    </button>
                    <div style={{ position: "absolute", top: "12px", right: "12px", zIndex: 3, display: "flex", gap: "8px" }}>
                      <button type="button" aria-label="Share" onClick={handleShare} style={{ ...photoBtnStyle, position: "static" }}>
                        <Share2 size={18} strokeWidth={2.2} />
                      </button>
                      <button
                        type="button"
                        aria-label={isSaved ? "Saved" : "Save"}
                        onClick={toggleSave}
                        style={{ ...photoBtnStyle, position: "static", color: isSaved ? T.coral : T.text }}
                      >
                        <Heart size={18} strokeWidth={2.2} fill={isSaved ? T.coral : "none"} />
                      </button>
                    </div>
                  </>
                )}

                <div
                  style={{
                    position: "absolute", left: "12px", bottom: "12px", zIndex: 3,
                    display: "flex", alignItems: "center", gap: "6px",
                    background: "rgba(4,33,29,0.72)", color: "#fff",
                    borderRadius: "8px", padding: "5px 10px",
                    fontSize: "12px", fontWeight: 700,
                  }}
                >
                  <Images size={14} strokeWidth={2.2} />
                  {activeMediaIndex + 1} / {images.length}
                </div>

                {isActiveVideo && (
                  <div style={{ position: "absolute", top: "10px", left: "10px", zIndex: 2, background: "rgba(4,33,29,0.78)", color: "white", fontSize: "11px", fontWeight: 700, borderRadius: "999px", padding: "5px 9px" }}>
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
                      style={{ display: isMobile ? "none" : "block", position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "34px", height: "34px", borderRadius: "999px", border: `1px solid ${T.line}`, background: "rgba(255,255,255,0.92)", color: T.text, fontWeight: 700, zIndex: 10, cursor: "pointer", pointerEvents: "auto" }}
                      aria-label="Previous media"
                    >
                      {"<"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); goNextMedia(); }}
                      style={{ display: isMobile ? "none" : "block", position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", width: "34px", height: "34px", borderRadius: "999px", border: `1px solid ${T.line}`, background: "rgba(255,255,255,0.92)", color: T.text, fontWeight: 700, zIndex: 10, cursor: "pointer", pointerEvents: "auto" }}
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
                        background: idx === activeMediaIndex ? T.textDim : T.line,
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
                          border: idx === activeMediaIndex ? `2px solid ${T.teal}` : `1px solid ${T.line}`,
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
                  <div style={{ background: T.coralSoft, color: T.teal, padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 700, display: "inline-block", marginBottom: "12px" }}>
                    {property.badge.toUpperCase()}
                  </div>
                )}
                                <h1 style={{ fontSize: isMobile ? "22px" : "28px", margin: "0 0 8px", fontWeight: 800, color: T.text, lineHeight: 1.2 }}>{property.title}</h1>
                {postedAgo && (
                  <p style={{ margin: "0 0 8px", fontSize: "12.5px", color: T.textMute, fontWeight: 600 }}>
                    Posted {postedAgo}
                  </p>
                )}
                <p style={{ display: "flex", alignItems: "flex-start", gap: "7px", fontSize: "14.5px", color: T.textDim, margin: "0 0 16px", lineHeight: 1.45 }}>
                  <MapPin size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: "2px", color: T.textMute }} />
                  <span>{property.address || property.areas || "Location not provided"}</span>
                </p>

                {/* Rent and deposit are the pair every renter compares on. */}
                <div
                  style={{
                    display: "flex", alignItems: "stretch", gap: "18px",
                    margin: "0 0 18px", paddingBottom: "18px",
                    borderBottom: `1px solid ${T.line}`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: isMobile ? "22px" : "28px", fontWeight: 800, color: T.text, lineHeight: 1.1, whiteSpace: "nowrap" }}>{rentDisplay}</div>
                    <div style={{ fontSize: "13px", color: T.textMute, marginTop: "3px" }}>/ month</div>
                  </div>
                  <div style={{ width: "1px", background: T.line }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: isMobile ? "22px" : "28px", fontWeight: 800, color: depositIsEstimate ? T.textDim : T.text, lineHeight: 1.1, whiteSpace: "nowrap" }}>
                      {depositSidebar}
                    </div>
                    <div style={{ fontSize: "13px", color: T.textMute, marginTop: "3px" }}>
                      deposit{depositIsEstimate ? " (est.)" : ""}
                    </div>
                  </div>
                </div>

                {/* The four facts that decide whether a listing is even worth
                    reading — configuration, availability and who it's for. */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0,1fr))",
                    gap: "16px 12px", marginBottom: "26px",
                  }}
                >
                  {[
                    [BedDouble, property.bhk || "Home", property.propertyType || "Apartment"],
                    [Users, property.preferredTenants?.length ? property.preferredTenants[0] : "Anyone", "welcome"],
                    [HomeIcon, property.furnishing || "Unfurnished", "furnishing"],
                    [CalendarDays, property.availableFrom
                      ? new Date(property.availableFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                      : (property.availability || "Immediate"), "available from"],
                  ].map(([Icon, main, sub]) => (
                    <div key={sub} style={{ display: "flex", gap: "10px", alignItems: "flex-start", minWidth: 0 }}>
                      <Icon size={20} strokeWidth={1.9} style={{ flexShrink: 0, marginTop: "2px", color: T.text }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: T.text, lineHeight: 1.25 }}>{main}</div>
                        <div style={{ fontSize: "12.5px", color: T.textMute, lineHeight: 1.3 }}>{sub}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: isMobile ? "none" : "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
                  <div style={badgeStyles}>🏢 {property.propertyType || property.type || "Apartment"}</div>
                  <div style={badgeStyles}>🛏️ {property.bhk || "2 BHK"}</div>
                  <div style={badgeStyles}>🛋️ {property.furnishing || "Semi"}</div>
                  <div style={badgeStyles}>🚗 {property.parking && property.parking.length > 0 ? property.parking.join(", ") : "Available"}</div>
                  <div style={badgeStyles}>👨‍👩‍👧‍👦 {property.preferredTenants && property.preferredTenants.length > 0 ? property.preferredTenants.join(", ") : "Anyone"}</div>
                  <div
                    style={{
                      ...badgeStyles,
                      border: "1px solid #bbf7d0",
                      background: T.mintSoft,
                      color: T.teal,
                    }}
                  >
                    📅 {property.availability || "Immediate"}
                  </div>
                  {listedByLabel && (
                    <div
                      style={{
                        ...badgeStyles,
                        border: "1px solid #fbcfc4",
                        background: T.goldSoft,
                        color: T.gold,
                      }}
                    >
                      🏷️ Listed by {listedByLabel}
                    </div>
                  )}
                </div>

                <div style={{ background: T.cream, padding: "24px", borderRadius: "12px", marginBottom: "32px", border: `1px solid ${T.line}` }}>
                  <h2 style={{ margin: "0 0 12px", fontSize: "18px", color: T.text }}>About this property</h2>
                  <p style={{ margin: 0, fontSize: "15px", color: T.textDim, lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                    {property.description || "The owner hasn't written a description yet. Schedule a visit and we'll get you the details."}
                  </p>
                </div>

                {nearbyListings.length > 0 && typeof onSelectListing === "function" ? (
                  <div id="nearby-homes" style={{ marginBottom: "32px" }}>
                    <h2 style={{ margin: "0 0 8px", fontSize: "18px", color: T.text }}>Nearby homes</h2>
                    <p style={{ margin: "0 0 14px", fontSize: "14px", color: T.textMute, lineHeight: 1.5 }}>
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
                              border: `1px solid ${T.line}`,
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
                              <div style={{ height: "100px", background: T.lineSoft }} />
                            )}
                            <div style={{ padding: "10px 12px 12px" }}>
                              <div style={{ fontSize: "11px", fontWeight: 700, color: T.textMute, marginBottom: "4px" }}>{km} km away</div>
                              <div style={{ fontSize: "14px", fontWeight: 700, color: T.text, lineHeight: 1.35 }}>{n.title}</div>
                              <div style={{ fontSize: "12px", color: T.textMute, marginTop: "4px", lineHeight: 1.35 }}>{n.address}</div>
                              <div style={{ fontSize: "13px", fontWeight: 800, color: T.teal, marginTop: "6px" }}>{n.price || `₹ ${n.monthlyRent}`}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div id="facts" style={{ marginBottom: "32px" }}>
                  <h2 style={{ margin: "0 0 16px", fontSize: "18px", color: T.text }}>Facts, features & policies</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div style={{ background: T.lineSoft, padding: "12px", borderRadius: "8px" }}>
                      <div style={{ fontSize: "12px", color: T.textMute, marginBottom: "4px" }}>Availability</div>
                      <div style={{ fontWeight: 600, color: T.text }}>{property.availability || "Immediate"}</div>
                    </div>
                    <div style={{ background: T.lineSoft, padding: "12px", borderRadius: "8px" }}>
                      <div style={{ fontSize: "12px", color: T.textMute, marginBottom: "4px" }}>Listed By</div>
                      <div style={{ fontWeight: 600, color: T.text }}>{property.seller || property.company || "Owner"}</div>
                    </div>
                    <div style={{ background: T.lineSoft, padding: "12px", borderRadius: "8px" }}>
                      <div style={{ fontSize: "12px", color: T.textMute, marginBottom: "4px" }}>Broker contact</div>
                      <div style={{ fontWeight: 600, color: T.text }}>
                        {showBrokerDirectLine
                          ? brokerCallLine
                          : "Not published on the public map — request a visit or apply and MovEazy coordinates with the broker."}
                      </div>
                    </div>
                    <div style={{ background: T.lineSoft, padding: "12px", borderRadius: "8px" }}>
                      <div style={{ fontSize: "12px", color: T.textMute, marginBottom: "4px" }}>Source</div>
                      <div style={{ fontWeight: 600, color: T.text }}>{property.source || "Direct"}</div>
                    </div>
                    <div style={{ background: T.lineSoft, padding: "12px", borderRadius: "8px" }}>
                      <div style={{ fontSize: "12px", color: T.textMute, marginBottom: "4px" }}>Coordinates</div>
                      <div style={{ fontWeight: 600, color: T.text }}>{property.lat && property.lng ? `${property.lat}, ${property.lng}` : "Not available"}</div>
                    </div>
                    <div style={{ background: T.lineSoft, padding: "12px", borderRadius: "8px" }}>
                      <div style={{ fontSize: "12px", color: T.textMute, marginBottom: "4px" }}>Move-in</div>
                      <div style={{ fontWeight: 600, color: T.text }}>{property.availableFrom || property.availability || "Immediate"}</div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: "32px", background: T.cream, borderRadius: "12px", border: `1px solid ${T.line}`, overflow: "hidden" }}>
                  <div style={{ padding: "14px 16px", fontSize: "18px", fontWeight: 700, color: T.text, borderBottom: `1px solid ${T.line}` }}>
                    Listing specifications <span style={{ fontSize: "13px", fontWeight: 500, color: T.textMute }}>(from listing / broker)</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0 20px", padding: "0 16px" }}>
                    {detailRows.map(([label, value], idx) => (
                      <div key={label} style={{ padding: "12px 0", borderBottom: idx < detailRows.length - 1 ? `1px solid ${T.line}` : "none" }}>
                        <div style={{ fontSize: "13px", color: T.textMute, marginBottom: "4px" }}>{label}</div>
                        <div style={{ fontSize: "15px", fontWeight: 600, color: T.text, wordBreak: "break-word" }}>
                          {label === "Source URL" && value !== "—" ? (
                            <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: T.teal }}>
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
                  <h2 style={{ margin: "0 0 12px", fontSize: "18px", color: T.text }}>Furnishings</h2>
                  {furnishings.length ? (
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0,1fr))", gap: "10px" }}>
                      {furnishings.map((item) => (
                        <div key={item} style={{ background: "white", border: `1px solid ${T.line}`, borderRadius: "10px", padding: "10px 12px", fontSize: "13px", fontWeight: 600, color: T.textDim }}>
                          {item}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: "14px", color: T.textMute }}>—</p>
                  )}
                </div>

                {Array.isArray(property.houseRules) && property.houseRules.length > 0 && (
                  <div style={{ marginBottom: "32px" }}>
                    <h2 style={{ margin: "0 0 12px", fontSize: "18px", color: T.text }}>House rules</h2>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {property.houseRules.map((rule) => (
                        <span
                          key={rule}
                          style={{
                            background: T.goldSoft, color: T.gold, padding: "8px 13px",
                            borderRadius: "999px", fontSize: "12.5px", fontWeight: 600,
                          }}
                        >
                          {rule}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: "32px" }}>
                  <h2 style={{ margin: "0 0 12px", fontSize: "18px", color: T.text }}>Amenities</h2>
                  {amenities.length ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                      {amenities.map((item) => (
                        <span key={item} style={{ background: T.lineSoft, color: T.textDim, padding: "8px 13px", borderRadius: "999px", fontSize: "12.5px", fontWeight: 600 }}>
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: "14px", color: T.textMute }}>—</p>
                  )}
                </div>
              </div>

              {/* Right Column (Sticky Action Card) */}
              <div style={{ flex: "1 1 320px", position: "relative" }}>
                <div id="book" style={{ position: "sticky", top: "32px", background: T.card, padding: "24px", borderRadius: "16px", border: `1px solid ${T.line}`, boxShadow: "0 10px 25px -5px rgba(4,33,29,0.06)" }}>
                  <div style={{ fontSize: "26px", fontWeight: 800, color: T.teal, marginBottom: "4px" }}>
                    {rentDisplay}
                  </div>
                  <div style={{ fontSize: "13px", color: T.textMute, marginBottom: "20px" }}>Rent per month</div>

                  <div style={{ background: T.cream, border: `1px solid ${T.line}`, borderRadius: "10px", padding: "12px", marginBottom: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: T.textDim, marginBottom: "6px" }}>
                      <span>Security deposit</span><strong style={{ color: T.text }}>{depositSidebar}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: T.textDim, marginBottom: "6px" }}>
                      <span>Maintenance{maintenanceIsEstimate ? " (est.)" : ""}</span><strong style={{ color: T.text }}>{maintenanceSidebar}</strong>
                    </div>

                  </div>

                  {showVisitForm ? (
                    <form onSubmit={submitVisit} style={{ display: "flex", flexDirection: "column", gap: "12px", opacity: offMarket ? 0.6 : 1, pointerEvents: offMarket ? "none" : "auto" }}>
                      <h3 style={{ margin: "0 0 8px", fontSize: "16px" }}>Schedule a Visit</h3>
                      {visitSuccess ? (
                        <div style={{ background: T.mintSoft, color: T.teal, padding: "12px", borderRadius: "8px", fontWeight: 600, textAlign: "center", fontSize: "13px" }}>
                          {visitSuccess}
                        </div>
                      ) : slotsLoading ? (
                        <p style={{ margin: 0, fontSize: 13, color: T.textMute }}>Loading visit times…</p>
                      ) : visitSlots.length > 0 ? (
                        <>
                          <p style={{ margin: "0 0 2px", fontSize: 13, color: T.textDim, lineHeight: 1.5 }}>
                            Pick a time the lister has opened up:
                          </p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {visitSlots.map((slot) => {
                              const { day, time } = slotLabel(slot.slot_at);
                              const on = chosenSlot === slot.slot_at;
                              return (
                                <button
                                  key={slot.id}
                                  type="button"
                                  onClick={() => setChosenSlot(slot.slot_at)}
                                  style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    gap: 10, padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                                    background: on ? T.mintSoft : "#fff",
                                    border: `1.5px solid ${on ? T.teal : T.line}`,
                                    color: T.text, textAlign: "left",
                                  }}
                                >
                                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>{day}</span>
                                  <span style={{ fontSize: 13.5, fontWeight: on ? 800 : 600, color: on ? T.teal : T.textDim }}>
                                    {time}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                            <button type="button" onClick={() => setShowVisitForm(false)} style={{ flex: 1, padding: "12px", background: T.lineSoft, color: T.textDim, border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                            <button
                              type="button"
                              onClick={confirmSlot}
                              disabled={!chosenSlot || booking}
                              style={{
                                flex: 2, padding: "12px", borderRadius: "8px", border: "none", fontWeight: 700,
                                background: chosenSlot ? T.teal : T.line,
                                color: chosenSlot ? "white" : T.textMute,
                                cursor: chosenSlot && !booking ? "pointer" : "not-allowed",
                              }}
                            >
                              {booking ? "Booking…" : chosenSlot ? "Confirm visit" : "Pick a time"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* No published slots. Rather than invent times nobody
                              agreed to, fall back to asking for one. */}
                          <p style={{ margin: "0 0 2px", fontSize: 13, color: T.textDim, lineHeight: 1.5 }}>
                            The lister hasn&apos;t published visit times for this home yet.
                          </p>
                          <button
                            type="button"
                            onClick={bookNextAvailable}
                            disabled={booking}
                            style={{
                              width: "100%", padding: "14px", borderRadius: 10, border: "none",
                              background: T.teal, color: "#fff", fontSize: 15, fontWeight: 700,
                              cursor: booking ? "not-allowed" : "pointer",
                            }}
                          >
                            {booking ? "Sending…" : "Book the next available slot"}
                          </button>
                          <p style={{ margin: "2px 0 0", fontSize: 12, color: T.textMute, lineHeight: 1.45 }}>
                            We&apos;ll ask them to open a time and confirm it with you. Or suggest one yourself:
                          </p>
                          <SuggestDateTime
                            tokens={T}
                            value={visitForm.time}
                            onChange={(time) => setVisitForm({ ...visitForm, time })}
                          />
                          <textarea rows={2} placeholder="Any questions?" value={visitForm.notes} onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: `1px solid ${T.line}`, boxSizing: "border-box", fontSize: "14px" }} />
                          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                            <button type="button" onClick={() => setShowVisitForm(false)} style={{ flex: 1, padding: "12px", background: T.lineSoft, color: T.textDim, border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                            <button
                              type="submit"
                              disabled={!visitForm.time}
                              style={{
                                flex: 2, padding: "12px", borderRadius: "8px", border: "none", fontWeight: 700,
                                background: visitForm.time ? T.teal : T.line,
                                color: visitForm.time ? "white" : T.textMute,
                                cursor: visitForm.time ? "pointer" : "not-allowed",
                              }}
                            >
                              {visitForm.time ? "Request" : "Pick a time"}
                            </button>
                          </div>
                        </>
                      )}
                    </form>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <button type="button" disabled={offMarket} onClick={() => !offMarket && setShowVisitForm(true)} style={{ width: "100%", padding: "14px", background: offMarket ? T.line : T.teal, color: "white", border: "none", borderRadius: "8px", fontSize: "15px", fontWeight: 700, cursor: offMarket ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                        Schedule a visit
                      </button>
                      <button type="button" disabled={offMarket} onClick={() => !offMarket && setShowVisitForm(true)} style={{ width: "100%", padding: "14px", background: offMarket ? T.lineSoft : "white", color: offMarket ? T.textMute : T.teal, border: offMarket ? `1px solid ${T.line}` : `1px solid ${T.teal}`, borderRadius: "8px", fontSize: "15px", fontWeight: 700, cursor: offMarket ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                        {visitSlots.length > 0 ? `${visitSlots.length} times available` : "Check availability"}
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
                              background: T.cream,
                              color: T.text,
                              border: `1px solid ${T.line}`,
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
                              background: T.mintSoft,
                              color: T.teal,
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
                            color: T.textDim,
                            background: T.cream,
                            border: `1px solid ${T.line}`,
                            textAlign: "center",
                            lineHeight: 1.45,
                          }}
                        >
                          Broker numbers are protected. Use <strong>Request a tour</strong> or <strong>Apply</strong> — our team connects you after verification.
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: "20px", display: "flex", gap: "12px", alignItems: "flex-start", background: T.cream, padding: "12px", borderRadius: "8px" }}>
                    <div style={{ fontSize: "20px" }}>💡</div>
                    <div style={{ fontSize: "12px", color: T.textDim, lineHeight: "1.5" }}>
                      <strong>MovEazy Guarantee available.</strong> Avoid unfair deductions and secure your deposit with our legal support.
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* On a phone the action card sits far below the photos and the
                description, so the two things a renter actually does are pinned
                to the bottom instead — matching the app's own bottom bar. */}
            {isMobile && (
              <div
                style={{
                  position: "sticky", bottom: 0, zIndex: 20,
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 14px calc(10px + env(safe-area-inset-bottom))",
                  background: T.card, borderTop: `1px solid ${T.line}`,
                  boxShadow: "0 -6px 20px rgba(4,33,29,0.08)",
                }}
              >
                <button
                  type="button"
                  disabled={offMarket}
                  onClick={() => { if (!offMarket) { setShowVisitForm(true); scrollTo("book"); } }}
                  style={{
                    flex: 1, padding: "15px", borderRadius: "12px", border: "none",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                    background: offMarket ? T.line : T.coral, color: "#fff",
                    fontSize: "16px", fontWeight: 700,
                    cursor: offMarket ? "not-allowed" : "pointer",
                  }}
                >
                  <CalendarCheck size={19} strokeWidth={2.1} />
                  {offMarket ? "Off market" : "Schedule Visit"}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
