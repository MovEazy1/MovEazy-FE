import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { geocodePlace, searchPlaces } from "../lib/geocode";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const BLR_DEFAULT = [12.9716, 77.5946];

function validLatLng(pos) {
  return Array.isArray(pos) && pos.length >= 2 && Number.isFinite(pos[0]) && Number.isFinite(pos[1]);
}

/** Pans/zooms map when `center` / `zoom` change after mount (e.g. search). Skips first run so initial MapContainer view is unchanged. */
function MapSearchFlyTo({ center, zoom }) {
  const map = useMap();
  const skipFirst = useRef(true);
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    if (Number.isFinite(center[0]) && Number.isFinite(center[1])) {
      map.flyTo(center, zoom, { duration: 0.55 });
    }
  }, [map, center[0], center[1], zoom]);
  return null;
}

function MapClickPick({ onPick }) {
  useMapEvents({
    click(e) {
      onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function PinMarker({ position }) {
  if (!validLatLng(position)) return null;
  return <Marker position={position} />;
}

/** Opt-in palette so the picker can sit inside the dark mobile posting sheet
 *  (components/ListMyFlatMobile.jsx) without its light search bar cutting a
 *  white band through it. Callers that pass nothing keep the original look. */
const THEMES = {
  light: {
    inputBg: "#fff", inputText: "#0f172a", inputBorder: "#cbd5e1", placeholder: "#94a3b8",
    btnBg: "#16a34a", btnBusy: "#86efac", btnBorder: "#16a34a", btnText: "#fff",
    hint: "#64748b", frame: "#e2e8f0",
  },
  dark: {
    inputBg: "rgba(255,255,255,.05)", inputText: "#F1F6F4", inputBorder: "rgba(255,255,255,.16)", placeholder: "#6F8681",
    btnBg: "#5EEAD4", btnBusy: "rgba(94,234,212,.5)", btnBorder: "#5EEAD4", btnText: "#04211D",
    hint: "#6F8681", frame: "rgba(255,255,255,.13)",
  },
};

export default function ListingMapPicker({ markerPosition, onMarkerChange, height = 260, initialZoom = 12, focusQuery = "", theme = "light" }) {
  const t = THEMES[theme] || THEMES.light;
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mapCenter, setMapCenter] = useState(() => (validLatLng(markerPosition) ? markerPosition : BLR_DEFAULT));
  const [zoom, setZoom] = useState(() => (validLatLng(markerPosition) ? 14 : initialZoom));

  // Live autocomplete
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const justPicked = useRef(false);
  const markerRef = useRef(markerPosition);
  markerRef.current = markerPosition;

  // Debounced as-you-type place search (Photon), cancelling stale requests.
  useEffect(() => {
    const q = search.trim();
    if (justPicked.current) { justPicked.current = false; return; }
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await searchPlaces(q, { limit: 6, signal: ctrl.signal });
        setResults(r);
        setOpen(r.length > 0);
        setActive(-1);
      } catch { /* aborted / network */ }
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [search]);

  // Zoom the map to the area chosen in the form above, until the user pins a spot.
  useEffect(() => {
    const q = String(focusQuery || "").trim();
    if (!q || validLatLng(markerRef.current)) return;
    let alive = true;
    (async () => {
      try {
        const r = await geocodePlace(q);
        if (alive && r.ok) { setMapCenter([r.lat, r.lng]); setZoom(15); }
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [focusQuery]);

  const pick = (r) => {
    if (!r) return;
    justPicked.current = true;
    setSearch(r.display || r.label || r.primary || "");
    setResults([]);
    setOpen(false);
    setActive(-1);
    setError("");
    setMapCenter([r.lat, r.lng]);
    setZoom(17);
    onMarkerChange?.([r.lat, r.lng]); // selecting a suggestion drops the pin there
  };

  const runSearch = async () => {
    setError("");
    const q = search.trim();
    if (!q) {
      setError("Enter an area, society, or landmark.");
      return;
    }
    if (results.length) { pick(results[active >= 0 ? active : 0]); return; }
    setLoading(true);
    try {
      const r = await geocodePlace(q);
      if (r.ok) {
        setMapCenter([r.lat, r.lng]);
        setZoom(16);
        setError("");
      } else {
        setError(r.error || "No results.");
      }
    } catch {
      setError("Search failed. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (open && results.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Escape") { setOpen(false); return; }
    }
    if (e.key === "Enter") { e.preventDefault(); runSearch(); }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px", alignItems: "center", position: "relative" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "160px" }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => results.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            autoComplete="off"
            placeholder="Start typing an address, society, or landmark…"
            style={{
              width: "100%",
              padding: "8px 10px",
              border: `1px solid ${t.inputBorder}`,
              borderRadius: "6px",
              fontSize: "13px",
              background: t.inputBg,
              color: t.inputText,
              outline: "none",
            }}
          />
          {open && results.length > 0 && (
            <ul
              style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 1000,
                margin: 0, padding: "4px", listStyle: "none", background: "white",
                border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 12px 30px rgba(15,23,42,0.16)",
                maxHeight: "240px", overflowY: "auto",
              }}
            >
              {results.map((r, i) => (
                <li
                  key={r.id || i}
                  onMouseDown={(e) => { e.preventDefault(); pick(r); }}
                  onMouseEnter={() => setActive(i)}
                  style={{
                    padding: "8px 10px", borderRadius: "6px", cursor: "pointer",
                    background: i === active ? "#fff5f5" : "transparent",
                  }}
                >
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#1f2937" }}>{r.primary}</div>
                  {r.secondary && <div style={{ fontSize: "11px", color: "#64748b" }}>{r.secondary}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={runSearch}
          disabled={loading}
          style={{
            padding: "8px 14px",
            borderRadius: "6px",
            border: `1px solid ${t.btnBorder}`,
            background: loading ? t.btnBusy : t.btnBg,
            color: t.btnText,
            fontWeight: 700,
            fontSize: "13px",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "…" : "Search"}
        </button>
      </div>
      <div style={{ fontSize: "11px", color: t.hint, marginBottom: error ? "4px" : "8px" }}>
        Pick a suggestion to drop the pin there — or click the map to place / move it.
      </div>
      {error ? (
        <div style={{ color: theme === "dark" ? "#FCA5A5" : "#b91c1c", fontSize: "12px", marginBottom: "8px", fontWeight: 600 }}>{error}</div>
      ) : null}
      <div style={{ height, borderRadius: "8px", overflow: "hidden", border: `1px solid ${t.frame}` }}>
        <MapContainer center={mapCenter} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          <MapSearchFlyTo center={mapCenter} zoom={zoom} />
          <MapClickPick onPick={onMarkerChange} />
          <PinMarker position={markerPosition} />
        </MapContainer>
      </div>
    </div>
  );
}
