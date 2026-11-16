/**
 * A live visit on a map: the flat, the meeting spot, the partner and the
 * tenant (each when known). With onPick, a tap moves the meeting spot — how a
 * partner marks it. Its own file so Leaflet loads only where it's used.
 */
import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function Fit({ points, follow }) {
  const map = useMap();
  const key = points.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join("|");
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.setView(points[0], 17);
    else map.fitBounds(points, { padding: [40, 40], maxZoom: 17 });
    // Refit when someone moves a fair bit, not on every ping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, follow ? key : points.length]);
  return null;
}

function Picker({ onPick }) {
  useMapEvents({ click: (e) => onPick?.(e.latlng.lat, e.latlng.lng) });
  return null;
}

const dot = (color, r = 9) => ({ color: "#fff", weight: 3, fillColor: color, fillOpacity: 1, radius: r });

export default function LiveVisitMap({ flat, meet, partner, tenant, onPick, partnerLabel = "Partner", tenantLabel = "Tenant", height = 300 }) {
  const pts = useMemo(() => [
    meet && [Number(meet.lat), Number(meet.lng)],
    partner && [Number(partner.lat), Number(partner.lng)],
    tenant && [Number(tenant.lat), Number(tenant.lng)],
    !meet && flat?.lat != null && [Number(flat.lat), Number(flat.lng)],
  ].filter((p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1])), [meet, partner, tenant, flat]);
  const centre = pts[0] || [12.9116, 77.6474];
  return (
    <div style={{ height, borderRadius: 16, overflow: "hidden", isolation: "isolate", border: "1px solid rgba(0,0,0,.08)" }}>
      <MapContainer center={centre} zoom={16} scrollWheelZoom style={{ width: "100%", height: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" maxZoom={19} />
        <Fit points={pts} follow={!onPick} />
        {onPick && <Picker onPick={onPick} />}
        {flat?.lat != null && (
          <CircleMarker center={[Number(flat.lat), Number(flat.lng)]} pathOptions={{ color: "#6B7280", weight: 1, fillOpacity: 0.12 }} radius={18}>
            <Tooltip>The flat (as listed)</Tooltip>
          </CircleMarker>
        )}
        {meet && (
          <CircleMarker center={[Number(meet.lat), Number(meet.lng)]} pathOptions={dot("#DC2626", 11)}>
            <Tooltip permanent direction="top" offset={[0, -10]}>Meet here</Tooltip>
          </CircleMarker>
        )}
        {partner && (
          <CircleMarker center={[Number(partner.lat), Number(partner.lng)]} pathOptions={dot("#15803D")}>
            <Tooltip permanent direction="right" offset={[10, 0]}>{partnerLabel}</Tooltip>
          </CircleMarker>
        )}
        {tenant && (
          <CircleMarker center={[Number(tenant.lat), Number(tenant.lng)]} pathOptions={dot("#1D4ED8")}>
            <Tooltip permanent direction="right" offset={[10, 0]}>{tenantLabel}</Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
