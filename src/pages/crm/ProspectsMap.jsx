/**
 * CRM → Society prospects: every society on the map, coloured by where the
 * team is with it, over the six roads the import covers. Its own file so
 * Leaflet loads only when the page is opened.
 */
import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { CORRIDORS, ROADS, statusOf } from "../../lib/societyProspects";

const HSR_CENTRE = [12.9, 77.68];

/** The road's sampled points, joined nearest-to-nearest so the line runs along it. */
function chain(points) {
  if (!points.length) return [];
  const left = points.slice();
  // Start from the westmost point and always step to the nearest one left.
  left.sort((a, b) => a[1] - b[1]);
  const out = [left.shift()];
  while (left.length) {
    const [la, lo] = out[out.length - 1];
    let best = 0;
    let bestD = Infinity;
    left.forEach(([a, o], i) => {
      const d = (a - la) ** 2 + (o - lo) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    out.push(left.splice(best, 1)[0]);
  }
  return out;
}

function FitTo({ points, focus }) {
  const map = useMap();
  useEffect(() => {
    if (focus) { map.setView([focus.lat, focus.lng], 16); return; }
    if (!points.length) { map.setView(HSR_CENTRE, 13); return; }
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    map.fitBounds([[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]], { padding: [24, 24], maxZoom: 16 });
  }, [map, points, focus]);
  return null;
}

export default function ProspectsMap({ rows = [], selectedId = null, onPick }) {
  const pts = useMemo(() => rows.map((r) => ({ ...r, lat: Number(r.lat), lng: Number(r.lng) }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng)), [rows]);
  const lines = useMemo(() => Object.entries(CORRIDORS).map(([key, p]) => [key, chain(p)]), []);
  const focus = selectedId ? pts.find((p) => p.id === selectedId) : null;
  return (
    <MapContainer center={HSR_CENTRE} zoom={13} scrollWheelZoom style={{ width: "100%", height: "100%" }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" maxZoom={19} />
      <FitTo points={pts} focus={focus} />
      {lines.map(([key, line]) => (
        <Polyline key={key} positions={line} pathOptions={{ color: ROADS.find((r) => r.key === key)?.color, weight: 4, opacity: 0.35 }} />
      ))}
      {pts.map((p) => {
        const st = statusOf(p.status);
        const on = p.id === selectedId;
        return (
          <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={on ? 10 : 6}
            pathOptions={{ color: on ? "#10221E" : "#FFFFFF", weight: on ? 3 : 1.5, fillColor: st.color, fillOpacity: p.hidden ? 0.3 : 0.95 }}
            eventHandlers={{ click: () => onPick?.(p.id) }}>
            <Tooltip>{p.name} · {st.label}</Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
