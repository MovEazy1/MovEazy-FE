/**
 * Where tenants were when they signed in on a broker's QR page (CRM → QR scans).
 * Each check-in is a dot (filled when it became a lead); cells of about a
 * kilometre with two or more check-ins are drawn as hotspot zones, sized by
 * how many. Its own file so Leaflet loads only when the page is opened.
 */
import { useEffect, useMemo } from "react";
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { hotspotCells } from "../../lib/qrLeads";

const BENGALURU = [12.9716, 77.5946];

function FitTo({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) { map.setView(BENGALURU, 11); return; }
    const lats = points.map((p) => p.lat), lngs = points.map((p) => p.lng);
    map.fitBounds([[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]], { padding: [30, 30], maxZoom: 15 });
  }, [map, points]);
  return null;
}

export default function QrScanMap({ points = [] }) {
  const pts = useMemo(() => points.map((p) => ({ ...p, lat: Number(p.lat), lng: Number(p.lng) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)), [points]);
  const zones = useMemo(() => hotspotCells(pts), [pts]);
  return (
    <MapContainer center={BENGALURU} zoom={11} scrollWheelZoom style={{ width: "100%", height: "100%" }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" maxZoom={19} />
      <FitTo points={pts} />
      {zones.map((z) => (
        <Circle key={`${z.lat}:${z.lng}`} center={[z.lat, z.lng]} radius={350 + Math.min(z.count, 30) * 40}
          pathOptions={{ color: "#CC3F28", weight: 1.5, fillColor: "#CC3F28", fillOpacity: 0.16 }}>
          <Tooltip>{z.count} scans{z.localities.length ? ` · ${z.localities.slice(0, 3).join(", ")}` : ""}</Tooltip>
        </Circle>
      ))}
      {pts.map((p, i) => (
        <CircleMarker key={i} center={[p.lat, p.lng]} radius={5}
          pathOptions={{ color: "#0E7C68", weight: 1.5, fillColor: "#0E7C68", fillOpacity: p.lead ? 0.9 : 0.25 }}>
          <Tooltip>{[p.broker, p.locality, p.day].filter(Boolean).join(" · ")}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
