/**
 * The society partner's map: where they are, and the societies around them,
 * coloured by whether they're free to onboard. Its own file so Leaflet loads
 * only when the Societies screen opens.
 */
import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const TONE = { open: "#15803D", mine: "#E4B659", mine_live: "#E4B659", locked: "#9CA3AF", onboarded: "#6B7280" };

function Centre({ spot, focus }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.setView([focus.lat, focus.lng], 17);
    else if (spot) map.setView([spot.lat, spot.lng], 15);
  }, [map, spot, focus]);
  return null;
}

export default function SocietiesMap({ spot, societies = [], focusId, onPick }) {
  const focus = focusId ? societies.find((s) => s.id === focusId) : null;
  const centre = spot ? [spot.lat, spot.lng] : [12.9116, 77.6474];
  return (
    <MapContainer center={centre} zoom={15} scrollWheelZoom style={{ width: "100%", height: "100%" }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" maxZoom={19} />
      <Centre spot={spot} focus={focus} />
      {spot && (
        <>
          <Circle center={[spot.lat, spot.lng]} radius={300} pathOptions={{ color: "#1D4ED8", weight: 1, fillOpacity: 0.06 }} />
          <CircleMarker center={[spot.lat, spot.lng]} radius={8} pathOptions={{ color: "#fff", weight: 3, fillColor: "#1D4ED8", fillOpacity: 1 }}>
            <Tooltip>You are here</Tooltip>
          </CircleMarker>
        </>
      )}
      {societies.filter((s) => s.lat != null).map((s) => (
        <CircleMarker key={s.id} center={[Number(s.lat), Number(s.lng)]} radius={s.id === focusId ? 11 : 7}
          pathOptions={{ color: "#fff", weight: 2, fillColor: TONE[s.state] || TONE.open, fillOpacity: 0.95 }}
          eventHandlers={{ click: () => onPick?.(s.id) }}>
          <Tooltip>{s.name}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
