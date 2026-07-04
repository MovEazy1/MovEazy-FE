// src/pages/Listings.jsx
// Dependencies: react-leaflet, leaflet, framer-motion (all via npm)
// Also add `import "leaflet/dist/leaflet.css"` to your main.jsx

import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { motion, AnimatePresence } from "framer-motion";

// ─── Fix Leaflet default icon paths (Vite issue) ──────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Dummy Property Data ───────────────────────────────────────────────────────
const PROPERTIES = [
  {
    id: 1,
    title: "Luxury Studio – Midtown West",
    address: "350 W 42nd St, New York, NY",
    neighborhood: "Midtown West",
    price: 2982,
    beds: 1,
    baths: 1,
    sqft: 620,
    type: "Studio",
    lat: 40.7589,
    lng: -73.9937,
    images: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&q=80",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&q=80",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=900&q=80",
    ],
    amenities: ["Gym", "Doorman", "Rooftop", "Pet Friendly"],
    available: "Available Now",
    phone: "267-493-1561",
    description:
      "Stunning studio with floor-to-ceiling windows and panoramic Midtown views. Renovated with Italian marble finishes, chef's kitchen, and smart home features throughout.",
    rating: 4.8,
    reviews: 124,
    badge: "Special Offer",
    tour3d: true,
  },
  {
    id: 2,
    title: "Elegant 2BR – Upper West Side",
    address: "200 W 86th St, New York, NY",
    neighborhood: "Upper West Side",
    price: 4200,
    beds: 2,
    baths: 2,
    sqft: 1100,
    type: "Apartment",
    lat: 40.7849,
    lng: -73.98,
    images: [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&q=80",
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=900&q=80",
      "https://images.unsplash.com/photo-1556912173-3bb406ef7e77?w=900&q=80",
    ],
    amenities: ["Concierge", "Laundry", "Bike Storage", "Storage Unit"],
    available: "Available Jun 1",
    phone: "267-493-1562",
    description:
      "Pre-war elegance meets modern living. High ceilings, original hardwood floors, and generous closet space in one of the UWS's most sought-after buildings.",
    rating: 4.9,
    reviews: 89,
    badge: "3D Tour",
    tour3d: true,
  },
  {
    id: 3,
    title: "Bright 1BR – Chelsea",
    address: "245 W 19th St, New York, NY",
    neighborhood: "Chelsea",
    price: 3507,
    beds: 1,
    baths: 1,
    sqft: 780,
    type: "Apartment",
    lat: 40.7434,
    lng: -73.9997,
    images: [
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=900&q=80",
      "https://images.unsplash.com/photo-1560185127-6a1bdb9c7b63?w=900&q=80",
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=900&q=80",
    ],
    amenities: ["Gym", "Virtual Doorman", "Package Room", "Bike Room"],
    available: "Available Now",
    phone: "267-493-1563",
    description:
      "Sun-drenched one-bedroom with open city views. Steps from the High Line, Chelsea Market, and top galleries. Central A/C and in-unit washer/dryer.",
    rating: 4.7,
    reviews: 201,
    badge: "Special Offer",
    tour3d: false,
  },
  {
    id: 4,
    title: "Modern 2BR – Brooklyn Heights",
    address: "80 Remsen St, Brooklyn, NY",
    neighborhood: "Brooklyn Heights",
    price: 3800,
    beds: 2,
    baths: 1,
    sqft: 950,
    type: "Apartment",
    lat: 40.6964,
    lng: -73.9964,
    images: [
      "https://images.unsplash.com/photo-1574643156929-51fa098b0394?w=900&q=80",
      "https://images.unsplash.com/photo-1571939228382-b2f2b585ce15?w=900&q=80",
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=80",
    ],
    amenities: ["Private Terrace", "Laundry", "Storage", "Live-in Super"],
    available: "Available May 15",
    phone: "267-493-1564",
    description:
      "Spacious two-bedroom with private terrace overlooking the Brooklyn Promenade. Manhattan skyline views. Quiet, tree-lined block in a prime location.",
    rating: 4.6,
    reviews: 67,
    badge: "New Listing",
    tour3d: true,
  },
  {
    id: 5,
    title: "Penthouse Studio – Williamsburg",
    address: "130 S 4th St, Brooklyn, NY",
    neighborhood: "Williamsburg",
    price: 3200,
    beds: 1,
    baths: 1,
    sqft: 700,
    type: "Penthouse",
    lat: 40.7126,
    lng: -73.962,
    images: [
      "https://images.unsplash.com/photo-1600210492493-0946911123ea?w=900&q=80",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=900&q=80",
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&q=80",
    ],
    amenities: ["Rooftop Deck", "Gym", "Concierge", "Dog Run"],
    available: "Available Now",
    phone: "267-493-1565",
    description:
      "Top-floor penthouse studio with soaring ceilings and wrap-around Manhattan views. Polished concrete floors, custom built-ins, and gourmet kitchen.",
    rating: 4.9,
    reviews: 156,
    badge: "Special Offer",
    tour3d: true,
  },
  {
    id: 6,
    title: "Classic 3BR – Park Slope",
    address: "400 7th Ave, Brooklyn, NY",
    neighborhood: "Park Slope",
    price: 5500,
    beds: 3,
    baths: 2,
    sqft: 1400,
    type: "Apartment",
    lat: 40.6662,
    lng: -73.979,
    images: [
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=900&q=80",
      "https://images.unsplash.com/photo-1600121848594-d8644e57abab?w=900&q=80",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80",
    ],
    amenities: ["Private Garden", "Laundry", "Storage", "Pet Friendly"],
    available: "Available Jul 1",
    phone: "267-493-1566",
    description:
      "Rare three-bedroom garden apartment in the heart of Park Slope. Private backyard, original crown molding, chef's kitchen. Steps from Prospect Park.",
    rating: 4.8,
    reviews: 43,
    badge: "Premium",
    tour3d: false,
  },
  {
    id: 7,
    title: "Sleek 1BR – Long Island City",
    address: "5-33 48th Ave, Queens, NY",
    neighborhood: "Long Island City",
    price: 2750,
    beds: 1,
    baths: 1,
    sqft: 710,
    type: "Apartment",
    lat: 40.744,
    lng: -73.949,
    images: [
      "https://images.unsplash.com/photo-1617104551722-3b2d51366400?w=900&q=80",
      "https://images.unsplash.com/photo-1565183997392-2f6f122e5912?w=900&q=80",
      "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=900&q=80",
    ],
    amenities: ["Pool", "Gym", "Rooftop", "Co-working Space"],
    available: "Available Now",
    phone: "267-493-1567",
    description:
      "Brand new luxury one-bedroom with Manhattan skyline views from every window. Full-service amenity building. 7-min subway to Midtown.",
    rating: 4.7,
    reviews: 88,
    badge: "3D Tour",
    tour3d: true,
  },
  {
    id: 8,
    title: "Cozy 2BR – Astoria",
    address: "31-59 Crescent St, Queens, NY",
    neighborhood: "Astoria",
    price: 3100,
    beds: 2,
    baths: 1,
    sqft: 900,
    type: "Apartment",
    lat: 40.7707,
    lng: -73.9296,
    images: [
      "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=900&q=80",
      "https://images.unsplash.com/photo-1562182384-08115de5ee97?w=900&q=80",
      "https://images.unsplash.com/photo-1600607687939-ce8a6a8b9d1d?w=900&q=80",
    ],
    amenities: ["Backyard", "Laundry", "Live-in Super", "Storage"],
    available: "Available May 1",
    phone: "267-493-1568",
    description:
      "Charming two-bedroom in vibrant Astoria. Hardwood floors throughout, renovated kitchen, and private backyard access. Close to top dining and N/W trains.",
    rating: 4.5,
    reviews: 112,
    badge: "New Listing",
    tour3d: false,
  },
];

// ─── Map fly-to controller ─────────────────────────────────────────────────────
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom, { duration: 1.2, easeLinearity: 0.25 });
  }, [center, zoom, map]);
  return null;
}

// ─── Custom price marker icon ──────────────────────────────────────────────────
function createPriceIcon(price, isSelected) {
  const bg = isSelected ? "#ef4444" : "#0f172a";
  const border = isSelected ? "#fff" : "transparent";
  return L.divIcon({
    html: `
      <div style="
        position:relative;
        background:${bg};
        color:#fff;
        padding:5px 11px;
        border-radius:20px;
        font-size:12px;
        font-weight:700;
        font-family:sans-serif;
        white-space:nowrap;
        box-shadow:0 4px 14px rgba(0,0,0,0.35);
        border:2px solid ${border};
        transform:${isSelected ? "scale(1.18)" : "scale(1)"};
        transition:all 0.2s;
        cursor:pointer;
        display:inline-block;
      ">
        $${(price / 1000).toFixed(1)}k
        <div style="
          position:absolute;
          bottom:-7px;
          left:50%;
          transform:translateX(-50%);
          width:0;height:0;
          border-left:7px solid transparent;
          border-right:7px solid transparent;
          border-top:7px solid ${bg};
        "></div>
      </div>`,
    className: "",
    iconSize: [80, 38],
    iconAnchor: [40, 38],
  });
}

// ─── Badge colours ─────────────────────────────────────────────────────────────
const BADGE_STYLES = {
  "Special Offer": "bg-red-500 text-white",
  "3D Tour": "bg-slate-800 text-white",
  "New Listing": "bg-emerald-500 text-white",
  Premium: "bg-amber-500 text-white",
};

// ─── Star rating ───────────────────────────────────────────────────────────────
function Stars({ rating }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`w-3 h-3 ${s <= Math.round(rating) ? "text-amber-400" : "text-gray-300"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

// ─── Property Card ─────────────────────────────────────────────────────────────
function PropertyCard({ property, isSelected, onClick, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
      onClick={onClick}
      className={`group relative bg-white rounded-2xl overflow-hidden cursor-pointer transition-all duration-300
        ${isSelected
          ? "ring-2 ring-red-500 shadow-xl shadow-red-100"
          : "shadow-md hover:shadow-xl hover:-translate-y-0.5"
        }`}
    >
      {/* Image */}
      <div className="relative h-44 overflow-hidden">
           <SmartImage
             src={property.images?.[0]}
             alt={property.title}
             className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
           />
        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {property.tour3d && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-white tracking-wide">
              3D TOUR
            </span>
          )}
          {property.badge && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide ${BADGE_STYLES[property.badge] || "bg-gray-800 text-white"}`}
            >
              {property.badge.toUpperCase()}
            </span>
          )}
        </div>
        {/* Heart */}
        <button className="absolute top-2.5 right-2.5 w-7 h-7 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors">
          <svg className="w-3.5 h-3.5 text-gray-500 hover:text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
        {/* Available tag */}
        <div className="absolute bottom-2.5 left-2.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            property.available === "Available Now"
              ? "bg-emerald-500/90 text-white"
              : "bg-white/80 text-slate-700"
          }`}>
            {property.available}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold text-slate-900">
                ${property.price.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400">/mo</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{property.neighborhood}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Stars rating={property.rating} />
            <span className="text-[10px] text-slate-400">({property.reviews})</span>
          </div>
        </div>
        <p className="text-[13px] font-semibold text-slate-800 truncate mb-2">{property.title}</p>
        {/* Stats row */}
        <div className="flex items-center gap-3 text-[11px] text-slate-500 mb-3">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            {property.beds} bd
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            {property.baths} ba
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            {property.sqft} sqft
          </span>
        </div>
        {/* CTA */}
        <div className="flex gap-2">
          <a
            href={`tel:${property.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-center text-[11px] font-semibold py-2 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-400 transition-colors"
          >
            {property.phone}
          </a>
          <button className="flex-1 text-[11px] font-semibold py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">
            Check availability
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Detail Panel (right drawer) ───────────────────────────────────────────────
function DetailPanel({ property, onClose }) {
  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => setImgIndex(0), [property?.id]);

  if (!property) return null;

  return (
    <motion.div
      key={property.id}
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 34 }}
      className="absolute inset-0 z-10 bg-white flex flex-col overflow-hidden rounded-r-none"
    >
      {/* Image gallery */}
      <div className="relative h-56 shrink-0 overflow-hidden bg-slate-100">
        <AnimatePresence mode="wait">
          <motion.img
            key={imgIndex}
            src={property.images[imgIndex]}
            alt={property.title}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full object-cover"
          />
        </AnimatePresence>
        {/* Dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {property.images.map((_, i) => (
            <button
              key={i}
              onClick={() => setImgIndex(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === imgIndex ? "bg-white scale-125" : "bg-white/50"}`}
            />
          ))}
        </div>
        {/* Nav arrows */}
        <button
          onClick={() => setImgIndex((p) => (p - 1 + property.images.length) % property.images.length)}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white shadow-md transition-colors"
        >
          <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <button
          onClick={() => setImgIndex((p) => (p + 1) % property.images.length)}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white shadow-md transition-colors"
        >
          <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {property.tour3d && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-white">3D TOUR</span>
          )}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${BADGE_STYLES[property.badge] || "bg-gray-800 text-white"}`}>
            {property.badge?.toUpperCase()}
          </span>
        </div>
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white shadow-md transition-colors"
        >
          <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Price & title */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-2xl font-bold text-slate-900">
              ${property.price.toLocaleString()}
              <span className="text-sm font-normal text-slate-400">/mo</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{property.neighborhood}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1">
              <Stars rating={property.rating} />
              <span className="text-xs font-semibold text-slate-700">{property.rating}</span>
            </div>
            <p className="text-xs text-slate-400">{property.reviews} reviews</p>
          </div>
        </div>
        <h2 className="text-base font-bold text-slate-800 mb-1">{property.title}</h2>
        <p className="text-xs text-slate-500 flex items-center gap-1 mb-4">
          <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
          {property.address}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "Bedrooms", value: property.beds },
            { label: "Bathrooms", value: property.baths },
            { label: "Sq Ft", value: property.sqft.toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label} className="text-center p-2.5 bg-slate-50 rounded-xl">
              <p className="text-sm font-bold text-slate-800">{value}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Availability */}
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-4 ${
          property.available === "Available Now"
            ? "bg-emerald-50 text-emerald-700"
            : "bg-amber-50 text-amber-700"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${property.available === "Available Now" ? "bg-emerald-500" : "bg-amber-500"}`}></span>
          {property.available}
        </div>

        {/* Description */}
        <p className="text-sm text-slate-600 leading-relaxed mb-4">{property.description}</p>

        {/* Amenities */}
        <div className="mb-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Amenities</p>
          <div className="flex flex-wrap gap-2">
            {property.amenities.map((a) => (
              <span key={a} className="text-xs px-3 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">
                {a}
              </span>
            ))}
          </div>
        </div>

        {/* Type */}
        <div className="mb-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Property Type</p>
          <span className="text-xs px-3 py-1 bg-red-50 text-red-600 rounded-full font-semibold">{property.type}</span>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-2.5">
          <button className="w-full py-3 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition-colors">
            Check Availability
          </button>
          <a
            href={`tel:${property.phone}`}
            className="w-full py-3 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl text-center hover:bg-slate-50 transition-colors"
          >
            📞 {property.phone}
          </a>
          <button className="w-full py-3 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors">
            Schedule a Tour
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Listings Page ────────────────────────────────────────────────────────
export default function Listings() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [mapCenter, setMapCenter] = useState([40.7484, -73.9967]);
  const [mapZoom, setMapZoom] = useState(12);
  const [filters, setFilters] = useState({
    type: "For rent",
    price: "Price",
    beds: "Beds & baths",
    propType: "Property type",
  });
  const [showDetail, setShowDetail] = useState(false);
  const cardRefs = useRef({});

  // Scroll card into view when selected from map
  const selectProperty = useCallback((property) => {
    setSelectedProperty(property);
    setMapCenter([property.lat, property.lng]);
    setMapZoom(15);
    if (property && cardRefs.current[property.id]) {
      cardRefs.current[property.id].scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, []);

  const handleMarkerClick = (property) => {
    selectProperty(property);
    setShowDetail(true);
  };

  const handleCardClick = (property) => {
    selectProperty(property);
    setShowDetail(true);
  };

  const handleCloseDetail = () => {
    setShowDetail(false);
    setSelectedProperty(null);
    setMapCenter([40.7484, -73.9967]);
    setMapZoom(12);
  };

  const filteredProperties = PROPERTIES.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.address.toLowerCase().includes(q) ||
      p.neighborhood.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q)
    );
  });

  const FilterDropdown = ({ label, value, onChange }) => (
    <div className="relative">
      <select
        aria-label={label}
        className="appearance-none bg-white border border-slate-200 text-slate-700 text-xs font-semibold pl-3 pr-7 py-2.5 rounded-xl cursor-pointer hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-red-300 transition-all"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option>{value}</option>
      </select>
      <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
      {/* ── Search + Filters Bar ── */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="shrink-0 px-4 py-3 bg-white border-b border-slate-100 shadow-sm z-20"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative flex-1 min-w-60">
            <input
              type="text"
              placeholder="Address, neighborhood, city, ZIP"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          {/* Filter dropdowns */}
          <FilterDropdown label="For rent" value={filters.type} onChange={(v) => setFilters((p) => ({ ...p, type: v }))} />
          <FilterDropdown label="Price" value={filters.price} onChange={(v) => setFilters((p) => ({ ...p, price: v }))} />
          <FilterDropdown label="Beds & baths" value={filters.beds} onChange={(v) => setFilters((p) => ({ ...p, beds: v }))} />
          <FilterDropdown label="Property type" value={filters.propType} onChange={(v) => setFilters((p) => ({ ...p, propType: v }))} />

          <button className="text-xs font-semibold px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors shadow-sm">
            Save search
          </button>
        </div>

        {/* Result count */}
        <p className="text-xs text-slate-400 mt-2 pl-1">
          <span className="font-semibold text-slate-600">{filteredProperties.length}</span> homes found
          {searchQuery && <span> for "<span className="text-red-500">{searchQuery}</span>"</span>}
        </p>
      </motion.div>

      {/* ── Map + Cards ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── MAP PANEL ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative flex-1 min-w-0"
        >
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapController center={mapCenter} zoom={mapZoom} />

            {filteredProperties.map((property) => (
              <Marker
                key={property.id}
                position={[property.lat, property.lng]}
                icon={createPriceIcon(
                  property.price,
                  selectedProperty?.id === property.id
                )}
                eventHandlers={{
                  click: () => handleMarkerClick(property),
                }}
              />
            ))}
          </MapContainer>

          {/* Map attribution overlay tweak */}
          <style>{`
            .leaflet-control-attribution { font-size: 9px !important; opacity: 0.6; }
            .leaflet-bottom.leaflet-right { bottom: 4px; right: 4px; }
          `}</style>

          {/* Map controls */}
          <div className="absolute bottom-6 right-4 z-[999] flex flex-col gap-2">
            <button
              onClick={() => { setMapCenter([40.7484, -73.9967]); setMapZoom(12); }}
              className="bg-white px-3 py-1.5 rounded-lg shadow-md text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors border border-slate-200"
            >
              Reset View
            </button>
          </div>
        </motion.div>

        {/* ── RIGHT PANEL: Cards or Detail ── */}
        <div className="relative w-[420px] shrink-0 flex flex-col bg-white border-l border-slate-100 overflow-hidden">

          {/* Cards list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <AnimatePresence>
              {filteredProperties.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-64 text-slate-400"
                >
                  <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-sm font-medium">No results found</p>
                  <p className="text-xs mt-1">Try a different location</p>
                </motion.div>
              ) : (
                filteredProperties.map((property, index) => (
                  <div
                    key={property.id}
                    ref={(el) => (cardRefs.current[property.id] = el)}
                  >
                    <PropertyCard
                      property={property}
                      isSelected={selectedProperty?.id === property.id}
                      onClick={() => handleCardClick(property)}
                      index={index}
                    />
                  </div>
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Detail panel overlays cards */}
          <AnimatePresence>
            {showDetail && selectedProperty && (
              <DetailPanel
                property={selectedProperty}
                onClose={handleCloseDetail}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
