import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import Navbar from "./src/components/layout/Navbar";
import PageShell from "./src/components/layout/PageShell";
import Footer from "./src/components/layout/Footer";
import { useAuth } from "./src/context/AuthContext";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "./src/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, orderBy, limit, startAfter, getDocs } from "firebase/firestore";
import { getListingImages, getListingPrivateData } from "./src/lib/firestoreStore";
import { openBrokerWhatsApp } from "./src/lib/brokerWhatsApp";
import SmartImage from "./src/components/SmartImage";
import { ref, getDownloadURL, listAll } from "firebase/storage";
import { storage } from "./src/lib/firebase";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE   = 50;
const BENGALURU_CENTER = [12.9716, 77.5946];
const BENGALURU_BOUNDS = [[12.75, 77.38], [13.18, 77.82]];
const BRAND_RED  = "#ff3131";
const BRAND_INK  = "#1c1917";

// ─── Data ─────────────────────────────────────────────────────────────────────
const AMENITY_LABELS = {
  ac: "AC", wifi: "WiFi", parking: "Parking", microwave: "Microwave",
  refrigerator: "Fridge", washing_machine: "Washing Machine",
  dining_table: "Dining Table", sofa: "Sofa", tv: "TV",
};
// No emoji icons in cards per design request — render text-only labels
const AMENITY_ICONS = {};
function normalizeAmenity(k) { return AMENITY_LABELS[k] || k; }

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60)    return "Just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86400);
  return days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`;
}

function useDebounce(val, ms = 280) {
  const [v, setV] = useState(val);
  useEffect(() => { const t = setTimeout(() => setV(val), ms); return () => clearTimeout(t); }, [val, ms]);
  return v;
}

function processListings(raw) {
  return raw
    .filter(l => l.precise_coordinates?.x && l.precise_coordinates?.y)
    .map(l => ({
      id: l._docId || l.id,
      title: l.display_title || l.title || "",
      description: l.description || "",
      area: l.area || "",
      city: l.city || "",
      locationDetails: l.location_details || "",
      rent: Math.round(parseFloat(l.monthly_rent) || 0),
      deposit: l.security_deposit ? Math.round(parseFloat(l.security_deposit)) : null,
      bedrooms: l.bedroom_count || 1,
      bathrooms: l.bathroom_count || 1,
      furnished: !!l.is_furnished,
      amenities: Object.keys(l.amenities || {}).filter(k => l.amenities[k]).map(normalizeAmenity),
      houseRules: Object.keys(l.house_rules || {}).filter(k => l.house_rules[k]),
      gender: l.gender_preference || "any",
      images: ((l.images?.length ? l.images : [l.cover_image_url]) || []).filter(Boolean),
      coverImage: l.cover_image_url || l.images?.[0] || "",
      totalImages: l.totalImageCount || l.images?.length || 1,
      lat: l.precise_coordinates.y,
      lng: l.precise_coordinates.x,
      ownerName: l.owner_name || "Owner",
      ownerPicture: l.owner_picture || "",
      ownerPhone: l.owner_phone || l.contact_phone || l.phone || "",
      isVerified: !!l.is_verified,
      viewCount: l.view_count || 0,
      nearbyLocalities: (l.nearby_localities || []).slice(0, 3),
      createdAt: l.created_at,
      bumpedAt: l.bumped_at || l.created_at,
      slug: l.slug || "",
      maxFlatmates: l.max_flatmates || 1,
      currentFlatmates: l.current_flatmates || 0,
      listingType: (l.max_flatmates || 1) > 1 ? "flatmate" : "entire",
      sortTs: new Date(l.bumped_at || l.created_at || 0).getTime(),
    }));
}

const GENDER_CONFIG = {
  female: { label: "Female", cls: "text-rose-600 bg-rose-50 border-rose-200" },
  male:   { label: "Male",   cls: "text-sky-600 bg-sky-50 border-sky-200"   },
  any:    { label: "Co-ed",  cls: "text-gray-600 bg-gray-50 border-red-300" },
};

// ─── Map helpers ──────────────────────────────────────────────────────────────
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom, { animate: true, duration: 0.25 });
  }, [center, zoom, map]);
  return null;
}

function makeClusterIcon(count, isSelected) {
  return L.divIcon({
    html: `<div style="
      display:flex;align-items:center;gap:5px;
      background:#ffffff;color:#1c1917;
      padding:5px 11px 5px 8px;border-radius:20px;
      font-size:11px;font-weight:700;
      font-family:'Inter',sans-serif;white-space:nowrap;
      border:2px solid ${isSelected ? BRAND_INK : "#e5e7eb"};
      box-shadow:${isSelected ? "0 4px 16px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.15)"};
      ${isSelected ? "transform:scale(1.12);" : ""}
    ">
      <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background-color:#ff3131;flex-shrink:0;"></span>
      ${count} flat${count !== 1 ? "s" : ""}
    </div>`,
    className: "", iconSize: [84, 28], iconAnchor: [42, 14],
  });
}

// ─── Owner Avatar ─────────────────────────────────────────────────────────────
const OwnerAvatar = memo(function OwnerAvatar({ src, name, size = 24 }) {
  const [err, setErr] = useState(false);
  const initial = name?.[0]?.toUpperCase() || "?";
  if (err || !src) {
    return (
      <div className="rounded-full text-white font-bold flex items-center justify-center shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.42, background: BRAND_RED }}>
        {initial}
      </div>
    );
  }
  return <img src={src} alt={name} onError={() => setErr(true)}
    className="rounded-full object-cover shrink-0 bg-gray-100" style={{ width: size, height: size }} />;
});

// ─── Listing Card (FlatX style) ───────────────────────────────────────────────
const ListingCard = memo(function ListingCard({ property, onClick, compact }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [liked, setLiked]   = useState(false);
  const _gender = GENDER_CONFIG[property.gender] || GENDER_CONFIG.any;
  const visibleAmenities = property.amenities.slice(0, compact ? 2 : 3);
  const extra = property.amenities.length - visibleAmenities.length;
  const imgH = compact ? "h-44" : "h-56";

  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 shadow-sm border border-red-300 flex flex-col h-full"
      style={{ touchAction: 'manipulation' }}
    >
      {/* Image */}
      <div className={`relative ${imgH} flex-shrink-0 overflow-hidden bg-gray-100`}>
        {property.images.length > 0
          ? <SmartImage src={property.images[imgIdx] || property.images[0]} alt={property.title}
              listingId={property.id}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy" decoding="async" />
          : <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
              </svg>
            </div>
        }

        {/* Image dots — only as many as images actually loaded */}
        {property.images.length > 1 && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1">
            {property.images.map((_, i) => (
              <div key={i} onClick={e => { e.stopPropagation(); setImgIdx(i); }}
                className={`rounded-full transition-all cursor-pointer ${i === imgIdx ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/60"}`} />
            ))}
          </div>
        )}

        {/* Heart */}
        <button onClick={e => { e.stopPropagation(); setLiked(l => !l); }}
          className="absolute top-2.5 right-2.5 w-8 h-8 bg-white rounded-full shadow-sm flex items-center justify-center hover:scale-110 transition-transform">
          <svg className="w-4 h-4 transition-colors" fill={liked ? BRAND_RED : "none"} stroke={liked ? BRAND_RED : "currentColor"} strokeWidth="2" viewBox="0 0 24 24"
            style={{ color: liked ? BRAND_RED : "#9ca3af" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        {/* Verified */}
        {property.isVerified && (
          <div className="absolute top-2.5 left-2.5 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
            ✓ Verified
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3.5 flex-1 flex flex-col justify-between border-2 border-red-700">
        {/* Title */}
        <h3 className="font-bold text-[#1c1917] text-sm leading-snug mb-3 line-clamp-2">
          {property.title}
        </h3>

        {/* Rent - Large & prominent */}
        <div className="mb-3">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold mb-1">Rent per month</p>
          <div className="flex items-baseline gap-2">
            <p className="text-xl font-bold text-[#1c1917]">₹{(property.rent / 1000).toFixed(0)}k</p>
            <p className="text-[11px] text-gray-500">+ ₹{property.deposit ? (property.deposit / 1000).toFixed(0) : '0'}k deposit</p>
          </div>
        </div>

        {/* Key Details Grid */}
        <div className="grid grid-cols-3 gap-2 mb-3 pb-3 border-b border-red-300">
          <div>
            <p className="text-[9px] text-gray-400 uppercase tracking-wide font-medium mb-0.5">Bedrooms</p>
            <p className="text-[13px] font-bold text-[#1c1917]">{property.bedrooms} BHK</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-400 uppercase tracking-wide font-medium mb-0.5">Type</p>
            <p className="text-[13px] font-bold text-[#1c1917]">Furnished</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-400 uppercase tracking-wide font-medium mb-0.5">For</p>
            <p className="text-[13px] font-bold text-[#1c1917] capitalize">{property.gender}</p>
          </div>
        </div>

        {/* Quick Info */}
        {visibleAmenities.length > 0 && (
          <div className="mb-3">
            <p className="text-[9px] text-gray-400 uppercase tracking-wide font-medium mb-1.5">Amenities</p>
            <div className="flex flex-wrap gap-1.5">
              {visibleAmenities.map(a => (
                <span key={a} className="text-[10px] font-medium text-gray-600 bg-gray-50 px-2 py-1 rounded-lg border border-red-300">
                  {a}
                </span>
              ))}
              {extra > 0 && (
                <span className="text-[10px] font-medium text-gray-500 px-2 py-1">+{extra} more</span>
              )}
            </div>
          </div>
        )}

        {/* Owner row */}
        <div className="flex items-center gap-2 pt-2.5 border-t border-red-300">
          <OwnerAvatar src={property.ownerPicture} name={property.ownerName} size={20} />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-600 truncate font-medium">{property.ownerName}</p>
            <p className="text-[9px] text-gray-400">{timeAgo(property.bumpedAt || property.createdAt)}</p>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={e => { e.stopPropagation(); onClick(); }}
          className="mt-3 w-full py-2.5 rounded-xl text-xs font-bold text-white tracking-wide transition-opacity hover:opacity-90"
          style={{ background: BRAND_RED }}
        >
          Check Availability →
        </button>
      </div>
    </div>
  );
});

// ─── Photo Gallery Lightbox ───────────────────────────────────────────────────
function PhotoGallery({ photos, startIdx = 0, onClose }) {
  const [idx, setIdx] = useState(startIdx);
  const total = photos.length;

  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowLeft")  setIdx(i => (i - 1 + total) % total);
      if (e.key === "ArrowRight") setIdx(i => (i + 1) % total);
      if (e.key === "Escape")     onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, onClose]);

  const thumbRef = useRef(null);
  useEffect(() => {
    const el = thumbRef.current?.children[idx];
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [idx]);

  return (
    <div className="fixed inset-0 flex flex-col" style={{ zIndex: 4000, background: "rgba(0,0,0,0.95)" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0">
        <span className="text-white/70 text-sm font-medium">{idx + 1} / {total}</span>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Main image */}
      <div className="flex-1 flex items-center justify-center relative min-h-0 px-14">
        <AnimatePresence mode="wait">
          <motion.img
            key={idx}
            src={photos[idx]}
            alt={`Photo ${idx + 1}`}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="max-h-full max-w-full object-contain rounded-xl select-none"
            style={{ maxHeight: 'calc(100vh - 180px)' }}
          />
        </AnimatePresence>

        {/* Prev */}
        {total > 1 && (
          <button onClick={() => setIdx(i => (i - 1 + total) % total)}
            className="absolute left-2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {/* Next */}
        {total > 1 && (
          <button onClick={() => setIdx(i => (i + 1) % total)}
            className="absolute right-2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      <div ref={thumbRef} className="flex gap-2 px-4 py-3 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
        {photos.map((src, i) => (
          <button key={i} onClick={() => setIdx(i)}
            className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === idx ? "border-white scale-105" : "border-transparent opacity-50 hover:opacity-80"}`}>
            <img src={src} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Contact click tracker ────────────────────────────────────────────────────
async function trackContactClick(property, user) {
  try {
    await addDoc(collection(db, "listingContactClicks"), {
      propertyId:    String(property.id    || ""),
      propertyTitle: String(property.title  || ""),
      propertyArea:  String(property.area   || ""),
      ownerEmail:    String(property.ownerEmail || property.owner_email || ""),
      clickerEmail:  String(user?.email || ""),
      clickerName:   String(user?.name  || ""),
      createdAt:     serverTimestamp(),
    });
  } catch { /* silent */ }
}

async function handleBrokerWhatsApp(property, user) {
  const activeUser = (() => {
    if (user?.email) return user;
    try {
      const cached = sessionStorage.getItem("moveasy_session_user");
      return cached ? JSON.parse(cached) : user;
    } catch {
      return user;
    }
  })();

  trackContactClick(property, activeUser);

  let privatePhone = "";
  if (property?.id) {
    try {
      const priv = await getListingPrivateData(String(property.id));
      privatePhone = String(priv?.agentPhone || priv?.ownerPhone || "").trim();
    } catch {
      /* best-effort */
    }
  }

  try {
    const rent = Number(property.rent);
    await addDoc(collection(db, "listing_leads"), {
      name: String(activeUser?.name || "").trim(),
      phone: String(activeUser?.phone || "").trim(),
      email: String(activeUser?.email || ""),
      propertyId: String(property.id || ""),
      propertyTitle: String(property.title || ""),
      propertyArea: String(property.area || ""),
      rent: Number.isFinite(rent) ? rent : 0,
      ownerName: String(property.ownerName || ""),
      ownerEmail: String(property.ownerEmail || property.owner_email || ""),
      sellerEmail: String(property.ownerEmail || property.owner_email || ""),
      source: "whatsapp_redirect",
      createdAt: serverTimestamp(),
    });
  } catch {
    /* silent — WhatsApp redirect still proceeds */
  }

  const opened = await openBrokerWhatsApp({
    user: activeUser,
    property,
    privatePhone,
    source: "flat_listings_contact_button",
  });
  if (!opened) {
    window.alert("Broker WhatsApp is not available for this listing yet. Please try another listing or contact Moveazy support.");
  }
}

// ─── Detail Modal (full-page style) ──────────────────────────────────────────
const DetailModal = memo(function DetailModal({ property, onClose, requireAuth }) {
  const { user } = useAuth();
  const [galleryIdx, setGalleryIdx]   = useState(null);
  const [allPhotos, setAllPhotos]     = useState(property.images);
  const [copied, setCopied]           = useState(false);
  const [waBusy, setWaBusy]           = useState(false);

  const openWhatsApp = useCallback(() => {
    requireAuth(async () => {
      setWaBusy(true);
      try {
        await handleBrokerWhatsApp(property, user);
      } finally {
        setWaBusy(false);
      }
    });
  }, [property, requireAuth, user]);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}${window.location.pathname}?listing=${property.slug || property.id}`;
    const shareData = { title: property.title, text: `Check out this flat: ${property.title}`, url };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* user dismissed */ }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [property.slug, property.id, property.title]);

  // Fetch full image list and resolve Firebase Storage paths to download URLs
  useEffect(() => {
    setAllPhotos(property.images);
    if (!property.id) return;
    // "listings/uuid-ts-nonce.jpg" → "listings/uuid/uuid-ts-nonce.jpg"
    function toFolderPath(p) {
      const m = p.match(/^(listings\/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(-.+)$/i);
      return m ? `${m[1]}${m[2]}/${m[2]}${m[3]}` : null;
    }

    async function resolveUrls(paths) {
      // Pre-fetch listing folder contents once for Flatx images
      let folderItems = [];
      if (property.id && paths.some(p => /flatxstoragev1\.blob\.core\.windows\.net/i.test(p))) {
        try {
          const result = await listAll(ref(storage, `listings/${property.id}`));
          folderItems = result.items.sort((a, b) => a.name.localeCompare(b.name));
        } catch { /* storage unavailable */ }
      }

      let flatxIdx = 0;
      const results = [];
      for (const path of paths) {
        if (/flatxstoragev1\.blob\.core\.windows\.net/i.test(path)) {
          // Use listing folder file by index (same order as Flatx images)
          const item = folderItems[flatxIdx++];
          if (item) {
            try { results.push(await getDownloadURL(item)); continue; } catch { /* try flat path */ }
          }
          // Fall back to flat paths
          const filename = path.split("/").pop().split("?")[0];
          let resolved = path;
          for (const p of [`listings/${filename}`, `listings-images/${filename}`]) {
            try { resolved = await getDownloadURL(ref(storage, p)); break; } catch { /* try next */ }
          }
          results.push(resolved);
        } else if (/^https?:\/\//i.test(path)) {
          results.push(path);
        } else {
          // Firebase Storage path — try folder path first, then flat
          const folderPath = toFolderPath(path);
          if (folderPath) {
            try { results.push(await getDownloadURL(ref(storage, folderPath))); continue; } catch { /* try flat path */ }
          }
          try { results.push(await getDownloadURL(ref(storage, path))); } catch { results.push(path); }
        }
      }
      return results;
    }
    getListingImages(property.id)
      .then(imgs => resolveUrls(imgs.length > 0 ? imgs : property.images))
      .catch(() => resolveUrls(property.images))
      .then(resolved => setAllPhotos(resolved));
  }, [property.id]);

  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);
  if (!property) return null;

  const photos = allPhotos;
  const openGallery = (i = 0) => setGalleryIdx(i);
  const spotsLeft = property.maxFlatmates - property.currentFlatmates;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 overflow-y-auto"
      style={{ background: '#faf5ef', fontFamily: "'Inter', sans-serif", zIndex: 2000 }}
    >
      {/* Sticky top nav */}
      <div className="sticky top-0 flex items-center justify-between px-6 md:px-10 py-3 border-b border-[#e8ddd0]" style={{ background: '#faf5ef', zIndex: 2001 }}>
        <button onClick={onClose} className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to listings
        </button>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#e8ddd0] hover:bg-[#ddd0c0] transition-colors">
          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-6 md:px-10 pt-6 pb-20">
        {/* Photo grid — adapts to however many photos exist */}
        {(() => {
          const thumbs = photos.slice(1, 5); // up to 4 thumbnails
          const hasMore = photos.length > 5;
          // Determine right-panel grid rows: 1 row if 1-2 thumbs, 2 rows if 3-4 thumbs
          const thumbRows = thumbs.length <= 2 ? 1 : 2;
          const thumbCols = thumbs.length === 1 ? 1 : 2;
          return (
            <div className="rounded-2xl overflow-hidden mb-3"
              style={{
                display: 'grid',
                gridTemplateColumns: thumbs.length === 0 ? '1fr' : '1.4fr 1fr',
                gap: 6, height: 360,
              }}>
              {/* Hero */}
              <div className="overflow-hidden bg-gray-100 cursor-pointer" onClick={() => openGallery(0)}>
                <img src={photos[0]} alt={property.title} className="w-full h-full object-cover hover:brightness-95 transition-all" />
              </div>
              {/* Thumbnails panel */}
              {thumbs.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${thumbCols}, 1fr)`, gridTemplateRows: `repeat(${thumbRows}, 1fr)`, gap: 6 }}>
                  {thumbs.map((src, ti) => {
                    const photoIdx = ti + 1;
                    const isLast = ti === thumbs.length - 1;
                    return (
                      <div key={ti} className="relative overflow-hidden bg-gray-100 cursor-pointer" onClick={() => openGallery(photoIdx)}>
                        <img src={src} alt="" className="w-full h-full object-cover hover:brightness-95 transition-all" />
                        {/* "Show all" overlay on the last thumbnail when more photos exist */}
                        {isLast && hasMore && (
                          <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                            <button onClick={e => { e.stopPropagation(); openGallery(photoIdx); }}
                              className="bg-white rounded-xl px-3 py-1.5 text-xs font-bold text-gray-800 flex items-center gap-1.5 shadow">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                              </svg>
                              +{photos.length - 5} more
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* "Show all" button below grid */}
        {photos.length > 1 && (
          <div className="flex justify-end mb-4">
            <button onClick={() => openGallery(0)}
              className="flex items-center gap-1.5 bg-white border border-red-300 rounded-xl px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Show all {photos.length} photos
            </button>
          </div>
        )}

        {/* Main two-column layout */}
        <div className="flex gap-8 items-start">

          {/* ── Left content ── */}
          <div className="flex-1 min-w-0">

            {/* Title + action buttons */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <h1 className="text-2xl font-bold text-[#1c1917] leading-snug">{property.title}</h1>
              <div className="flex items-center gap-2 shrink-0">
                <button className="flex items-center gap-1.5 border border-red-300 bg-white rounded-full px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                  Save
                </button>
                <button onClick={handleShare} className="flex items-center gap-1.5 border border-red-300 bg-white rounded-full px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  {copied ? "Copied!" : "Share"}
                </button>
              </div>
            </div>

            {/* Meta tags */}
            <div className="flex items-center flex-wrap gap-4 text-sm text-gray-500 mb-6">
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                {property.area || property.locationDetails}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75L12 3l9 6.75V21a.75.75 0 01-.75.75H15v-6H9v6H3.75A.75.75 0 013 21V9.75z" />
                </svg>
                {property.bedrooms} BHK
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
                </svg>
                {property.furnished ? 'Entire Flat' : 'Unfurnished'}
              </span>
            </div>

            {/* Rent / Deposit */}
            <div className="flex border border-red-300 rounded-2xl overflow-hidden mb-6 bg-white divide-x divide-red-300">
              <div className="flex-1 px-6 py-5">
                <p className="text-xs text-gray-400 font-medium mb-1.5">Total Rent</p>
                <p className="text-2xl font-bold text-[#1c1917]">₹{property.rent.toLocaleString('en-IN')}</p>
              </div>
              <div className="flex-1 px-6 py-5">
                <p className="text-xs text-gray-400 font-medium mb-1.5">Total Deposit</p>
                <p className="text-2xl font-bold text-[#1c1917]">
                  {property.deposit ? `₹${property.deposit.toLocaleString('en-IN')}` : '~'}
                </p>
              </div>
            </div>

            {/* Amenities */}
            {property.amenities.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {property.amenities.map(a => (
                  <span key={a} className="flex items-center gap-2 border border-red-300 bg-white rounded-full px-4 py-2 text-sm font-medium text-gray-700">
                    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {a}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            {property.description && (
              <p className="text-sm text-gray-600 leading-relaxed mb-6">
                {property.description}
              </p>
            )}

            {/* House Rules */}
            {property.houseRules.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {property.houseRules.map(r => (
                  <span key={r} className="flex items-center gap-1.5 border border-red-300 bg-white rounded-full px-4 py-2 text-sm font-medium text-gray-600">
                    <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {r}
                  </span>
                ))}
              </div>
            )}

            {/* Nearby */}
            {property.nearbyLocalities.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Nearby</p>
                <div className="flex flex-col divide-y divide-red-100 border border-red-300 rounded-2xl overflow-hidden bg-white">
                  {property.nearbyLocalities.map(n => (
                    <div key={n.name} className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-gray-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: BRAND_RED }} />{n.name}
                      </span>
                      <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full border border-red-200">{n.distance}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span>Bumped {timeAgo(property.bumpedAt)}</span>
              <span>|</span>
              <span>Posted {timeAgo(property.createdAt)}</span>
            </div>
          </div>

          {/* ── Right sidebar ── */}
          <div className="w-72 shrink-0 hidden md:block">
            <div className="rounded-2xl p-5 sticky top-20" style={{ background: '#ede5d8' }}>
              <div className="flex items-center gap-3 mb-4">
                <OwnerAvatar src={property.ownerPicture} name={property.ownerName} size={44} />
                <p className="font-bold text-[#1c1917] text-sm leading-snug">Posted by {property.ownerName}</p>
              </div>
              {spotsLeft > 0 && (
                <p className="text-xs text-emerald-700 font-medium bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 mb-4">
                  {spotsLeft} flatmate spot{spotsLeft > 1 ? "s" : ""} available
                </p>
              )}
              <button onClick={openWhatsApp} disabled={waBusy} className="w-full py-3 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: "#25D366" }}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                </svg>
                {waBusy ? "Opening WhatsApp…" : "WhatsApp broker"}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile CTA (shown only on small screens where sidebar is hidden) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 border-t border-[#e8ddd0]" style={{ background: '#faf5ef', zIndex: 2100 }}>
          <button onClick={openWhatsApp} disabled={waBusy} className="w-full py-3.5 text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: "#25D366" }}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            </svg>
            {waBusy ? "Opening WhatsApp…" : "WhatsApp broker"}
          </button>
        </div>
      </div>

      {/* Photo gallery lightbox */}
      <AnimatePresence>
        {galleryIdx !== null && (
          <PhotoGallery photos={photos} startIdx={galleryIdx} onClose={() => setGalleryIdx(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
});

// ─── Login Modal ─────────────────────────────────────────────────────────────
const EASE_LOGIN = [0.22, 1, 0.36, 1];
const loginInputCls = "w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-rose-400 focus:ring-2 focus:ring-rose-100 disabled:opacity-60";
const loginSlide = {
  enter: (d) => ({ opacity: 0, x: d > 0 ? 20 : -20 }),
  center: { opacity: 1, x: 0 },
  exit:  (d) => ({ opacity: 0, x: d > 0 ? -20 : 20 }),
};

function LoginModal({ onClose, onSuccess }) {
  const { login, signup, loginWithGoogle, forgotPassword, resendVerificationEmail } = useAuth();
  const [step, setStep]   = useState("email");
  const [dir,  setDir]    = useState(1);
  const [email, setEmail] = useState("");
  const [pw,    setPw]    = useState("");
  const [name,  setName]  = useState("");
  const [phone, setPhone] = useState("");
  const [role,  setRole]  = useState("customer");
  const [error, setError] = useState("");
  const [info,  setInfo]  = useState("");
  const [busy,  setBusy]  = useState(false);
  const [fbBusy, setFbBusy] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);

  function goTo(next, d = 1) { setDir(d); setError(""); setInfo(""); setShowResend(false); setStep(next); }

  const handleSuccess = (result) => {
    if (result.emailWarning) sessionStorage.setItem("moveasy_onboarding_email_warning", result.emailWarning);
    onSuccess();
  };

  const onEmailContinue = (e) => { e.preventDefault(); if (email.trim()) goTo("login", 1); };

  const onLogin = async (e) => {
    e.preventDefault(); setBusy(true); setError(""); setInfo(""); setShowResend(false);
    try {
      const r = await login(email, pw);
      if (r.success) {
        if (r.requiresVerification) { setPw(""); setInfo(r.info || "Verify your email first."); return; }
        handleSuccess(r);
      } else { setError(r.error || "Something went wrong."); setShowResend(!!r.unverified); }
    } finally { setBusy(false); }
  };

  const onForgot = async () => {
    setError(""); setInfo(""); setFbBusy(true);
    const r = await forgotPassword(email.trim());
    setFbBusy(false);
    if (r.success) setInfo(r.info || "Reset email sent."); else setError(r.error || "Could not send.");
  };

  const onResend = async () => {
    setError(""); setInfo(""); setShowResend(false); setResendBusy(true);
    const r = await resendVerificationEmail(email, pw);
    setResendBusy(false);
    if (r.success) setInfo(r.info || "Sent."); else setError(r.error || "Could not resend.");
  };

  const onSignup = async (e) => {
    e.preventDefault();
    if (!name.trim())  { setError("Please enter your name.");  return; }
    if (!phone.trim()) { setError("Please enter your phone."); return; }
    setBusy(true); setError("");
    try {
      const r = await signup(email, pw, name.trim(), role, phone.trim(), null);
      if (r.success) {
        if (r.requiresVerification) { setPw(""); setInfo(r.info || "Verify your email then sign in."); goTo("login", 1); return; }
        handleSuccess(r);
      } else {
        const msg = r.error || "";
        if (msg.toLowerCase().includes("already in use") || msg.toLowerCase().includes("already exists")) {
          setError("Account exists — please sign in."); goTo("login", 1);
        } else setError(msg || "Something went wrong.");
      }
    } finally { setBusy(false); }
  };

  const onGoogle = async () => {
    setBusy(true); setError("");
    try {
      const r = await loginWithGoogle("customer");
      if (r.success) handleSuccess(r); else setError(r.error || "Google sign-in failed.");
    } finally { setBusy(false); }
  };

  const emailChip = (
    <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
      <span className="text-[12px] text-gray-700 flex-1 truncate font-medium">{email}</span>
      <button type="button" onClick={() => goTo("email", -1)} className="text-[11px] font-semibold text-rose-500 shrink-0">Change</button>
    </div>
  );

  const titles = { email: "Sign in / Register", login: "Welcome back", signup: "Create account" };
  const stepN  = step === "email" ? 1 : 2;

  return createPortal(
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.25, ease: EASE_LOGIN }}
        className="relative w-full max-w-[360px] bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top accent bar */}
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#dc2626,#ef4444,#f97316)" }} />

        {/* Spinner overlay */}
        {busy && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/80 rounded-2xl">
            <div className="h-7 w-7 rounded-full border-[3px] border-gray-200 border-t-rose-500 animate-spin" />
          </div>
        )}

        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between">
          <div>
            <p className="text-[18px] font-black tracking-tight">
              <span className="text-gray-900">Mov</span><span className="text-red-600">Eazy</span>
            </p>
            <p className="text-[13px] font-bold text-gray-800 mt-0.5">{titles[step]}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[1,2].map(n => (
                <span key={n} className="rounded-full transition-all duration-300"
                  style={{ width: n === stepN ? 16 : 6, height: 6, background: n === stepN ? "#dc2626" : "#e5e7eb" }} />
              ))}
            </div>
            <button onClick={onClose} className="ml-2 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="h-px bg-gray-100 mx-6" />

        {/* Alerts */}
        <div className="px-6 pt-3">
          <AnimatePresence>
            {info && (
              <motion.div key="info" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }}
                className="mb-3 rounded-lg px-3 py-2.5 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 overflow-hidden">
                {info}
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {error && (
              <motion.div key="err" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }}
                className="mb-3 rounded-lg px-3 py-2.5 text-[12px] text-red-700 bg-red-50 border border-red-200 overflow-hidden">
                {error}
                {showResend && (
                  <button type="button" onClick={onResend} disabled={resendBusy}
                    className="mt-1 block font-semibold text-red-600 underline underline-offset-2 disabled:opacity-50">
                    {resendBusy ? "Sending…" : "Resend verification email"}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 relative overflow-hidden">
          <AnimatePresence mode="wait" custom={dir}>

            {step === "email" && (
              <motion.div key="email" custom={dir} variants={loginSlide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: EASE_LOGIN }}>
                <form onSubmit={onEmailContinue} className="mt-2">
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Email address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    required disabled={busy} autoFocus placeholder="you@gmail.com" className={loginInputCls} />
                  <motion.button type="submit" disabled={busy}
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                    className="w-full h-10 rounded-lg text-[13px] font-bold text-white mt-3 disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)" }}>
                    Continue →
                  </motion.button>
                </form>
                <div className="my-4 flex items-center gap-3 text-[11px] text-gray-400">
                  <span className="h-px flex-1 bg-gray-100" /> or <span className="h-px flex-1 bg-gray-100" />
                </div>
                <button type="button" onClick={onGoogle} disabled={busy}
                  className="w-full h-10 rounded-lg border border-gray-200 bg-white text-[13px] font-semibold text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-60">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              </motion.div>
            )}

            {step === "login" && (
              <motion.div key="login" custom={dir} variants={loginSlide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: EASE_LOGIN }}>
                <form onSubmit={onLogin} className="mt-2">
                  {emailChip}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Password</label>
                      <button type="button" onClick={onForgot} disabled={fbBusy}
                        className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 disabled:opacity-50">
                        {fbBusy ? "Sending…" : "Forgot?"}
                      </button>
                    </div>
                    <input type="password" value={pw} onChange={e => setPw(e.target.value)}
                      required disabled={busy} autoFocus placeholder="Your password" minLength="6" className={loginInputCls} />
                  </div>
                  <motion.button type="submit" disabled={busy}
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                    className="w-full h-10 rounded-lg text-[13px] font-bold text-white disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)" }}>
                    Sign In
                  </motion.button>
                </form>
                <p className="text-center mt-4 text-[12px] text-gray-400">
                  No account?{" "}
                  <button type="button" onClick={() => goTo("signup", 1)} className="font-semibold text-red-600 hover:text-red-700">Sign up free</button>
                </p>
              </motion.div>
            )}

            {step === "signup" && (
              <motion.div key="signup" custom={dir} variants={loginSlide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: EASE_LOGIN }}>
                <form onSubmit={onSignup} className="mt-2">
                  {emailChip}
                  <div className="mb-3">
                    <FieldLabelInline>I am a</FieldLabelInline>
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      {[["customer","Tenant / Buyer"],["seller","Seller / Broker"]].map(([id, label]) => {
                        const on = role === id;
                        return (
                          <button key={id} type="button" onClick={() => setRole(id)}
                            className="h-9 rounded-lg border text-[12px] font-semibold transition-all"
                            style={{ borderColor: on?"#e85a4f":"#e5e7eb", background: on?"#fff5f2":"white", color: on?"#e85a4f":"#6b7280", boxShadow: on?"0 0 0 1px #e85a4f":"none" }}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Full Name <span className="text-rose-400">*</span></label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required disabled={busy} autoFocus placeholder="Your name" className={loginInputCls} />
                  </div>
                  <div className="mb-3">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Phone <span className="text-rose-400">*</span></label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required disabled={busy} placeholder="+91 98765 43210" className={loginInputCls} />
                  </div>
                  <div className="mb-4">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Password <span className="text-rose-400">*</span></label>
                    <input type="password" value={pw} onChange={e => setPw(e.target.value)} required disabled={busy} placeholder="Min 6 characters" minLength="6" className={loginInputCls} />
                  </div>
                  <motion.button type="submit" disabled={busy}
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                    className="w-full h-10 rounded-lg text-[13px] font-bold text-white disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)" }}>
                    Create Account
                  </motion.button>
                </form>
                <p className="text-center mt-3 text-[12px] text-gray-400">
                  Have an account?{" "}
                  <button type="button" onClick={() => goTo("login", -1)} className="font-semibold text-red-600 hover:text-red-700">Sign in</button>
                </p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

function FieldLabelInline({ children }) {
  return <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{children}</label>;
}

// ─── Build image map from listings.json (id → firebase image paths) ──────────
const jsonImagesCache = { map: null, promise: null };
function getJsonImagesMap() {
  if (jsonImagesCache.map) return Promise.resolve(jsonImagesCache.map);
  if (!jsonImagesCache.promise) {
    jsonImagesCache.promise = fetch("/listings.json")
      .then(r => r.json())
      .then(arr => {
        const m = new Map();
        arr.forEach(l => {
          const imgs = (l.images?.length ? l.images : l.cover_image_url ? [l.cover_image_url] : []).filter(Boolean);
          if (l.id && imgs.length) m.set(l.id, imgs);
          if (l.slug && imgs.length) m.set(l.slug, imgs);
        });
        jsonImagesCache.map = m;
        return m;
      })
      .catch(() => new Map());
  }
  return jsonImagesCache.promise;
}

function applyJsonImages(listings, jsonMap) {
  if (!jsonMap?.size) return listings;
  return listings.map(l => {
    const hasFlat = l.images.some(img => /flatxstoragev1\.blob\.core\.windows\.net/i.test(img));
    if (!hasFlat) return l;
    const imgs = jsonMap.get(l.id) || jsonMap.get(l.slug);
    if (!imgs?.length) return l;
    return { ...l, images: imgs, coverImage: imgs[0] };
  });
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FlatListings() {
  const { user } = useAuth();
  const [loginOpen, setLoginOpen]         = useState(false);
  const loginCallbackRef                  = useRef(null);
  const [listings, setListings]           = useState([]);
  const [lastDoc, setLastDoc]             = useState(null);
  const [canLoadMore, setCanLoadMore]     = useState(true);
  const [loadingMore, setLoadingMore]     = useState(false);
  const loaderRef                         = useRef(null);
  const [allAreas, setAllAreas]           = useState(["All Areas"]);
  const [dataLoading, setDataLoading]     = useState(true);
  const [search, setSearch]               = useState("");
  const [filterBHK, setFilterBHK]         = useState([]);
  const [filterBudgetMin, setFilterBudgetMin] = useState(0);
  const [filterBudgetMax, setFilterBudgetMax] = useState(150000);
  const [filterGender, setFilterGender]   = useState("any");
  const [filterArea, setFilterArea]       = useState("All Areas");
  const [sortBy, setSortBy]               = useState("relevance");
  const [filterListingType, setFilterListingType] = useState("all"); // "all" | "flatmate" | "entire"
  const [listingTypeOpen, setListingTypeOpen] = useState(false);
  const [view, setView]                   = useState("area"); // "area" | "map"
  const [isMobile, setIsMobile]           = useState(typeof window !== "undefined" ? window.innerWidth <= 768 : false);
  const [budgetOpen, setBudgetOpen]       = useState(false);
  const [genderOpen, setGenderOpen]       = useState(false);
  const [selectedId, setSelectedId]       = useState(null);
  const [directListing, setDirectListing] = useState(null); // listing opened via share link
  const [mapCenter, setMapCenter]         = useState(BENGALURU_CENTER);
  const [mapZoom, setMapZoom]             = useState(12);

  // Apply filters from ?locality=&minRent=… (flat search chat → browse listings)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const locality = params.get("locality") || params.get("area");
    if (locality) {
      setFilterArea(locality);
      setSearch(locality);
    }
    const minRent = Number(params.get("minRent") || 0);
    const maxRent = Number(params.get("maxRent") || 0);
    if (minRent > 0) setFilterBudgetMin(minRent);
    if (maxRent > 0) setFilterBudgetMax(maxRent);
    const bhkRaw = params.get("bhk");
    if (bhkRaw) {
      const n = parseInt(String(bhkRaw).replace(/\D/g, ""), 10);
      if (n > 0) setFilterBHK([n]);
    }
  }, []);

  // Build area list from loaded listings (updates as more pages are fetched)
  useEffect(() => {
    if (!listings.length) return;
    const unique = [...new Set(listings.map(l => l.area).filter(Boolean))].sort();
    setAllAreas(prev => {
      const merged = [...new Set([...prev.slice(1), ...unique])].sort();
      return ["All Areas", ...merged];
    });
  }, [listings]);

  // Close filter dropdowns on outside click
  useEffect(() => {
    if (!budgetOpen && !genderOpen && !listingTypeOpen) return;
    const handler = () => { setBudgetOpen(false); setGenderOpen(false); setListingTypeOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [budgetOpen, genderOpen, listingTypeOpen]);

  // Track mobile breakpoint
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Open a shared listing from the ?listing= query param
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("listing");
    if (!slug) return;
    (async () => {
      try {
        // Try by slug field first
        let snap = await getDocs(query(collection(db, "listings"), where("slug", "==", slug), limit(1)));
        let raw = null;
        if (!snap.empty) {
          raw = snap.docs[0].data();
        } else {
          // Fall back to document ID
          const d = await getDoc(doc(db, "listings", slug));
          if (d.exists()) raw = d.data();
        }
        if (!raw) return;
        const processed = processListings([raw]);
        if (!processed.length) return;
        setDirectListing(processed[0]);
        setSelectedId(processed[0].id);
        // Clean up the URL so refresh doesn't re-open the modal
        window.history.replaceState(null, "", window.location.pathname);
      } catch (e) {
        console.error("Failed to load shared listing:", e);
      }
    })();
  }, []);

  // Fetch next batch and append to listings
  const fetchListings = useCallback(async ({ cursor = null } = {}) => {
    if (!cursor) setDataLoading(true);
    else setLoadingMore(true);
    try {
      const constraints = [orderBy("bumped_at", "desc"), limit(PAGE_SIZE)];
      if (cursor) constraints.push(startAfter(cursor));
      const snap = await getDocs(query(collection(db, "listings"), ...constraints));
      const raw = processListings(snap.docs.map(d => ({ ...d.data(), _docId: d.id })));
      const jsonMap = await getJsonImagesMap();
      const docs = applyJsonImages(raw, jsonMap);
      const last = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
      setListings(prev => cursor ? [...prev, ...docs] : docs);
      setLastDoc(last);
      setCanLoadMore(snap.docs.length === PAGE_SIZE);
    } catch (e) {
      console.error("Firestore fetch error:", e);
    } finally {
      setDataLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchListings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Infinite scroll — load next batch when loader div is visible
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && canLoadMore && !loadingMore) fetchListings({ cursor: lastDoc }); },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [canLoadMore, loadingMore, lastDoc, fetchListings]);

  const debouncedSearch = useDebounce(search);

  const filtered = useMemo(() => {
    let r = listings;
    if (filterArea !== "All Areas") r = r.filter(p => p.area === filterArea);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      r = r.filter(p =>
        p.area?.toLowerCase().includes(q) ||
        p.locationDetails?.toLowerCase().includes(q) ||
        p.title?.toLowerCase().includes(q)
      );
    }
    if (filterBHK.length > 0)
      r = r.filter(p => filterBHK.includes(p.bedrooms >= 4 ? 4 : p.bedrooms));
    r = r.filter(p => p.rent >= filterBudgetMin && p.rent <= filterBudgetMax);
    if (filterGender !== "any")
      r = r.filter(p => p.gender === filterGender || p.gender === "any");
    if (filterListingType === "flatmate") r = r.filter(p => p.listingType === "flatmate");
    if (filterListingType === "entire")   r = r.filter(p => p.listingType === "entire");
    return [...r].sort((a, b) => {
      if (sortBy === "price_asc")  return a.rent - b.rent;
      if (sortBy === "price_desc") return b.rent - a.rent;
      if (sortBy === "area_az")    return a.area.localeCompare(b.area);
      return b.sortTs - a.sortTs;
    });
  }, [listings, debouncedSearch, filterBHK, filterBudgetMin, filterBudgetMax, filterGender, filterArea, sortBy, filterListingType]);

  const visible = filtered;

  const hasActiveFilters = !!(
    debouncedSearch || filterBHK.length > 0 || filterGender !== "any" ||
    filterArea !== "All Areas" || filterBudgetMin > 0 || filterBudgetMax < 150000 ||
    filterListingType !== "all"
  );

  // When filters are active and fewer than PAGE_SIZE results are showing, keep fetching
  // more pages automatically so the count doesn't misleadingly start at < 50.
  useEffect(() => {
    if (!hasActiveFilters) return;
    if (!canLoadMore || loadingMore || dataLoading) return;
    if (filtered.length >= PAGE_SIZE) return;
    fetchListings({ cursor: lastDoc });
  }, [hasActiveFilters, filtered.length, canLoadMore, loadingMore, dataLoading, lastDoc, fetchListings]);

  // Area clusters for map
  const areaClusters = useMemo(() => {
    const map = {};
    filtered.forEach(p => {
      if (!map[p.area]) map[p.area] = { area: p.area, count: 0, lat: p.lat, lng: p.lng };
      map[p.area].count++;
    });
    return Object.values(map);
  }, [filtered]);

  const selectedProperty = useMemo(() => {
    if (!selectedId) return null;
    if (directListing?.id === selectedId) return directListing;
    return filtered.find(p => p.id === selectedId) ?? null;
  }, [filtered, selectedId, directListing]);

  const toggleBHK = useCallback(n =>
    setFilterBHK(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]), []);

  const clearAll = useCallback(() => {
    setSearch(""); setFilterBHK([]); setFilterBudgetMin(0); setFilterBudgetMax(150000);
    setFilterGender("any"); setFilterArea("All Areas"); setSortBy("relevance");
    setFilterListingType("all");
    setSelectedId(null); setMapCenter(BENGALURU_CENTER); setMapZoom(12);
  }, []);

  const requireAuth = useCallback((cb) => {
    if (!user) { loginCallbackRef.current = cb; setLoginOpen(true); return; }
    cb();
  }, [user]);

  const activeCount =
    filterBHK.length + (filterGender !== "any" ? 1 : 0) +
    (filterArea !== "All Areas" ? 1 : 0) +
    (filterBudgetMin > 0 || filterBudgetMax < 150000 ? 1 : 0) +
    (filterListingType !== "all" ? 1 : 0);

  const budgetLabel = filterBudgetMin === 0 && filterBudgetMax === 150000
    ? "Budget: ₹0 – ₹1.5L"
    : `₹${(filterBudgetMin / 1000).toFixed(0)}k – ₹${(filterBudgetMax / 1000).toFixed(0)}k`;

  const genderLabel = filterGender === "female" ? "Girls Only" : filterGender === "male" ? "Boys Only" : "Looking for";

  if (dataLoading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "#fffaf8" }}>
        <div className="text-[#1c1917] text-sm font-medium opacity-60">Loading listings…</div>
      </div>
    );
  }

  return (
    <PageShell variant="marketing" overlayOnly className="antialiased bg-[#fffaf8]" style={{ fontFamily: "'Inter',sans-serif" }}>
      <Navbar variant="marketing" />

      {/* Page header removed to match site theme (search block handles title) */}

      {/* ── Search + Filter Block ── */}
      <div className="px-6 md:px-10 py-4">
        <div className="rounded-2xl p-4" style={{ background: "#f0ebe3" }}>

          {/* Row 1: Search + Sort */}
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-1 bg-white rounded-xl shadow-sm">
              <input
                type="text"
                placeholder={'Search "any locality"'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-4 pr-10 py-3 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none rounded-xl"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 text-sm text-gray-600 font-semibold">
              <Link
                to="/flat-agent"
                className="hidden sm:inline-flex items-center gap-1.5 bg-[#ff3131] text-white text-xs font-bold px-3 py-2.5 rounded-xl hover:bg-red-600 transition-colors whitespace-nowrap"
              >
                Ask Flat Agent
              </Link>
              <div className="relative">
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  className="appearance-none bg-white border border-red-300 text-gray-700 text-xs font-semibold pl-3 pr-7 py-2.5 rounded-xl cursor-pointer focus:outline-none hover:border-red-300">
                  <option value="relevance">Relevance</option>
                  <option value="price_asc">Price ↑</option>
                  <option value="price_desc">Price ↓</option>
                  <option value="area_az">Area Name</option>
                </select>
                <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Row 2: Filter pills + view toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Budget pill */}
            <div className="relative">
              <button onClick={() => { setBudgetOpen(o => !o); setGenderOpen(false); }}
                className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl border bg-white transition-all hover:border-red-300 ${filterBudgetMin > 0 || filterBudgetMax < 150000 ? "border-[#ff3131] text-[#ff3131]" : "border-red-300 text-gray-700"}`}>
                {budgetLabel}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {budgetOpen && (
                <div onMouseDown={e => e.stopPropagation()} className="absolute top-full left-0 mt-1.5 bg-white rounded-2xl shadow-xl border border-red-200 p-4 z-30 w-56">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Budget Range</p>
                  {[
                    [0, 150000, "Any budget"],
                    [0, 10000,  "Under ₹10k"],
                    [10000, 20000, "₹10k – ₹20k"],
                    [20000, 30000, "₹20k – ₹30k"],
                    [30000, 150000, "₹30k+"],
                  ].map(([min, max, label]) => (
                    <button key={label} onClick={() => { setFilterBudgetMin(min); setFilterBudgetMax(max); setBudgetOpen(false); }}
                      className={`w-full text-left text-xs py-2 px-3 rounded-xl mb-1 font-medium transition-colors ${filterBudgetMin === min && filterBudgetMax === max ? "text-white" : "text-gray-600 hover:bg-gray-50"}`}
                      style={filterBudgetMin === min && filterBudgetMax === max ? { background: BRAND_RED } : {}}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Looking for (gender) */}
            <div className="relative">
              <button onClick={() => { setGenderOpen(o => !o); setBudgetOpen(false); }}
                className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl border bg-white transition-all hover:border-red-300 ${filterGender !== "any" ? "border-[#ff3131] text-[#ff3131]" : "border-red-300 text-gray-700"}`}>
                {genderLabel}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {genderOpen && (
                <div onMouseDown={e => e.stopPropagation()} className="absolute top-full left-0 mt-1.5 bg-white rounded-2xl shadow-xl border border-red-200 p-3 z-30 w-44">
                  {[["any", "Co-ed / Any"], ["female", "Girls Only"], ["male", "Boys Only"]].map(([v, label]) => (
                    <button key={v} onClick={() => { setFilterGender(v); setGenderOpen(false); }}
                      className={`w-full text-left text-xs py-2 px-3 rounded-xl mb-1 font-medium transition-colors ${filterGender === v ? "text-white" : "text-gray-600 hover:bg-gray-50"}`}
                      style={filterGender === v ? { background: BRAND_RED } : {}}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Listing type: Flatmate / Entire flat */}
            <div className="relative">
              <button onClick={() => { setListingTypeOpen(o => !o); setBudgetOpen(false); setGenderOpen(false); }}
                className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl border bg-white transition-all hover:border-red-300 ${filterListingType !== "all" ? "border-[#ff3131] text-[#ff3131]" : "border-red-300 text-gray-700"}`}>
                {filterListingType === "flatmate" ? "Flatmate" : filterListingType === "entire" ? "Entire flat" : "Flatmate / Flat"}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {listingTypeOpen && (
                <div onMouseDown={e => e.stopPropagation()} className="absolute top-full left-0 mt-1.5 bg-white rounded-2xl shadow-xl border border-red-200 p-3 z-30 w-40">
                  {[["all", "Any"], ["flatmate", "Flatmate"], ["entire", "Entire flat"]].map(([v, label]) => (
                    <button key={v} onClick={() => { setFilterListingType(v); setListingTypeOpen(false); }}
                      className={`w-full text-left text-xs py-2 px-3 rounded-xl mb-1 font-medium transition-colors ${filterListingType === v ? "text-white" : "text-gray-600 hover:bg-gray-50"}`}
                      style={filterListingType === v ? { background: BRAND_RED } : {}}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* BHK chips */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map(n => (
                <button key={n} onClick={() => toggleBHK(n)}
                  className={`text-xs font-semibold px-3 py-2 rounded-xl border transition-all ${filterBHK.includes(n) ? "text-white border-transparent" : "bg-white border-red-300 text-gray-700 hover:border-red-300"}`}
                  style={filterBHK.includes(n) ? { background: BRAND_RED, borderColor: BRAND_RED } : {}}>
                  {n === 4 ? "4+ BHK" : `${n} BHK`}
                </button>
              ))}
            </div>

            {/* Area filter */}
            <div className="relative">
              <select value={filterArea} onChange={e => setFilterArea(e.target.value)}
                className={`appearance-none text-xs font-semibold pl-3 pr-7 py-2 rounded-xl border cursor-pointer bg-white focus:outline-none transition-all ${filterArea !== "All Areas" ? "text-white border-transparent" : "border-red-300 text-gray-700 hover:border-red-300"}`}
                style={filterArea !== "All Areas" ? { background: BRAND_RED } : {}}>
                {allAreas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <svg className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${filterArea !== "All Areas" ? "text-white" : "text-gray-400"}`}
                fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Clear */}
            {activeCount > 0 && (
              <button onClick={clearAll}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl border border-red-300 bg-red-50 text-red-500 hover:bg-red-100 transition-all">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear ({activeCount})
              </button>
            )}

            {/* View toggle — right side */}
            <div className="ml-auto flex items-center rounded-xl border border-red-300 overflow-hidden bg-white divide-x divide-red-300">
              {[
                { key: "map",  label: "Map",       icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg> },
                { key: "area", label: "Area only", icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> },
              ].map(({ key, label, icon }) => (
                <button key={key} onClick={() => setView(key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all ${view === key ? "text-white" : "text-gray-600 hover:bg-gray-50"}`}
                  style={view === key ? { background: BRAND_INK } : {}}>
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Result count */}
      <div className="px-6 md:px-10 pb-3 flex items-center gap-2 flex-wrap">
        <p className="text-sm text-gray-500">
          <span className="font-bold text-[#1c1917]">{filtered.length}{canLoadMore && !hasActiveFilters ? "+" : ""}</span> results
          {hasActiveFilters && canLoadMore && (
            <span className="ml-1 text-xs text-gray-400">(loading more…)</span>
          )}
          {filterArea !== "All Areas" && (
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full border" style={{ color: BRAND_RED, borderColor: "#ffcdd2", background: "#fff5f5" }}>{filterArea}</span>
          )}
        </p>
        {loadingMore && hasActiveFilters && (
          <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-red-400 rounded-full animate-spin" />
        )}
      </div>

      {/* ── Content ── */}

        {/* Area-only: normal page scroll */}
        {view === "area" && (
          <div className="px-6 md:px-10 pb-16">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-red-200">
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
                  </svg>
                </div>
                <p className="text-base font-bold text-gray-600 mb-1">No listings found</p>
                <p className="text-sm text-gray-400 mb-4">Try adjusting your search or filters</p>
                <button onClick={clearAll}
                  className="text-sm font-semibold px-5 py-2 rounded-xl text-white transition-all"
                  style={{ background: BRAND_RED }}>Clear all filters</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {visible.map(p => (
                    <ListingCard key={p.id} property={p} onClick={() => setSelectedId(p.id)} compact={false} />
                  ))}
                </div>
                <div ref={loaderRef} className="py-8 flex justify-center">
                  {loadingMore && (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <div className="w-4 h-4 border-2 border-gray-200 border-t-red-400 rounded-full animate-spin" />
                      Loading more…
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Map view: full-screen map on mobile, cards-left + map-right on desktop */}
        {view === "map" && (
          <div className={isMobile ? "relative px-2 pb-2" : "flex px-4 pb-4 gap-3"} style={{ height: isMobile ? "calc(100vh - 200px)" : "calc(100vh - 210px)" }}>
            {/* Cards column — desktop only */}
            {!isMobile && (
              <div className="w-[44%] shrink-0 overflow-y-auto pr-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <p className="text-sm font-bold text-gray-600 mb-1">No listings found</p>
                    <button onClick={clearAll} className="text-sm font-semibold text-white px-4 py-2 rounded-xl mt-3" style={{ background: BRAND_RED }}>Clear filters</button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {visible.map(p => (
                        <ListingCard key={p.id} property={p} onClick={() => { setSelectedId(p.id); setMapCenter([p.lat, p.lng]); setMapZoom(15); }} compact={true} />
                      ))}
                    </div>
                    <div className="py-4 flex justify-center">
                      {loadingMore && (
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-red-400 rounded-full animate-spin" />
                          Loading…
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Map — full width on mobile, flex-1 on desktop */}
            <div className={isMobile ? "w-full h-full relative rounded-2xl overflow-hidden" : "flex-1 relative rounded-2xl overflow-hidden"}>
              <MapContainer
                center={mapCenter} zoom={mapZoom}
                style={{ height: "100%", width: "100%" }}
                zoomControl={false} preferCanvas={true}
                maxBounds={BENGALURU_BOUNDS} maxBoundsViscosity={0.85}
                minZoom={10} maxZoom={18}
                zoomSnap={1} zoomDelta={1} wheelPxPerZoomLevel={80}
                markerZoomAnimation={false} zoomAnimation={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://carto.com">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png"
                  subdomains="abcd" maxZoom={18}
                  keepBuffer={6} updateWhenIdle={true} updateWhenZooming={false}
                />
                <MapController center={mapCenter} zoom={mapZoom} />
                {areaClusters.map(c => (
                  <Marker
                    key={c.area}
                    position={[c.lat, c.lng]}
                    icon={makeClusterIcon(c.count, c.area === (filtered.find(p => p.id === selectedId)?.area))}
                    eventHandlers={{ click: () => { setFilterArea(c.area); setMapCenter([c.lat, c.lng]); setMapZoom(14); } }}
                  />
                ))}
              </MapContainer>

              <style>{`.leaflet-control-attribution{font-size:9px!important;opacity:.4}.leaflet-bottom.leaflet-right{bottom:4px;right:4px}`}</style>

              <div className="absolute bottom-4 right-4 z-[999] flex gap-2">
                {isMobile && (
                  <button onClick={() => setView("area")}
                    className="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-lg text-xs font-semibold border flex items-center gap-1.5 hover:bg-white transition-all"
                    style={{ color: BRAND_RED, borderColor: BRAND_RED }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    List
                  </button>
                )}
                <button onClick={() => { setMapCenter(BENGALURU_CENTER); setMapZoom(12); }}
                  className="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-lg text-xs font-semibold text-gray-700 border border-red-300 flex items-center gap-1.5 hover:bg-white transition-all">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {selectedId && selectedProperty && (
          <DetailModal property={selectedProperty} onClose={() => { setSelectedId(null); setDirectListing(null); }} requireAuth={requireAuth} />
        )}
      </AnimatePresence>

      {/* ── Login Modal ── */}
      <AnimatePresence>
        {loginOpen && (
          <LoginModal
            onClose={() => setLoginOpen(false)}
            onSuccess={() => {
              setLoginOpen(false);
              if (loginCallbackRef.current) { loginCallbackRef.current(); loginCallbackRef.current = null; }
            }}
          />
        )}
      </AnimatePresence>

      <Footer />
    </PageShell>
  );
}
