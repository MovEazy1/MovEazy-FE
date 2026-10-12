/**
 * Explore societies on a map: a price pill on each society (its
 * neighbourhood, never the gate), the tenant's office, and the society's card
 * when a pill is tapped. Loaded only when the Map tab is opened.
 */
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { SocietyCard, kRange } from "./ExploreSocieties";

const pill = (s, on) => L.divIcon({
  className: "",
  html: `<span class="sm-pill${on ? " on" : ""}">${kRange(s.min_rent, s.max_rent)}</span>`,
  iconSize: null,
});
const officeIcon = L.divIcon({ className: "", html: '<span class="sm-office">Office</span>', iconSize: null });

function Fit({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [50, 50] });
    else if (points.length === 1) map.setView(points[0], 14);
  }, [map, points]);
  return null;
}

export default function SocietiesMap({ societies, office }) {
  const [sel, setSel] = useState(null);
  const pts = useMemo(() => {
    const p = societies.filter((s) => s.latitude != null).map((s) => [Number(s.latitude), Number(s.longitude)]);
    if (office?.lat != null) p.push([Number(office.lat), Number(office.lng)]);
    return p;
  }, [societies, office]);
  const picked = societies.find((s) => s.code === sel);
  return (
    <div className="sm">
      <style>{CSS}</style>
      <MapContainer center={pts[0] ?? [12.95, 77.62]} zoom={13} scrollWheelZoom style={{ width: "100%", height: "100%" }} zoomControl={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' />
        <Fit points={pts} />
        {office?.lat != null && <Marker position={[Number(office.lat), Number(office.lng)]} icon={officeIcon} interactive={false} />}
        {societies.filter((s) => s.latitude != null).map((s) => (
          <Marker key={s.code} position={[Number(s.latitude), Number(s.longitude)]} icon={pill(s, s.code === sel)}
            eventHandlers={{ click: () => setSel(s.code) }} />
        ))}
      </MapContainer>
      {picked && (
        <div className="sm-card">
          <button type="button" className="sm-x" onClick={() => setSel(null)} aria-label="Close">×</button>
          <SocietyCard s={picked} compact />
        </div>
      )}
    </div>
  );
}

const CSS = `
.sm { position: relative; height: min(72vh, 680px); margin: 20px 0 40px; border-radius: 22px; overflow: hidden; border: 1px solid #E5DFD0; box-shadow: 0 14px 40px rgba(10,40,30,.12); isolation: isolate; }
.sm-pill { display: inline-block; transform: translate(-50%, -50%); white-space: nowrap; padding: 6px 11px; border-radius: 99px; background: #fff; color: #063B2D;
  font: 800 13px Manrope, Inter, sans-serif; box-shadow: 0 6px 16px rgba(6,59,45,.25); border: 1.5px solid #0A6B4E; cursor: pointer; }
.sm-pill.on { background: #063B2D; color: #fff; transform: translate(-50%, -50%) scale(1.08); }
.sm-office { display: inline-block; transform: translate(-50%, -50%); padding: 5px 10px; border-radius: 8px; background: #00BFAE; color: #04241C; font: 800 12px Manrope, Inter, sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,.2); }
.sm-card { position: absolute; left: 12px; right: 12px; bottom: 12px; z-index: 500; max-width: 420px; margin: 0 auto; }
.sm-x { position: absolute; top: -12px; right: -6px; z-index: 2; width: 32px; height: 32px; border-radius: 99px; border: 0; background: #063B2D; color: #fff; font-size: 20px; line-height: 1; cursor: pointer; }
`;
