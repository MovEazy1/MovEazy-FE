import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { geocodePlace } from "../lib/geocode";

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

export default function ListingMapPicker({ markerPosition, onMarkerChange, height = 260, initialZoom = 12 }) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mapCenter, setMapCenter] = useState(() => (validLatLng(markerPosition) ? markerPosition : BLR_DEFAULT));
  const [zoom, setZoom] = useState(() => (validLatLng(markerPosition) ? 14 : initialZoom));

  const runSearch = async () => {
    setError("");
    const q = search.trim();
    if (!q) {
      setError("Enter an area, society, or landmark.");
      return;
    }
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

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px", alignItems: "center" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runSearch();
            }
          }}
          placeholder="Area / society / landmark (e.g. Whitefield, Indiranagar)"
          style={{
            flex: 1,
            minWidth: "160px",
            padding: "8px 10px",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            fontSize: "13px",
          }}
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={loading}
          style={{
            padding: "8px 14px",
            borderRadius: "6px",
            border: "1px solid #16a34a",
            background: loading ? "#86efac" : "#16a34a",
            color: "white",
            fontWeight: 700,
            fontSize: "13px",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "…" : "Search"}
        </button>
      </div>
      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: error ? "4px" : "8px" }}>
        Search only moves the map — click the map to place or move the pin.
      </div>
      {error ? (
        <div style={{ color: "#b91c1c", fontSize: "12px", marginBottom: "8px", fontWeight: 600 }}>{error}</div>
      ) : null}
      <div style={{ height, borderRadius: "8px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
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
