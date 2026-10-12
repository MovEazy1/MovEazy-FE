/**
 * Roughly where a flat is: a circle about a kilometre across, never a pin.
 * The partner shares the exact address when fixing the visit. Loaded lazily —
 * Leaflet stays out of the list page until someone opens a flat.
 */
import { MapContainer, TileLayer, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function ApproxMap({ lat, lng }) {
  return (
    <MapContainer center={[lat, lng]} zoom={14} scrollWheelZoom={false} zoomControl={false} attributionControl
      style={{ width: "100%", height: "100%" }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>' />
      <Circle center={[lat, lng]} radius={600} pathOptions={{ color: "#0A3A2A", fillColor: "#1B6B4E", fillOpacity: 0.18, weight: 2 }} />
    </MapContainer>
  );
}
