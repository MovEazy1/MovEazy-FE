import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from "react-leaflet";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { applyListingFilters, FILTER_OPTIONS, getFiltersInitialState, getListings } from "../lib/store";
import { useAuth } from "../context/AuthContext";
import { useLoginModal } from "../context/LoginModalContext";
import { isFirebaseConfigured } from "../lib/firebase";
import { getListingsData, isListingPubliclyVisible } from "../lib/firestoreStore";
import { fetchInventoryAsListings } from "../lib/inventory";
import { geocodePlace, searchPlaces, reverseGeocode } from "../lib/geocode";
import { haversineKm } from "../lib/geo";
import PropertyModal from "./PropertyModal";
import AIBroker from "./AIBroker";
import { AREA_NAMES_SORTED } from "../data/listingsData";
import { BANGALORE_WORKPLACES, EMPLOYER_SEARCH_CHIPS, matchWorkplacePreset } from "../data/bangaloreWorkplaces";
import {
  appendFilterHistory,
  consumeMapRestorePayload,
  isListingSaved,
  toggleSavedListing,
} from "../lib/userActivity";
import { logSavedListingChange } from "../lib/crmSync";
import { reportClientWarn } from "../lib/clientLog";
import MovEazyNav from "./layout/MovEazyNav";

const MAP_NEARBY_KM = 12;
/** Default max distance (km) from workplace / geocoded pin; user-adjustable in search panel. */
const DEFAULT_COMMUTE_RADIUS_KM = 10;

/**
 * Approximate door-to-door drive time from a flat to the office.
 * We can't fire an OSRM request per listing (dozens of pins), so we estimate from the
 * straight-line distance using an effective ~20 km/h Bengaluru traffic speed. Labelled
 * "~" everywhere so users read it as a guide, not a promise.
 */
function estimateDriveMinutes(km) {
  const k = Number(km);
  if (!Number.isFinite(k) || k < 0) return null;
  return Math.max(3, Math.round(k * 3));
}

/** Human commute label, e.g. "~12 min" or "~1h 5m". Returns "" when distance is unknown. */
function formatCommute(km) {
  const mins = estimateDriveMinutes(km);
  if (mins == null) return "";
  if (mins < 60) return `~${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `~${h}h ${m}m` : `~${h}h`;
}

/**
 * On phones the map is a short strip above the listing drawer; centering the pin in the map pane
 * leaves it visually near the bottom (obscured by the sheet / FAB). Nudge the map center slightly
 * south (lower lat) so the property sits higher in the visible area.
 */
const MOBILE_LISTING_FOCUS_LAT_OFFSET = 0.0018;

function mapStateForListingFocus(lat, lng, isMobile) {
  const la = Number(lat);
  const ln = Number(lng);
  const offset = isMobile ? MOBILE_LISTING_FOCUS_LAT_OFFSET : 0;
  return { center: [la - offset, ln], zoom: 17 };
}

function MediaElement({ src, alt, style }) {
  if (!src) return null;
  const isVideo = src.match(/\.(mp4|webm|ogg|mov)$/i) || src.includes('video');
  if (isVideo) {
    return <video src={src} style={style} autoPlay muted loop playsInline />;
  }
  return <img src={src} alt={alt} loading="lazy" style={style} />;
}

function listingCoverSrc(listing) {
  const primary = String(listing?.image || "").trim();
  if (primary) return primary;
  if (Array.isArray(listing?.images)) {
    const first = listing.images.map((x) => String(x || "").trim()).find(Boolean);
    if (first) return first;
  }
  return "";
}

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const bhkColors = {
  "1 RK": "#10b981",
  "1 BHK": "#2563eb",
  "2 BHK": "#EF5A45",
  "2.5 BHK": "#f97316",
  "3 BHK": "#9333ea",
  "3+ BHK": "#0d9488",
  "Roommate needed": "#ca8a04",
};

const AREA_ANCHORS = {
  "HSR Layout": { lat: 12.9141, lng: 77.6411 },
  "Indiranagar": { lat: 12.9719, lng: 77.6412 },
  "Koramangala": { lat: 12.9352, lng: 77.6245 },
  "Whitefield": { lat: 12.9698, lng: 77.75 },
  "Bellandur": { lat: 12.93, lng: 77.6762 },
  "Jayanagar": { lat: 12.925, lng: 77.5938 },
  "Hebbal": { lat: 13.0358, lng: 77.597 },
  "Sarjapur Road": { lat: 12.8996, lng: 77.6815 },
  "Mahadevpura": { lat: 12.9516, lng: 77.68 },
};

/** Top-bar "Flat type" quick filter — a curated subset of FILTER_OPTIONS.bhkTypes, all checked by default. */
const QUICK_FLAT_TYPES = [
  { value: "1 BHK", label: "1 BHK" },
  { value: "2 BHK", label: "2 BHK" },
  { value: "3 BHK", label: "3 BHK" },
  { value: "Roommate needed", label: "Room in Preoccupied flat (cost effective)" },
];

/** Top-bar "Budget" quick filter presets — mirrors DEFAULT_FILTERS' 10k–100k rent range. */
const BUDGET_STEPS = [10000, 15000, 20000, 25000, 30000, 40000, 50000, 60000, 75000, 90000, 100000];

function formatBudget(v) {
  return v >= 100000 ? "₹1L+" : `₹${Math.round(v / 1000)}k`;
}

function makeBhkIcon(bhk) {
  const c = bhkColors[bhk] || "#6b7280";
  return L.divIcon({
    className: "",
    html:
      '<div style="background:' +
      c +
      ';color:white;padding:6px 14px;border-radius:22px;font-size:15px;font-weight:800;white-space:nowrap;border:2px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.35)">' +
      bhk +
      "</div>",
    iconSize: [72, 30],
    iconAnchor: [36, 15],
  });
}

/** Distinct draggable "office" pin so users can tell it apart from listing markers and know it's movable. */
function makeOfficeIcon() {
  return L.divIcon({
    className: "",
    html:
      '<div style="position:relative;display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.3))">' +
      '<div style="background:#1C1A17;color:#fff;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap;border:2px solid #fff;display:flex;align-items:center;gap:5px">' +
      '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#f3cd6a" stroke-width="2.4"><rect x="4" y="8" width="16" height="12" rx="1"/><path d="M9 8V5h6v3" stroke-linecap="round"/></svg>' +
      'Office</div>' +
      '<div style="width:2px;height:12px;background:#1C1A17"></div>' +
      '<div style="width:10px;height:10px;border-radius:50%;background:#1C1A17;border:2px solid #fff;margin-top:-2px"></div>' +
      "</div>",
    iconSize: [80, 44],
    iconAnchor: [40, 44],
  });
}

function ChangeView({ center, zoom }) {
  const map = useMap();
  const lat = center?.[0];
  const lng = center?.[1];
  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.invalidateSize();
    map.setView([lat, lng], zoom, { animate: false });
  }, [map, lat, lng, zoom]);
  return null;
}

/** Zoom map to show listing pins; optional fallback center when the filtered set is empty.
 *  Important: do not put `fallbackCenter` in the effect dependency array — it was tied to map pan/hover
 *  and caused fitBounds to re-run on every listing-card hover (zoomed-out map). */
function FitListingsBounds({ listings, enabled, fallbackCenter, fallbackZoom = 14 }) {
  const map = useMap();
  const signature = listings.map((l) => l.id).join(",");
  const fallbackRef = useRef(null);
  const fb0 = fallbackCenter?.[0];
  const fb1 = fallbackCenter?.[1];
  useEffect(() => {
    fallbackRef.current =
      Number.isFinite(fb0) && Number.isFinite(fb1) ? [fb0, fb1] : null;
  }, [fb0, fb1]);
  useEffect(() => {
    if (!enabled) return;
    const pts = listings
      .filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng))
      .map((l) => [l.lat, l.lng]);
    const fc = fallbackRef.current;
    requestAnimationFrame(() => {
      if (pts.length === 1) {
        map.setView(pts[0], 17, { animate: false });
        return;
      }
      if (pts.length > 1) {
        const b = L.latLngBounds(pts);
        map.fitBounds(b, { padding: [36, 36], maxZoom: 17, animate: false });
        return;
      }
      if (fc && Number.isFinite(fc[0]) && Number.isFinite(fc[1])) {
        map.setView(fc, fallbackZoom, { animate: false });
      }
    });
  }, [map, signature, enabled, listings.length, fallbackZoom]);
  return null;
}

/** Leaflet caches tile layout size; must invalidate when sidebars / mode change or the map leaves a grey gap. */
function InvalidateMapSize({ layoutRevision }) {
  const map = useMap();
  useEffect(() => {
    const nudge = () => {
      map.invalidateSize({ animate: false, pan: false });
    };
    nudge();
    const raf = requestAnimationFrame(nudge);
    const t1 = setTimeout(nudge, 80);
    const t2 = setTimeout(nudge, 280);
    // Mobile rotate: some browsers don't fire a clean resize for Leaflet.
    window.addEventListener("orientationchange", nudge);
    window.addEventListener("resize", nudge);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("orientationchange", nudge);
      window.removeEventListener("resize", nudge);
    };
  }, [map, layoutRevision]);
  return null;
}

function ToggleOption({ label, active, onClick, activeColor = "#EF5A45" }) {
  // Convert hex color to an RGBA with low opacity for the background
  const getLightBg = (hex) => {
    if (hex.startsWith("#") && hex.length === 7) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, 0.15)`;
    }
    return "#FBE4DF";
  };

  return (
    <button
      onClick={onClick}
      style={{
        border: active ? `1px solid ${activeColor}` : "1px solid #e2e8f0",
        background: active ? getLightBg(activeColor) : "white",
        color: active ? activeColor : "#0f172a",
        borderRadius: "10px",
        padding: "8px 14px",
        fontSize: "14px",
        fontWeight: 700,
        cursor: "pointer",
        transition: "all 0.2s"
      }}
    >
      {label}
    </button>
  );
}

/* ── Top-bar chrome ────────────────────────────────────────────────────────── */

const mtBar = {
  navGhost: {
    border: "1px solid transparent",
    background: "transparent",
    color: "#5c554e",
    borderRadius: 999,
    padding: "9px 18px",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    cursor: "pointer",
  },
  navAdmin: {
    border: "1px solid #f3c9bc",
    background: "#fdeee9",
    color: "#d8412b",
    borderRadius: 999,
    padding: "9px 18px",
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    cursor: "pointer",
  },
  select: {
    border: "1px solid #e9e3db",
    background: "#fff",
    color: "#171412",
    borderRadius: 999,
    padding: "11px 16px",
    fontSize: 13.5,
    fontWeight: 600,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    cursor: "pointer",
    flexShrink: 0,
  },
  filtersBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #e9e3db",
    background: "#fff",
    color: "#171412",
    borderRadius: 999,
    padding: "11px 18px",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    cursor: "pointer",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
  searchBtn: {
    flexShrink: 0,
    border: "none",
    borderRadius: 999,
    background: "#ee5b45",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14.5,
    fontWeight: 700,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    padding: "12px 26px",
    boxShadow: "0 2px 8px rgba(238,91,69,.32)",
  },
};

/** Small removable pill showing the active place/workplace/area anchor, sitting under the search bar. */
function AnchorChip({ tone, label, onRemove }) {
  const palette =
    tone === "warm"
      ? { bg: "#FBEAE0", fg: "#8a4a1f", chipBtn: "rgba(138,74,31,0.14)" }
      : { bg: "#EAF1FB", fg: "#1d4ed8", chipBtn: "rgba(29,78,216,0.12)" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: palette.bg,
        color: palette.fg,
        borderRadius: 999,
        padding: "6px 8px 6px 12px",
        fontSize: 12.5,
        fontWeight: 700,
        maxWidth: "100%",
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <button
        type="button"
        aria-label="Remove"
        onClick={onRemove}
        style={{
          border: "none",
          background: palette.chipBtn,
          color: palette.fg,
          width: 20,
          height: 20,
          borderRadius: 999,
          cursor: "pointer",
          fontSize: 13,
          lineHeight: 1,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </span>
  );
}

/** Suggestions dropdown anchored under the top-bar search input — campuses, employers, commute radius. */
function MapSearchSuggestions({
  mapSearchOverlayBodyRef,
  workplaceAnchor,
  workplaceError,
  commuteRadiusKm,
  setCommuteRadiusKm,
  applyWorkplaceFromList,
  setMapSearchInput,
  mapSearchError,
  placeAnchor,
  onClose,
  openFullFilterPanel,
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        left: 0,
        right: 0,
        zIndex: 1005,
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 20px 50px rgba(20,18,16,0.18), 0 0 0 1px rgba(20,18,16,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        ref={mapSearchOverlayBodyRef}
        style={{ maxHeight: "min(60vh, 460px)", overflowY: "auto", WebkitOverflowScrolling: "touch" }}
      >
        {workplaceError ? (
          <div style={{ padding: "10px 16px", fontSize: 12, color: "#B23A28", fontWeight: 600, background: "#fdf1ec" }}>{workplaceError}</div>
        ) : null}

        {workplaceAnchor && !workplaceError ? (
          <div
            style={{
              padding: "12px 16px",
              fontSize: 12.5,
              color: "#3a1f1a",
              background: "#FBEAE0",
              lineHeight: 1.45,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>
              Within <strong>{commuteRadiusKm} km</strong> of <strong>{workplaceAnchor.label}</strong> — nearest first
            </span>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "#6b4226" }}>
              Max distance
              <select
                value={commuteRadiusKm}
                onChange={(e) => setCommuteRadiusKm(Number(e.target.value))}
                style={{ border: "1px solid #e8c4ae", borderRadius: 10, padding: "7px 9px", fontSize: 12.5, fontWeight: 700, background: "#fff", color: "#3a1f1a" }}
              >
                {[5, 8, 10, 12, 15, 20, 25, 30].map((km) => (
                  <option key={km} value={km}>{km} km</option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <div style={{ padding: "14px 16px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8a857c", marginBottom: 9, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Popular campuses
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {BANGALORE_WORKPLACES.map((wp) => (
              <button
                key={wp.id}
                type="button"
                onClick={() => { applyWorkplaceFromList(wp); onClose(); }}
                style={{
                  border: workplaceAnchor?.label === wp.name ? "1.5px solid #EF5A45" : "1px solid #e4dfd6",
                  background: workplaceAnchor?.label === wp.name ? "#FBEAE0" : "#faf8f4",
                  borderRadius: 999,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: workplaceAnchor?.label === wp.name ? "#B23A28" : "#4a443d",
                  cursor: "pointer",
                  maxWidth: "100%",
                  textAlign: "left",
                }}
              >
                {wp.name}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: "#8a857c", margin: "16px 0 9px", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Employers
          </div>
          <p style={{ margin: "0 0 8px", fontSize: 11.5, color: "#8a857c", lineHeight: 1.5 }}>
            Tap a company, or switch to <strong style={{ color: "#4a443d" }}>Metro</strong> mode and search any address.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 110, overflowY: "auto" }}>
            {EMPLOYER_SEARCH_CHIPS.map((chip) => (
              <button
                key={chip.key}
                type="button"
                title={`Set workplace to ${chip.wp.name}`}
                onClick={() => { applyWorkplaceFromList(chip.wp); setMapSearchInput(""); onClose(); }}
                style={{
                  border: workplaceAnchor?.label === chip.wp.name ? "1.5px solid #EF5A45" : "1px solid #e4dfd6",
                  background: workplaceAnchor?.label === chip.wp.name ? "#FBEAE0" : "#fff",
                  borderRadius: 999,
                  padding: "5px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#4a443d",
                  cursor: "pointer",
                  maxWidth: "100%",
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {(mapSearchError || placeAnchor) && (
          <div style={{ borderTop: "1px solid #f1efe9", padding: "10px 16px 12px", fontSize: 12, lineHeight: 1.45 }}>
            {mapSearchError ? <div style={{ color: "#B23A28", fontWeight: 600 }}>{mapSearchError}</div> : null}
            {placeAnchor && !mapSearchError ? (
              <div style={{ color: "#8a857c" }}>
                Showing within ~{MAP_NEARBY_KM} km of <strong style={{ color: "#4a443d" }}>{placeAnchor.label}</strong>
              </div>
            ) : null}
          </div>
        )}

        <div style={{ borderTop: "1px solid #f1efe9", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#faf8f4" }}>
          <button type="button" onClick={() => { openFullFilterPanel(); onClose(); }} style={{ border: "none", background: "none", color: "#B23A28", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            Open full filter panel →
          </button>
          <button type="button" onClick={onClose} style={{ border: "1px solid #e4dfd6", background: "#fff", color: "#4a443d", fontSize: 12, fontWeight: 700, borderRadius: 9, padding: "7px 12px", cursor: "pointer" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MapView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { openLogin } = useLoginModal();
  const [showAgentChat, setShowAgentChat] = useState(false);
  const [listings, setListings] = useState([]);
  /** Central Bangalore — street-level default for local inventory */
  const [mapState, setMapState] = useState({ center: [12.9716, 77.5946], zoom: 15 });
  const [selected, setSelected] = useState(null);
  const [viewingProperty, setViewingProperty] = useState(null);
  /** Single "all filters" panel — a dropdown on desktop, a bottom sheet on mobile. Never occupies map layout. */
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  /** "map" | "list" — replaces the old slide-up toggle; on mobile these are fully separate screens */
  const [mobileTab, setMobileTab] = useState("map");
  /** "all" | "flatmate" | "entire" */
  const [listingType, setListingType] = useState("all");
  const [filters, setFilters] = useState(getFiltersInitialState());
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 768 : false);
  const [selectedLocality, setSelectedLocality] = useState("");
  const [mapSearchInput, setMapSearchInput] = useState("");
  const [mapSearchLoading, setMapSearchLoading] = useState(false);
  const [mapSearchError, setMapSearchError] = useState("");
  const [placeAnchor, setPlaceAnchor] = useState(null);
  const [desktopMode, setDesktopMode] = useState("split");
  const [showDesktopListings, setShowDesktopListings] = useState(true);
  /** Search suggestions dropdown (campuses / employers / commute radius), anchored under the top-bar search box. */
  const [showMapSearchOverlay, setShowMapSearchOverlay] = useState(false);
  /** Top-bar "Flat type" checklist dropdown (1/2/3 BHK + Roommate). */
  const [showFlatTypeMenu, setShowFlatTypeMenu] = useState(false);
  /** Top-bar "Budget" min/max dropdown. */
  const [showBudgetMenu, setShowBudgetMenu] = useState(false);
  /** 'local' = filter listings by area name; 'place' = geocode landmark / metro and radius filter */
  const [searchMode, setSearchMode] = useState("local");
  const [helpWidgetOpen, setHelpWidgetOpen] = useState(false);
  const [workplaceAnchor, setWorkplaceAnchor] = useState(null);
  const [workplaceError, setWorkplaceError] = useState("");
  /** Max distance from workplace (or geocoded “Metro” pin) for filtering + map circle. */
  const [commuteRadiusKm, setCommuteRadiusKm] = useState(DEFAULT_COMMUTE_RADIUS_KM);
  const [, setSavedRevision] = useState(0);
  const mapSearchOverlayBodyRef = useRef(null);
  /** [lat, lng][] from workplace → selected listing (OSRM driving line, or straight fallback). */
  const [commuteRoutePositions, setCommuteRoutePositions] = useState(null);
  /** Live office-location autocomplete (Photon) results + open/active state for the top-bar search box. */
  const [officeResults, setOfficeResults] = useState([]);
  const [officeResultsOpen, setOfficeResultsOpen] = useState(false);
  const [officeResultsLoading, setOfficeResultsLoading] = useState(false);
  const [activeResult, setActiveResult] = useState(-1);
  /** True while a dragged office pin is being reverse-geocoded to a readable address. */
  const [officePinBusy, setOfficePinBusy] = useState(false);
  /** Set right after picking a suggestion / preset so the debounced search effect doesn't re-open the list. */
  const justPickedOffice = useRef(false);

  const openFullFilterPanel = useCallback(() => {
    setShowFilterPanel(true);
    setShowMapSearchOverlay(false);
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadListings() {
      // Extract primary filters for server-side optimization
      const bhk = filters.bhkTypes.length === 1 ? filters.bhkTypes[0] : null;
      const maxRent = filters.maxRent < 100000 ? filters.maxRent : null;
      
      const options = {
        limitCount: isMobile ? 250 : 500,
        bhk,
        maxRent
      };

      // Static/verified feed + user-uploaded inventory (Supabase), merged so newly
      // listed homes show on the map. Both are fetched in parallel; either can be empty.
      const [staticRows, inventoryRows] = await Promise.all([
        isFirebaseConfigured ? getListingsData(options) : Promise.resolve([]),
        fetchInventoryAsListings({ limit: isMobile ? 250 : 500 }).catch(() => []),
      ]);
      if (alive) {
        const feed = staticRows.filter(isListingPubliclyVisible);
        // De-dupe by id, letting uploaded inventory win over any static row with the same id.
        const byId = new Map();
        for (const l of feed) byId.set(String(l.id), l);
        for (const l of inventoryRows) byId.set(String(l.id), l);
        setListings(Array.from(byId.values()));
      }
    }
    loadListings().catch((err) => {
      reportClientWarn("map_listings_query", "Listings query failed", err);
      setListings([]);
    });
    return () => { alive = false; };
  }, [filters.bhkTypes, filters.maxRent, filters.neighborhoods, isMobile]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const listingIdFromUrl = useMemo(() => new URLSearchParams(location.search).get("listingId") || "", [location.search]);

  /** Hero / deep link: always derive filters from URL (avoids stale BHK/rent from a previous session). */
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const base = getFiltersInitialState();
    const locality = qs.get("locality") || "";
    const bhk = qs.get("bhk");
    const propertyType = qs.get("propertyType");
    const minRent = Number(qs.get("minRent") || 0);
    const maxRent = Number(qs.get("maxRent") || 0);
    const availabilityParam = (qs.get("availability") || "").trim();
    const availabilityFromUrl =
      availabilityParam && FILTER_OPTIONS.availability.includes(availabilityParam) ? [availabilityParam] : [];
    setSelectedLocality(locality);
    setMapSearchInput(locality);
    const locNorm = locality.trim();
    const neighborhoodFromUrl = locNorm && AREA_NAMES_SORTED.includes(locNorm) ? [locNorm] : [];
    setFilters({
      ...base,
      bhkTypes: bhk ? [bhk] : [],
      propertyTypes: propertyType ? [propertyType] : [],
      minRent: minRent > 0 ? minRent : base.minRent,
      maxRent: maxRent > 0 ? maxRent : base.maxRent,
      neighborhoods: neighborhoodFromUrl,
      availability: availabilityFromUrl,
    });
  }, [location.search]);

  /** Hero “More Filters” opens the map with the filter drawer visible. */
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    if (qs.get("openFilters") !== "1") return;
    const id = requestAnimationFrame(() => {
      openFullFilterPanel();
      qs.delete("openFilters");
      const rest = qs.toString();
      navigate({ pathname: location.pathname, search: rest ? `?${rest}` : "" }, { replace: true });
    });
    return () => cancelAnimationFrame(id);
  }, [location.search, location.pathname, navigate, openFullFilterPanel]);

  useEffect(() => {
    const payload = consumeMapRestorePayload();
    if (!payload || typeof payload !== "object") return;
    if (payload.filters && typeof payload.filters === "object") {
      setFilters((prev) => ({
        ...prev,
        ...payload.filters,
        neighborhoods: Array.isArray(payload.filters.neighborhoods) ? payload.filters.neighborhoods : prev.neighborhoods || [],
      }));
    }
    if (payload.selectedLocality !== undefined) setSelectedLocality(String(payload.selectedLocality || ""));
    if (payload.mapSearchInput !== undefined) setMapSearchInput(String(payload.mapSearchInput || ""));
    if (payload.searchMode === "local" || payload.searchMode === "place") setSearchMode(payload.searchMode);
    if (payload.placeAnchor && Number.isFinite(payload.placeAnchor.lat)) {
      setPlaceAnchor({
        lat: payload.placeAnchor.lat,
        lng: payload.placeAnchor.lng,
        label: String(payload.placeAnchor.label || "Saved place"),
      });
    } else if (payload.placeAnchor === null) setPlaceAnchor(null);
    if (payload.workplaceAnchor && Number.isFinite(payload.workplaceAnchor.lat)) {
      setWorkplaceAnchor({
        lat: payload.workplaceAnchor.lat,
        lng: payload.workplaceAnchor.lng,
        label: String(payload.workplaceAnchor.label || "Office"),
      });
    } else if (payload.workplaceAnchor === null) setWorkplaceAnchor(null);
    if (payload.commuteRadiusKm != null) {
      const r = Number(payload.commuteRadiusKm);
      if (Number.isFinite(r) && r >= 1 && r <= 50) setCommuteRadiusKm(r);
    }
  }, []);

  useEffect(() => {
    if (!listingIdFromUrl || !listings.length) return;
    const found = listings.find((l) => String(l.id) === String(listingIdFromUrl));
    if (!found) return;
    setViewingProperty(found);
    setSelected(found);
    setMapState(mapStateForListingFocus(found.lat, found.lng, isMobile));
  }, [listingIdFromUrl, listings, isMobile]);

  useEffect(() => {
    if (!workplaceAnchor || !selected || !Number.isFinite(Number(selected.lat)) || !Number.isFinite(Number(selected.lng))) {
      setCommuteRoutePositions(null);
      return;
    }
    const lat0 = workplaceAnchor.lat;
    const lng0 = workplaceAnchor.lng;
    const lat1 = Number(selected.lat);
    const lng1 = Number(selected.lng);
    let cancelled = false;
    setCommuteRoutePositions([
      [lat0, lng0],
      [lat1, lng1],
    ]);
    const url = `https://router.project-osrm.org/route/v1/driving/${lng0},${lat0};${lng1},${lat1}?overview=full&geometries=geojson`;
    fetch(url, { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("route http"))))
      .then((data) => {
        if (cancelled) return;
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (Array.isArray(coords) && coords.length >= 2) {
          setCommuteRoutePositions(coords.map((pt) => [pt[1], pt[0]]));
        }
      })
      .catch(() => {
        reportClientWarn("map_osrm_route", "OSRM route failed; straight line kept");
      });
    return () => {
      cancelled = true;
    };
  }, [workplaceAnchor?.lat, workplaceAnchor?.lng, selected?.id, selected?.lat, selected?.lng]);

  const filteredListings = useMemo(() => {
    let base = applyListingFilters(listings, filters);
    if (listingType === "flatmate") {
      base = base.filter((l) => l.bhk === "Roommate needed");
    } else if (listingType === "entire") {
      base = base.filter((l) => l.bhk !== "Roommate needed");
    }
    if (!selectedLocality.trim()) return base;
    const q = selectedLocality.toLowerCase().trim();
    return base.filter((l) =>
      [l.title, l.address, l.location, l.seller, l.company, l.sellerEmail]
        .filter(Boolean)
        .some((text) => String(text).toLowerCase().includes(q))
    );
  }, [listings, filters, selectedLocality, listingType]);

  const mapListings = useMemo(() => {
    let rows = filteredListings;
    if (placeAnchor) {
      rows = rows.filter((l) => {
        if (!Number.isFinite(Number(l.lat)) || !Number.isFinite(Number(l.lng))) return false;
        return haversineKm(placeAnchor.lat, placeAnchor.lng, Number(l.lat), Number(l.lng)) <= MAP_NEARBY_KM;
      });
    }
    if (workplaceAnchor) {
      rows = rows.filter((l) => {
        if (!Number.isFinite(Number(l.lat)) || !Number.isFinite(Number(l.lng))) return false;
        return haversineKm(workplaceAnchor.lat, workplaceAnchor.lng, Number(l.lat), Number(l.lng)) <= commuteRadiusKm;
      });
    }
    const sortAnchor = workplaceAnchor || placeAnchor;
    if (sortAnchor && rows.length) {
      rows = [...rows].sort((a, b) => {
        const da = haversineKm(sortAnchor.lat, sortAnchor.lng, Number(a.lat), Number(a.lng));
        const db = haversineKm(sortAnchor.lat, sortAnchor.lng, Number(b.lat), Number(b.lng));
        return da - db;
      });
    }
    return rows;
  }, [filteredListings, placeAnchor, workplaceAnchor, commuteRadiusKm]);

  /** If strict filters + commute pins hide everything, still show pins so the map is never a blank void. */
  const relaxedFallbackListings = useMemo(() => {
    if (mapListings.length > 0) return [];
    let rows = listings.filter((l) => Number.isFinite(Number(l.lat)) && Number.isFinite(Number(l.lng)));
    const loc = selectedLocality.trim().toLowerCase();
    const anchor =
      !placeAnchor && !workplaceAnchor && selectedLocality && AREA_ANCHORS[selectedLocality]
        ? AREA_ANCHORS[selectedLocality]
        : null;

    // If a user taps an area like "HSR Layout", show nearby sector listings even if text doesn't include "HSR Layout".
    if (anchor) {
      const radiusKm = 7;
      rows = rows
        .filter((l) => haversineKm(anchor.lat, anchor.lng, Number(l.lat), Number(l.lng)) <= radiusKm)
        .sort((a, b) => {
          const da = haversineKm(anchor.lat, anchor.lng, Number(a.lat), Number(a.lng));
          const db = haversineKm(anchor.lat, anchor.lng, Number(b.lat), Number(b.lng));
          return da - db;
        });
    } else if (loc) {
      rows = rows.filter((l) =>
        [l.title, l.address, l.location, l.seller, l.company, l.sellerEmail]
          .filter(Boolean)
          .some((text) => String(text).toLowerCase().includes(loc))
      );
    }
    if (placeAnchor) {
      rows = rows.filter((l) => haversineKm(placeAnchor.lat, placeAnchor.lng, Number(l.lat), Number(l.lng)) <= MAP_NEARBY_KM);
    }
    if (workplaceAnchor) {
      rows = rows.filter((l) => haversineKm(workplaceAnchor.lat, workplaceAnchor.lng, Number(l.lat), Number(l.lng)) <= commuteRadiusKm);
    }
    const sortAnchor = workplaceAnchor || placeAnchor;
    if (sortAnchor && rows.length) {
      rows = [...rows].sort((a, b) => {
        const da = haversineKm(sortAnchor.lat, sortAnchor.lng, Number(a.lat), Number(a.lng));
        const db = haversineKm(sortAnchor.lat, sortAnchor.lng, Number(b.lat), Number(b.lng));
        return da - db;
      });
    }
    return rows.slice(0, 500);
  }, [mapListings.length, listings, selectedLocality, placeAnchor, workplaceAnchor, commuteRadiusKm]);

  const displayPins = useMemo(() => {
    if (mapListings.length > 0) return mapListings;
    if (relaxedFallbackListings.length > 0) return relaxedFallbackListings;
    return listings.filter((l) => Number.isFinite(Number(l.lat)) && Number.isFinite(Number(l.lng))).slice(0, 500);
  }, [mapListings, relaxedFallbackListings, listings]);

  const usingRelaxedPins = mapListings.length === 0 && displayPins.length > 0;

  /** List-panel-only sort — never touches `displayPins` itself, so map marker order/behavior is untouched. */
  const [sortBy, setSortBy] = useState("best");
  const sortedDisplayPins = useMemo(() => {
    if (sortBy === "price-asc") return [...displayPins].sort((a, b) => (Number(a.monthlyRent) || 0) - (Number(b.monthlyRent) || 0));
    if (sortBy === "price-desc") return [...displayPins].sort((a, b) => (Number(b.monthlyRent) || 0) - (Number(a.monthlyRent) || 0));
    return displayPins;
  }, [displayPins, sortBy]);

  useEffect(() => {
    const t = setTimeout(() => {
      appendFilterHistory(user, {
        filters: JSON.parse(JSON.stringify(filters)),
        selectedLocality,
        searchMode,
        placeLabel: placeAnchor?.label || "",
        workplaceLabel: workplaceAnchor?.label || "",
        placeLat: placeAnchor?.lat,
        placeLng: placeAnchor?.lng,
        workLat: workplaceAnchor?.lat,
        workLng: workplaceAnchor?.lng,
        commuteRadiusKm,
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [user, filters, selectedLocality, searchMode, placeAnchor, workplaceAnchor, commuteRadiusKm]);

  const runMapPlaceSearch = async () => {
    const q = mapSearchInput.trim();
    setMapSearchError("");
    if (!q) {
      setPlaceAnchor(null);
      setWorkplaceAnchor(null);
      setSelectedLocality("");
      return;
    }
    setMapSearchLoading(true);
    try {
      const r = await geocodePlace(q);
      if (r.ok) {
        setPlaceAnchor(null);
        setWorkplaceAnchor({ lat: r.lat, lng: r.lng, label: r.displayName });
        setMapState({ center: [r.lat, r.lng], zoom: 16 });
        setSelectedLocality("");
        setMapSearchError("");
      } else {
        setPlaceAnchor(null);
        setWorkplaceAnchor(null);
        setSelectedLocality(q);
        setMapSearchError(r.error || "");
      }
    } catch {
      setMapSearchError("Search failed. Check your connection.");
    } finally {
      setMapSearchLoading(false);
    }
  };

  const runMapLocalSearch = () => {
    const q = mapSearchInput.trim();
    setMapSearchError("");
    setPlaceAnchor(null);
    setWorkplaceAnchor(null);
    if (!q) {
      setSelectedLocality("");
      return;
    }
    setSelectedLocality(q);
  };

  const submitMapSearch = async () => {
    const q = mapSearchInput.trim();
    setMapSearchError("");
    setWorkplaceError("");
    if (!q) {
      setPlaceAnchor(null);
      setSelectedLocality("");
      setWorkplaceAnchor(null);
      setCommuteRadiusKm(DEFAULT_COMMUTE_RADIUS_KM);
      return;
    }
    const preset = matchWorkplacePreset(q);
    if (preset) {
      applyWorkplaceFromList(preset);
      setMapSearchInput("");
      return;
    }
    if (searchMode === "place") {
      await runMapPlaceSearch();
    } else {
      runMapLocalSearch();
    }
  };

  const chipLabel = (text, max = 22) => {
    const t = String(text || "").trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
  };

  const firstLocalitySig = filteredListings[0]
    ? `${filteredListings[0].id}:${filteredListings[0].lat}:${filteredListings[0].lng}`
    : "";
  useEffect(() => {
    const loc = selectedLocality.trim();
    if (!loc || !firstLocalitySig) return;
    const first = filteredListings[0];
    if (!first) return;
    setMapState({ center: [first.lat, first.lng], zoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- firstLocalitySig tracks the first row; avoid running on every filteredListings identity change
  }, [selectedLocality, firstLocalitySig]);

  /** Area search with zero strict rows: center map on the neighborhood name. */
  useEffect(() => {
    if (!selectedLocality.trim() || filteredListings.length > 0 || listingIdFromUrl) return;
    let cancelled = false;
    (async () => {
      const r = await geocodePlace(`${selectedLocality.trim()}, Bengaluru, India`);
      if (cancelled || !r.ok) return;
      setMapState({ center: [r.lat, r.lng], zoom: 15 });
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedLocality, filteredListings.length, listingIdFromUrl]);

  const toggleFilter = (key, value) => {
    setFilters((prev) => {
      const exists = prev[key].includes(value);
      const next = exists ? prev[key].filter((v) => v !== value) : [...prev[key], value];
      return { ...prev, [key]: next };
    });
  };

  /**
   * Quick "Flat type" checklist — all types checked by default (empty bhkTypes = no filter).
   * Unchecking a box expands the implicit "everything" baseline to the full FILTER_OPTIONS.bhkTypes
   * list minus that value, so 1 RK / 2.5 BHK / 3+ BHK (not offered here) stay visible unless the
   * full filter panel is used. Re-checking back to the full set collapses back to [] (no filter).
   */
  const toggleQuickFlatType = (value) => {
    setFilters((prev) => {
      const base = prev.bhkTypes.length ? prev.bhkTypes : FILTER_OPTIONS.bhkTypes;
      const isChecked = base.includes(value);
      const next = isChecked ? base.filter((v) => v !== value) : [...base, value];
      const isFullSet = next.length === FILTER_OPTIONS.bhkTypes.length && FILTER_OPTIONS.bhkTypes.every((t) => next.includes(t));
      return { ...prev, bhkTypes: isFullSet ? [] : next };
    });
  };

  const toggleNeighborhood = (name) => {
    setFilters((prev) => {
      const n = prev.neighborhoods || [];
      const exists = n.includes(name);
      const next = exists ? n.filter((x) => x !== name) : [...n, name];
      return { ...prev, neighborhoods: next };
    });
  };

  /** Debounced live autocomplete for the office-location search box (Photon, Bangalore-biased). */
  useEffect(() => {
    const q = mapSearchInput.trim();
    if (justPickedOffice.current) { justPickedOffice.current = false; return; }
    if (q.length < 3) {
      setOfficeResults([]);
      setOfficeResultsOpen(false);
      setOfficeResultsLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setOfficeResultsLoading(true);
    const t = setTimeout(async () => {
      try {
        const rows = await searchPlaces(q, { limit: 6, signal: ctrl.signal });
        setOfficeResults(rows);
        setActiveResult(-1);
        setOfficeResultsOpen(true);
      } catch {
        /* aborted / network — keep prior results */
      } finally {
        setOfficeResultsLoading(false);
      }
    }, 220);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [mapSearchInput]);

  /** Selecting an autocomplete suggestion drops the office pin there and recenters the map. */
  const pickOfficeResult = useCallback((r) => {
    if (!r || !Number.isFinite(Number(r.lat)) || !Number.isFinite(Number(r.lng))) return;
    justPickedOffice.current = true;
    setWorkplaceError("");
    setMapSearchError("");
    setPlaceAnchor(null);
    setSelectedLocality("");
    setWorkplaceAnchor({ lat: Number(r.lat), lng: Number(r.lng), label: r.display || r.label || r.primary || "Office" });
    setMapState({ center: [Number(r.lat), Number(r.lng)], zoom: 16 });
    setMapSearchInput(r.display || r.label || r.primary || "");
    setOfficeResults([]);
    setOfficeResultsOpen(false);
    setActiveResult(-1);
    setShowMapSearchOverlay(false);
  }, []);

  /** Dragging (or clicking) the office pin: move it immediately, then reverse-geocode a readable address. */
  const moveOfficePin = useCallback(async (lat, lng) => {
    const la = Number(lat);
    const ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return;
    setPlaceAnchor(null);
    setWorkplaceError("");
    setWorkplaceAnchor((prev) => ({ lat: la, lng: ln, label: prev?.label || "Moving pin…" }));
    setOfficePinBusy(true);
    try {
      const r = await reverseGeocode(la, ln);
      const label = r?.label || r?.display || `Pinned office (${la.toFixed(4)}, ${ln.toFixed(4)})`;
      setWorkplaceAnchor({ lat: la, lng: ln, label });
      setMapSearchInput(label);
    } catch {
      setWorkplaceAnchor({ lat: la, lng: ln, label: `Pinned office (${la.toFixed(4)}, ${ln.toFixed(4)})` });
    } finally {
      setOfficePinBusy(false);
    }
  }, []);

  const applyWorkplaceFromList = useCallback((wp) => {
    justPickedOffice.current = true;
    setWorkplaceError("");
    setPlaceAnchor(null);
    setOfficeResults([]);
    setOfficeResultsOpen(false);
    setWorkplaceAnchor({ lat: wp.lat, lng: wp.lng, label: wp.name });
    setMapState({ center: [wp.lat, wp.lng], zoom: 16 });
    requestAnimationFrame(() => {
      mapSearchOverlayBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, []);

  const mapLayoutKey = `${desktopMode}|${showFilterPanel}|${showDesktopListings}|${showMapSearchOverlay}|${isMobile}`;
  /** Campus/employer card hides while the live autocomplete list or the filter panel is open. */
  const showMapSearchCard = showMapSearchOverlay && !officeResultsOpen && !showFilterPanel;

  const areaLabel = chipLabel(workplaceAnchor?.label || placeAnchor?.label || selectedLocality || "Bengaluru", 28);

  /** Count of non-default filter selections — drives the badge on the "All filters" button. */
  const activeFilterCount = useMemo(() => {
    let n = 0;
    n += (filters.bhkTypes?.length || 0);
    n += (filters.neighborhoods?.length || 0);
    n += (filters.availability?.length || 0);
    n += (filters.preferredTenants?.length || 0);
    n += (filters.propertyTypes?.length || 0);
    n += (filters.furnishing?.length || 0);
    n += (filters.parking?.length || 0);
    if (Number(filters.minRent) > 10000) n += 1;
    if (Number(filters.maxRent) < 100000) n += 1;
    if (listingType !== "all") n += 1;
    return n;
  }, [filters, listingType]);

  const clearAllFilters = useCallback(() => {
    setFilters(getFiltersInitialState());
    setListingType("all");
  }, []);

  /** Shared filter controls, rendered inside the dropdown (desktop) / bottom sheet (mobile). */
  const filterSections = (
    <>
      <div style={{ marginBottom: "18px" }}>
        <div style={{ fontWeight: 800, fontSize: "15px", marginBottom: "8px", color: "#0f172a" }}>Areas (tap — no typing)</div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            maxHeight: 200,
            overflowY: "auto",
            padding: "4px 2px",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            background: "#fff",
          }}
        >
          {AREA_NAMES_SORTED.map((name) => {
            const on = (filters.neighborhoods || []).includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleNeighborhood(name)}
                style={{
                  border: on ? "1px solid #EF5A45" : "1px solid #cbd5e1",
                  background: on ? "#fff1f2" : "#ffffff",
                  color: on ? "#EF5A45" : "#0f172a",
                  borderRadius: "999px",
                  padding: "6px 11px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {name}
              </button>
            );
          })}
        </div>
        {(filters.neighborhoods || []).length > 0 && (
          <button
            type="button"
            onClick={() => setFilters((p) => ({ ...p, neighborhoods: [] }))}
            style={{ marginTop: "8px", border: "none", background: "transparent", color: "#64748b", fontSize: "12px", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
          >
            Clear selected areas
          </button>
        )}
      </div>
      <div style={{ marginBottom: "18px" }}>
        <div style={{ fontWeight: 800, fontSize: "15px", marginBottom: "10px", color: "#0f172a" }}>Looking for</div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[["all", "All"], ["flatmate", "Flatmate"], ["entire", "Entire flat"]].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setListingType(val)}
              style={{
                border: listingType === val ? "1px solid #EF5A45" : "1px solid #e2e8f0",
                background: listingType === val ? "#EF5A45" : "#ffffff",
                color: listingType === val ? "#ffffff" : "#334155",
                borderRadius: "999px",
                padding: "7px 16px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "18px" }}>
        <div style={{ fontWeight: 800, fontSize: "15px", marginBottom: "10px", color: "#0f172a" }}>BHK Type</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          {FILTER_OPTIONS.bhkTypes.map((item) => (
            <ToggleOption
              key={item}
              label={item}
              active={filters.bhkTypes.includes(item)}
              onClick={() => toggleFilter("bhkTypes", item)}
              activeColor={bhkColors[item] || "#EF5A45"}
            />
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "18px" }}>
        <div style={{ fontWeight: 800, fontSize: "15px", marginBottom: "8px", color: "#0f172a" }}>Rent range: ₹ 10k to ₹ 1 Lakh</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <input className="mv-filter-num" type="number" value={filters.minRent} onChange={(e) => setFilters((p) => ({ ...p, minRent: Number(e.target.value || 0) }))} placeholder="Min" />
          <input className="mv-filter-num" type="number" value={filters.maxRent} onChange={(e) => setFilters((p) => ({ ...p, maxRent: Number(e.target.value || 0) }))} placeholder="Max" />
        </div>
      </div>

      {[
        ["availability", "Availability"],
        ["preferredTenants", "Preferred tenants"],
        ["propertyTypes", "Property type"],
        ["furnishing", "Furnishing"],
        ["parking", "Parking"],
      ].map(([key, label]) => (
        <div key={key} style={{ marginBottom: "18px" }}>
          <div style={{ fontWeight: 800, fontSize: "15px", marginBottom: "10px", color: "#0f172a" }}>{label}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {FILTER_OPTIONS[key].map((item) => (
              <ToggleOption key={item} label={item} active={filters[key].includes(item)} onClick={() => toggleFilter(key, item)} />
            ))}
          </div>
        </div>
      ))}
    </>
  );

  // "Get My Free Agent" — gate on sign-in first, then open the AI preferences chat.
  const startAgentChat = () => {
    if (user) {
      setShowAgentChat(true);
    } else {
      openLogin(() => setShowAgentChat(true));
    }
  };

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{ background: "#faf7f2", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: "#171412" }}
    >
      <style>{`
        .mv-filter-num {
          width: 100%;
          padding: 10px 12px;
          font-size: 15px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: #fff;
        }
        .mobile-filter-btn {
          display: none;
        }
        @media (max-width: 768px) {
          .mobile-filter-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            background: #1C1A17;
            color: #fafafa;
            border: 1px solid #404040;
            padding: 10px 14px;
            border-radius: 10px;
            font-weight: 700;
            font-size: 13px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.35);
            cursor: pointer;
          }
        }
      `}</style>
      <div
        style={{
          background: "rgba(255,255,255,0.9)",
          borderBottom: "1px solid #e9e3db",
          position: "relative",
          zIndex: 1001,
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        }}
      >
        <MovEazyNav active="" onGetAgent={startAgentChat} />

        {/* Row 2: the search bar — area / company / campus, filters, view mode */}
        <div
          style={{
            padding: isMobile ? "10px 12px" : "14px 24px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ position: "relative", flex: "1 1 260px", minWidth: isMobile ? "100%" : 220, display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: 10,
                border: "1px solid #e9e3db",
                borderRadius: 999,
                background: "#faf7f2",
                padding: "5px 6px 5px 18px",
                transition: "border-color .18s, box-shadow .18s, background .18s",
              }}
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#948c83" strokeWidth="2.2" aria-hidden style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
              </svg>
              <input
                value={mapSearchInput}
                onChange={(e) => setMapSearchInput(e.target.value)}
                onFocus={() => { if (!officeResultsOpen) setShowMapSearchOverlay(true); }}
                onBlur={() => setTimeout(() => setOfficeResultsOpen(false), 150)}
                autoComplete="off"
                aria-label="Enter your office location"
                aria-autocomplete="list"
                aria-expanded={officeResultsOpen}
                onKeyDown={(e) => {
                  if (officeResultsOpen && officeResults.length) {
                    if (e.key === "ArrowDown") { e.preventDefault(); setActiveResult((i) => Math.min(i + 1, officeResults.length - 1)); return; }
                    if (e.key === "ArrowUp") { e.preventDefault(); setActiveResult((i) => Math.max(i - 1, 0)); return; }
                    if (e.key === "Escape") { setOfficeResultsOpen(false); return; }
                    if (e.key === "Enter") { e.preventDefault(); pickOfficeResult(officeResults[activeResult >= 0 ? activeResult : 0]); return; }
                  }
                  if (e.key === "Enter") { e.preventDefault(); submitMapSearch(); setShowMapSearchOverlay(false); }
                }}
                placeholder="Enter your Office Location"
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: "none",
                  background: "transparent",
                  padding: "8px 0",
                  fontSize: 15,
                  fontFamily: "inherit",
                  outline: "none",
                  color: "#171412",
                }}
              />
              <div style={{ display: "inline-flex", borderRadius: 999, background: "#fff", border: "1px solid #e9e3db", padding: 3, flexShrink: 0 }}>
                {["local", "place"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSearchMode(m)}
                    style={{
                      border: "none",
                      borderRadius: 999,
                      padding: "7px 13px",
                      fontSize: 12.5,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      cursor: "pointer",
                      background: searchMode === m ? "#171412" : "transparent",
                      color: searchMode === m ? "#fff" : "#5c554e",
                    }}
                  >
                    {m === "local" ? "Area" : "Metro"}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              disabled={mapSearchLoading}
              onClick={() => { submitMapSearch(); setShowMapSearchOverlay(false); }}
              style={mtBar.searchBtn}
            >
              {mapSearchLoading ? "…" : "Search"}
            </button>

            {officeResultsOpen && mapSearchInput.trim().length >= 3 ? (
              <div
                role="listbox"
                aria-label="Office location suggestions"
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: 0,
                  right: 0,
                  zIndex: 1006,
                  background: "#fff",
                  borderRadius: 16,
                  boxShadow: "0 20px 50px rgba(20,18,16,0.18), 0 0 0 1px rgba(20,18,16,0.06)",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "9px 16px 6px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#a39a8e" }}>
                  {officeResultsLoading && !officeResults.length ? "Searching…" : "Select your office location"}
                </div>
                {officeResults.length === 0 ? (
                  <div style={{ padding: "10px 16px 16px", fontSize: 13, color: "#8a857c" }}>
                    {officeResultsLoading ? "Finding places…" : "No matches — try a nearby landmark, tech park, or full address."}
                  </div>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: "2px 6px 8px", maxHeight: "min(52vh, 360px)", overflowY: "auto" }}>
                    {officeResults.map((r, i) => (
                      <li
                        key={r.id || i}
                        role="option"
                        aria-selected={i === activeResult}
                        onMouseDown={(e) => { e.preventDefault(); pickOfficeResult(r); }}
                        onMouseEnter={() => setActiveResult(i)}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          padding: "10px 12px",
                          borderRadius: 11,
                          cursor: "pointer",
                          background: i === activeResult ? "#FBEAE0" : "transparent",
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={i === activeResult ? "#D8432E" : "#a39a8e"} strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
                          <path d="M12 22s7-7.8 7-13a7 7 0 10-14 0c0 5.2 7 13 7 13z" /><circle cx="12" cy="9" r="2.5" />
                        </svg>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "#17140f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.primary}</span>
                          {r.secondary ? (
                            <span style={{ display: "block", fontSize: 11.5, color: "#8a857c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.secondary}</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {showMapSearchCard ? (
              <MapSearchSuggestions
                isMobile={isMobile}
                mapSearchOverlayBodyRef={mapSearchOverlayBodyRef}
                placeAnchor={placeAnchor}
                setPlaceAnchor={setPlaceAnchor}
                selectedLocality={selectedLocality}
                setSelectedLocality={setSelectedLocality}
                setMapSearchInput={setMapSearchInput}
                setMapSearchError={setMapSearchError}
                workplaceAnchor={workplaceAnchor}
                setWorkplaceAnchor={setWorkplaceAnchor}
                setWorkplaceError={setWorkplaceError}
                workplaceError={workplaceError}
                commuteRadiusKm={commuteRadiusKm}
                setCommuteRadiusKm={setCommuteRadiusKm}
                applyWorkplaceFromList={applyWorkplaceFromList}
                mapSearchError={mapSearchError}
                onClose={() => setShowMapSearchOverlay(false)}
                openFullFilterPanel={openFullFilterPanel}
                chipLabel={chipLabel}
              />
            ) : null}
          </div>

          <div style={{ position: "relative", flexShrink: 0 }}>
            <button type="button" onClick={() => setShowFlatTypeMenu((v) => !v)} style={mtBar.filtersBtn}>
              Flat type
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showFlatTypeMenu ? (
              <>
                <button
                  type="button"
                  aria-hidden="true"
                  tabIndex={-1}
                  onClick={() => setShowFlatTypeMenu(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 1004, background: "transparent", border: "none", cursor: "default" }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    left: 0,
                    zIndex: 1005,
                    minWidth: 280,
                    background: "#fff",
                    borderRadius: 14,
                    boxShadow: "0 20px 50px rgba(20,18,16,0.18), 0 0 0 1px rgba(20,18,16,0.06)",
                    padding: 16,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#8a857c", marginBottom: 12 }}>
                    Flat type
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {QUICK_FLAT_TYPES.map(({ value, label }) => {
                      const checked = filters.bhkTypes.length === 0 || filters.bhkTypes.includes(value);
                      return (
                        <label key={value} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 600, color: "#17140f", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleQuickFlatType(value)}
                            style={{ width: 17, height: 17, accentColor: "#EF5A45", cursor: "pointer", flexShrink: 0 }}
                          />
                          {label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => { setShowFilterPanel((v) => !v); setShowMapSearchOverlay(false); }}
              style={{ ...mtBar.filtersBtn, ...(activeFilterCount > 0 ? { borderColor: "#EF5A45", color: "#B23A28", background: "#fdeee9" } : null) }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
              </svg>
              {showFilterPanel ? "Hide filters" : "All filters"}
              {activeFilterCount > 0 ? (
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "#EF5A45", color: "#fff", fontSize: 11, fontWeight: 800 }}>
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
            {!isMobile && showFilterPanel ? (
              <>
                <button
                  type="button"
                  aria-hidden="true"
                  tabIndex={-1}
                  onClick={() => setShowFilterPanel(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 1004, background: "transparent", border: "none", cursor: "default" }}
                />
                <div
                  role="dialog"
                  aria-label="Filters"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    left: 0,
                    zIndex: 1005,
                    width: 400,
                    maxWidth: "92vw",
                    background: "#fff",
                    borderRadius: 16,
                    boxShadow: "0 24px 60px rgba(20,18,16,0.22), 0 0 0 1px rgba(20,18,16,0.06)",
                    display: "flex",
                    flexDirection: "column",
                    maxHeight: "min(72vh, 620px)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 16px", borderBottom: "1px solid #f1efe9" }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#171412" }}>Filters</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {activeFilterCount > 0 ? (
                        <button type="button" onClick={clearAllFilters} style={{ border: "none", background: "none", color: "#B23A28", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                          Clear all
                        </button>
                      ) : null}
                      <button type="button" onClick={() => setShowFilterPanel(false)} aria-label="Close filters" style={{ border: "1px solid #e4dfd6", background: "#fff", color: "#5c554e", width: 30, height: 30, borderRadius: 9, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
                        ×
                      </button>
                    </div>
                  </div>
                  <div style={{ overflowY: "auto", padding: "16px", flex: 1 }}>
                    {filterSections}
                  </div>
                  <div style={{ padding: "12px 16px", borderTop: "1px solid #f1efe9", background: "#faf8f4", borderRadius: "0 0 16px 16px" }}>
                    <button
                      type="button"
                      onClick={() => setShowFilterPanel(false)}
                      style={{ width: "100%", border: "none", borderRadius: 11, background: "#ee5b45", color: "#fff", fontSize: 14, fontWeight: 700, padding: "11px 18px", cursor: "pointer", boxShadow: "0 2px 8px rgba(238,91,69,.32)" }}
                    >
                      Show {sortedDisplayPins.length} home{sortedDisplayPins.length === 1 ? "" : "s"}
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <div style={{ position: "relative", flexShrink: 0, marginLeft: isMobile ? 0 : "auto" }}>
            <button type="button" onClick={() => setShowBudgetMenu((v) => !v)} style={mtBar.filtersBtn}>
              Budget
              {(filters.minRent > 10000 || filters.maxRent < 100000) ? (
                <span style={{ fontWeight: 700, color: "#c98f2c" }}>
                  {formatBudget(filters.minRent)}–{formatBudget(filters.maxRent)}
                </span>
              ) : null}
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showBudgetMenu ? (
              <>
                <button
                  type="button"
                  aria-hidden="true"
                  tabIndex={-1}
                  onClick={() => setShowBudgetMenu(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 1004, background: "transparent", border: "none", cursor: "default" }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: isMobile ? "auto" : 0,
                    left: isMobile ? 0 : "auto",
                    zIndex: 1005,
                    minWidth: 260,
                    background: "#fff",
                    borderRadius: 14,
                    boxShadow: "0 20px 50px rgba(20,18,16,0.18), 0 0 0 1px rgba(20,18,16,0.06)",
                    padding: 16,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#8a857c", marginBottom: 12 }}>
                    Monthly budget
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 600, color: "#8a857c" }}>
                      Min
                      <select
                        value={filters.minRent}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setFilters((p) => ({ ...p, minRent: v, maxRent: Math.max(p.maxRent, v) }));
                        }}
                        style={{ padding: "9px 10px", borderRadius: 9, border: "1px solid #e9e3db", fontSize: 13.5, fontWeight: 600, color: "#17140f", fontFamily: "inherit", background: "#faf7f2" }}
                      >
                        {BUDGET_STEPS.map((v) => (
                          <option key={v} value={v}>{formatBudget(v)}</option>
                        ))}
                      </select>
                    </label>
                    <span style={{ color: "#8a857c", marginTop: 14 }}>–</span>
                    <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 600, color: "#8a857c" }}>
                      Max
                      <select
                        value={filters.maxRent}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setFilters((p) => ({ ...p, maxRent: v, minRent: Math.min(p.minRent, v) }));
                        }}
                        style={{ padding: "9px 10px", borderRadius: 9, border: "1px solid #e9e3db", fontSize: 13.5, fontWeight: 600, color: "#17140f", fontFamily: "inherit", background: "#faf7f2" }}
                      >
                        {BUDGET_STEPS.map((v) => (
                          <option key={v} value={v}>{formatBudget(v)}{v >= 100000 ? " (no max)" : ""}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "inline-flex", borderRadius: 999, background: "#f3f0ea", padding: 3 }}>
                {[["split", "Split"], ["map", "Full map"]].map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setDesktopMode(v);
                      if (v === "map") { setShowDesktopListings(false); }
                    }}
                    style={{
                      border: "none",
                      borderRadius: 999,
                      padding: "8px 14px",
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: desktopMode === v ? "#1C1A17" : "transparent",
                      color: desktopMode === v ? "#fff" : "#57534b",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {!showDesktopListings ? (
                <button type="button" onClick={() => setShowDesktopListings(true)} style={mtBar.navGhost}>
                  Show list
                </button>
              ) : null}
            </div>
          )}
        </div>

        {(placeAnchor || workplaceAnchor || selectedLocality) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: isMobile ? "0 12px 10px" : "0 20px 12px" }}>
            {workplaceAnchor && (
              <AnchorChip tone="warm" label={`Office: ${chipLabel(workplaceAnchor.label, 26)}`} onRemove={() => { setWorkplaceAnchor(null); setWorkplaceError(""); }} />
            )}
            {placeAnchor && (
              <AnchorChip tone="cool" label={chipLabel(placeAnchor.label, 30)} onRemove={() => { setPlaceAnchor(null); setMapSearchError(""); }} />
            )}
            {selectedLocality && !placeAnchor && (
              <AnchorChip tone="cool" label={chipLabel(selectedLocality, 30)} onRemove={() => { setSelectedLocality(""); setMapSearchInput(""); }} />
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ flex: "1 1 0%", minWidth: isMobile ? 0 : 280, position: "relative", background: "#fff" }}>
          <MapContainer center={mapState.center} zoom={mapState.zoom} style={{ height: "100%", width: "100%" }}>
            <InvalidateMapSize layoutRevision={mapLayoutKey} />
            <ChangeView center={mapState.center} zoom={mapState.zoom} />
            <FitListingsBounds
              listings={displayPins}
              enabled={displayPins.length > 0}
              fallbackCenter={
                workplaceAnchor
                  ? [workplaceAnchor.lat, workplaceAnchor.lng]
                  : placeAnchor
                    ? [placeAnchor.lat, placeAnchor.lng]
                    : mapState.center && Number.isFinite(mapState.center[0])
                      ? mapState.center
                      : null
              }
              fallbackZoom={15}
            />
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              subdomains="abc"
              maxZoom={19}
            />
            {placeAnchor && (
              <>
                <Circle
                  center={[placeAnchor.lat, placeAnchor.lng]}
                  radius={MAP_NEARBY_KM * 1000}
                  pathOptions={{ color: "#2563eb", fillColor: "#93c5fd", fillOpacity: 0.15, weight: 2 }}
                />
                <Marker position={[placeAnchor.lat, placeAnchor.lng]}>
                  <Popup autoPan={false} keepInView={false}>
                    <div style={{ backgroundColor: "#ffffff", color: "#0f172a", maxWidth: "240px" }}>
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>Searched place</div>
                      <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>{placeAnchor.label}</div>
                    </div>
                  </Popup>
                </Marker>
              </>
            )}
            {workplaceAnchor && (
              <>
                <Circle
                  center={[workplaceAnchor.lat, workplaceAnchor.lng]}
                  radius={commuteRadiusKm * 1000}
                  pathOptions={{ color: "#D8432E", fillColor: "#F6C6BC", fillOpacity: 0.14, weight: 2, dashArray: "6 6" }}
                />
                <Marker
                  position={[workplaceAnchor.lat, workplaceAnchor.lng]}
                  icon={makeOfficeIcon()}
                  draggable
                  autoPan
                  eventHandlers={{
                    dragend: (e) => {
                      const { lat, lng } = e.target.getLatLng();
                      moveOfficePin(lat, lng);
                    },
                  }}
                >
                  <Popup autoPan={false} keepInView={false}>
                    <div style={{ backgroundColor: "#ffffff", color: "#0f172a", maxWidth: "240px" }}>
                      <div style={{ fontSize: "13px", fontWeight: 700 }}>Your office</div>
                      <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>
                        {officePinBusy ? "Updating address…" : workplaceAnchor.label}
                      </div>
                      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>Drag the pin to fine-tune the exact spot.</div>
                    </div>
                  </Popup>
                </Marker>
              </>
            )}
            {commuteRoutePositions && commuteRoutePositions.length >= 2 ? (
              <Polyline
                positions={commuteRoutePositions}
                pathOptions={{
                  color: "#2563eb",
                  weight: 4,
                  opacity: 0.82,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
            ) : null}
            {displayPins.map((l) => (
              <Marker 
                key={l.id} 
                position={[l.lat, l.lng]} 
                icon={makeBhkIcon(l.bhk)} 
                eventHandlers={{
                  click: () => setSelected(l),
                }}
              >
                <Popup autoPan={false} keepInView={false} maxWidth={360}>
                  <div
                    style={{
                      minWidth: "280px",
                      maxWidth: "360px",
                      padding: "14px",
                      backgroundColor: "#fafafa",
                      color: "#141210",
                      borderRadius: "14px",
                      isolation: "isolate",
                      border: "1px solid #e4e4e7",
                      boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
                    }}
                  >
                    {l.image && (
                      <MediaElement
                        src={l.image}
                        alt={l.title}
                        style={{ width: "100%", height: "148px", objectFit: "cover", borderRadius: "12px", marginBottom: "12px", border: "1px solid #e4e4e7" }}
                      />
                    )}
                    <div style={{ fontWeight: 800, fontSize: "16px", lineHeight: 1.35, letterSpacing: "-0.02em" }}>{l.title}</div>
                    <div style={{ fontSize: "13px", color: "#52525b", marginTop: "6px", lineHeight: 1.45 }}>{l.address}</div>
                    {(workplaceAnchor || placeAnchor) && Number.isFinite(Number(l.lat)) && Number.isFinite(Number(l.lng)) ? (
                      (() => {
                        const anchor = workplaceAnchor || placeAnchor;
                        const km = haversineKm(anchor.lat, anchor.lng, Number(l.lat), Number(l.lng));
                        return (
                          <div style={{ fontSize: "12px", color: "#D8432E", fontWeight: 700, marginTop: "8px", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            {workplaceAnchor ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" /></svg>
                                {formatCommute(km)} to office
                              </span>
                            ) : null}
                            <span style={{ color: "#8a5c52", fontWeight: 600 }}>· {km.toFixed(1)} km {workplaceAnchor ? "away" : "from pin"}</span>
                          </div>
                        );
                      })()
                    ) : null}
                    <div style={{ fontWeight: 800, color: "#1C1A17", fontSize: "18px", margin: "10px 0 6px" }}>{l.price}</div>
                    <div style={{ fontSize: "13px", color: "#3f3f46", lineHeight: 1.5, paddingBottom: "4px" }}>
                      {l.seller}
                      {String(l.contact || "").trim() ? ` | ${l.contact}` : " · Broker phone not published on the map"}
                    </div>
                    <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                      {String(l.contact || "").trim() ? (
                        <a
                          href={"tel:" + String(l.contact).replace(/\s/g, "")}
                          style={{
                            flex: 1,
                            padding: "10px 12px",
                            background: "#211E1A",
                            color: "#fafafa",
                            borderRadius: "10px",
                            textAlign: "center",
                            textDecoration: "none",
                            fontSize: "13px",
                            fontWeight: 700,
                            border: "1px solid #27272a",
                          }}
                        >
                          Call
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setViewingProperty(l)}
                        style={{
                          flex: 1,
                          padding: "10px 12px",
                          background: "#D8432E",
                          color: "white",
                          borderRadius: "10px",
                          border: "1px solid #B23A28",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: 700,
                        }}
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>


          {helpWidgetOpen ? (
            <div
              style={{
                position: "absolute",
                right: 12,
                bottom: isMobile ? 72 : 18,
                zIndex: 1006,
                maxWidth: 280,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  pointerEvents: "auto",
                  background: "#ffffff",
                  borderRadius: 14,
                  padding: "14px 16px",
                  boxShadow: "0 10px 36px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(226, 232, 240, 0.95)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        background: "#D8432E",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 15,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      M
                    </span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Need help?</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, lineHeight: 1.45 }}>
                        Reach MovEazy on our contact page — we will get back to you quickly.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => setHelpWidgetOpen(false)}
                    style={{
                      border: "none",
                      background: "#f1f5f9",
                      color: "#64748b",
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: 16,
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/contact")}
                  style={{
                    width: "100%",
                    border: "1px solid #B23A28",
                    borderRadius: 10,
                    padding: "10px 14px",
                    background: "#D8432E",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(185, 28, 28, 0.3)",
                  }}
                >
                  Contact us
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setHelpWidgetOpen(true)}
              aria-label="Need help"
              style={{
                position: "absolute",
                right: 14,
                bottom: isMobile ? 72 : 18,
                zIndex: 1006,
                width: 48,
                height: 48,
                borderRadius: "10px",
                border: "1px solid #B23A28",
                background: "#D8432E",
                color: "#fff",
                fontSize: 20,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(185, 28, 28, 0.4)",
              }}
            >
              ?
            </button>
          )}
          
          {isMobile && (
            <div style={{ position: "absolute", top: 12, right: 12, zIndex: 1000, display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "calc(100% - 24px)" }}>
              <button className="mobile-filter-btn" onClick={() => setShowFilterPanel(true)} style={{ position: "static", transform: "none", margin: 0 }}>
                Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
              </button>
            </div>
          )}
        </div>

        {(isMobile || (desktopMode === "split" && showDesktopListings)) && (
        <div
          style={{
            width: isMobile ? "100%" : "min(44vw, 720px)",
            minWidth: isMobile ? undefined : 360,
            overflowY: "auto",
            background: "#ffffff",
            borderLeft: isMobile ? "none" : "1px solid #e2e8f0",
            padding: isMobile ? "12px 12px 80px" : "16px 18px",
            fontSize: "15px",
            height: isMobile ? "100%" : "100%",
            flexShrink: 0,
            position: isMobile ? "absolute" : "static",
            left: 0,
            right: 0,
            bottom: 0,
            top: 0,
            zIndex: isMobile ? 1002 : 4,
            isolation: "isolate",
            boxShadow: isMobile ? "0 -8px 24px rgba(15, 23, 42, 0.18)" : "inset 1px 0 0 rgba(15, 23, 42, 0.04)",
            transform: isMobile ? (mobileTab === "list" ? "translateY(0)" : "translateY(102%)") : "none",
            transition: "transform 0.25s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <h1 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 30, letterSpacing: "-0.01em", margin: 0, color: "#171412" }}>
              Homes in {areaLabel}
            </h1>
          </div>
          <p style={{ margin: "6px 0 0", color: "#5c554e", fontSize: 13.5, lineHeight: 1.5, maxWidth: "52ch" }}>
            <span style={{ fontWeight: 700, color: "#ee5b45" }}>{displayPins.length} place{displayPins.length === 1 ? "" : "s"}</span>
            {" "}{workplaceAnchor || placeAnchor || selectedLocality ? `near ${areaLabel}` : "across Bengaluru"}. Tap a card to fly the map there; hover to spotlight its pin.
          </p>
          {usingRelaxedPins ? (
            <div style={{ fontSize: 12, fontWeight: 600, color: "#b45309", marginTop: 6 }}>
              Shown for context — adjust filters for exact matches.
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {[["all", "All"], ["flatmate", "Flatmate"], ["entire", "Entire flat"]].map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setListingType(val)}
                style={{
                  border: listingType === val ? "1px solid #ee5b45" : "1px solid #e9e3db",
                  background: listingType === val ? "#ee5b45" : "#ffffff",
                  color: listingType === val ? "#ffffff" : "#5c554e",
                  borderRadius: 999,
                  padding: "9px 18px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  boxShadow: listingType === val ? "0 2px 8px rgba(238,91,69,.28)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "#948c83", fontWeight: 500 }}>
              Showing {sortedDisplayPins.length} of {listings.length} results
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#171412",
                  border: "1px solid #e9e3db",
                  background: "#fff",
                  borderRadius: 999,
                  padding: "8px 14px",
                  cursor: "pointer",
                }}
              >
                <option value="best">Sort: Best match</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
              </select>
              {!isMobile && desktopMode === "split" ? (
                <button
                  type="button"
                  onClick={() => setShowDesktopListings(false)}
                  style={{
                    border: "1px solid #e9e3db",
                    background: "#fff",
                    color: "#5c554e",
                    borderRadius: 999,
                    padding: "8px 14px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  Hide list
                </button>
              ) : null}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: isMobile ? 14 : 16,
              marginTop: 18,
            }}
          >
          {sortedDisplayPins.map((l) => {
            const isFlatmate = l.bhk === "Roommate needed";
            const anchor = workplaceAnchor || placeAnchor;
            const distanceRaw = anchor && Number.isFinite(Number(l.lat)) && Number.isFinite(Number(l.lng))
              ? haversineKm(anchor.lat, anchor.lng, Number(l.lat), Number(l.lng))
              : null;
            const distanceKm = distanceRaw != null ? distanceRaw.toFixed(1) : null;
            const commuteLabel = distanceRaw != null && workplaceAnchor ? formatCommute(distanceRaw) : null;
            const saved = isListingSaved(user, l.id);
            return (
              <article
                key={l.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelected(l);
                  setMapState(mapStateForListingFocus(l.lat, l.lng, isMobile));
                  if (isMobile) setMobileTab("map");
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  setSelected(l);
                  setMapState(mapStateForListingFocus(l.lat, l.lng, isMobile));
                  if (isMobile) setMobileTab("map");
                }}
                style={{
                  background: "#fff",
                  border: selected?.id === l.id ? "1px solid #ee5b45" : "1px solid #e9e3db",
                  borderRadius: 16,
                  overflow: "hidden",
                  display: "flex",
                  cursor: "pointer",
                  transition: "transform 0.18s, box-shadow 0.18s, border-color 0.18s",
                  boxShadow: selected?.id === l.id ? "0 4px 14px rgba(23,20,18,.08), 0 10px 34px rgba(23,20,18,.07)" : "0 1px 2px rgba(23,20,18,.05), 0 2px 6px rgba(23,20,18,.04)",
                }}
              >
                <div style={{ width: isMobile ? 120 : 148, flexShrink: 0, position: "relative", background: "#efe7dc" }}>
                  {listingCoverSrc(l) ? (
                    <MediaElement src={listingCoverSrc(l)} alt={l.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%" }} aria-hidden />
                  )}
                  <span
                    style={{
                      position: "absolute", top: 10, left: 10,
                      background: isFlatmate ? "rgba(124,140,107,.92)" : "rgba(23,20,18,.82)",
                      color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
                    }}
                  >
                    {isFlatmate ? "Flatmate" : "Entire flat"}
                  </span>
                  <button
                    type="button"
                    aria-label={saved ? "Remove from saved" : "Save listing"}
                    onClick={(e) => {
                      e.stopPropagation();
                      const now = toggleSavedListing(user, l.id, l.title);
                      void logSavedListingChange(user, l.id, now, l.title);
                      setSavedRevision((v) => v + 1);
                    }}
                    style={{
                      position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: "50%",
                      border: "none", background: "rgba(255,255,255,.9)", boxShadow: "0 1px 2px rgba(23,20,18,.05)",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      color: saved ? "#ee5b45" : "#5c554e",
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 21s-7-4.4-9.5-8.5C.7 9 2 5.5 5 5.5c2 0 3.2 1.3 4 2.5.8-1.2 2-2.5 4-2.5 3 0 4.3 3.5 2.5 7C19 16.6 12 21 12 21z" />
                    </svg>
                  </button>
                </div>
                <div style={{ flex: 1, minWidth: 0, padding: "14px 16px", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.01em", color: "#171412" }}>{l.price}</div>
                    {commuteLabel ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#ee5b45", background: "#fdeee9", padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }} title={`${commuteLabel} drive to office · ${distanceKm} km`}>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" /></svg>
                        {commuteLabel} to office
                      </span>
                    ) : distanceKm ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#ee5b45", background: "#fdeee9", padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
                        ~{distanceKm} km from pin
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#7c8c6b", background: "#eef1e9", padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
                        {l.bhk}
                      </span>
                    )}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, margin: "6px 0 2px", letterSpacing: "-0.01em", color: "#171412", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.title}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#5c554e", fontSize: 12.5 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, color: "#948c83" }}>
                      <path d="M12 22s7-7.8 7-13a7 7 0 10-14 0c0 5.2 7 13 7 13z" /><circle cx="12" cy="9" r="2.5" />
                    </svg>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.address}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: "auto", paddingTop: 10, color: "#5c554e", fontSize: 11.5, fontWeight: 600, flexWrap: "wrap" }}>
                    {l.propertyType ? <span>{l.propertyType}</span> : null}
                    {l.furnishing ? <span>· {l.furnishing}</span> : null}
                    {l.availability ? <span>· {l.availability}</span> : null}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid #f1ece5" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#5c554e" }}>
                      <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#fdeee9", color: "#d8412b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800, flexShrink: 0 }}>
                        {String(l.seller || "?").trim().charAt(0).toUpperCase() || "?"}
                      </span>
                      {l.seller}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingProperty(l);
                      }}
                      style={{
                        border: "none", background: "none", padding: 0, cursor: "pointer",
                        fontSize: 12.5, fontWeight: 700, color: "#d8412b", display: "flex", alignItems: "center", gap: 3,
                      }}
                    >
                      Details
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          </div>
        </div>
        )}
      </div>

      {/* Mobile bottom tab bar — sits directly above the site-wide bottom action
          bar (70px) so both stay reachable instead of overlapping. */}
      {isMobile && (
        <div
          style={{
            position: "fixed",
            bottom: "calc(70px + env(safe-area-inset-bottom, 0px))",
            left: 0,
            right: 0,
            height: 56,
            background: "#1C1A17",
            borderTop: "1px solid #27272a",
            display: "flex",
            zIndex: 1010,
            boxShadow: "0 -4px 16px rgba(0,0,0,0.4)",
          }}
        >
          {[["map", "Map"], ["list", "List"]].map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMobileTab(tab)}
              style={{
                flex: 1,
                border: "none",
                background: mobileTab === tab ? "#1a1a1a" : "transparent",
                color: mobileTab === tab ? "#EF5A45" : "#a1a1aa",
                fontSize: "13px",
                fontWeight: 800,
                cursor: "pointer",
                borderTop: mobileTab === tab ? "2px solid #EF5A45" : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >
              {tab === "map" ? "🗺 " : "📋 "}{label}
            </button>
          ))}
        </div>
      )}

      {/* Mobile: full-width bottom sheet for all filters (never covers the map on desktop) */}
      {isMobile && showFilterPanel && (
        <>
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setShowFilterPanel(false)}
            style={{ position: "fixed", inset: 0, zIndex: 10000, border: "none", padding: 0, margin: 0, background: "rgba(15, 23, 42, 0.45)", cursor: "pointer" }}
          />
          <div
            role="dialog"
            aria-label="Filters"
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10001,
              background: "#fff",
              borderRadius: "20px 20px 0 0",
              boxShadow: "0 -12px 40px rgba(15, 23, 42, 0.24)",
              display: "flex",
              flexDirection: "column",
              maxHeight: "86vh",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 16px", borderBottom: "1px solid #f1efe9" }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: "#171412" }}>Filters</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {activeFilterCount > 0 ? (
                  <button type="button" onClick={clearAllFilters} style={{ border: "none", background: "none", color: "#B23A28", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
                    Clear all
                  </button>
                ) : null}
                <button type="button" onClick={() => setShowFilterPanel(false)} aria-label="Close filters" style={{ border: "1px solid #e4dfd6", background: "#fff", color: "#5c554e", width: 32, height: 32, borderRadius: 9, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>
                  ×
                </button>
              </div>
            </div>
            <div style={{ overflowY: "auto", padding: "16px", flex: 1, WebkitOverflowScrolling: "touch" }}>
              {filterSections}
            </div>
            <div style={{ padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", borderTop: "1px solid #f1efe9", background: "#faf8f4" }}>
              <button
                type="button"
                onClick={() => setShowFilterPanel(false)}
                style={{ width: "100%", border: "none", borderRadius: 12, background: "#ee5b45", color: "#fff", fontSize: 15, fontWeight: 700, padding: "13px 18px", cursor: "pointer", boxShadow: "0 2px 8px rgba(238,91,69,.32)" }}
              >
                Show {sortedDisplayPins.length} home{sortedDisplayPins.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </>
      )}

      {viewingProperty && (
        <PropertyModal
          property={viewingProperty}
          listings={listings}
          onSelectListing={(l) => setViewingProperty(l)}
          onSavedChange={() => setSavedRevision((v) => v + 1)}
          onClose={() => {
            setViewingProperty(null);
            if (listingIdFromUrl) {
              const qs = new URLSearchParams(location.search);
              qs.delete("listingId");
              const next = qs.toString();
              navigate({ pathname: location.pathname, search: next ? `?${next}` : "" }, { replace: true });
            }
          }}
        />
      )}

      {/* ── AI Broker consultant ── */}
      <AIBroker open={showAgentChat} onClose={() => setShowAgentChat(false)} />
    </div>
  );
}
