import { useEffect, useState } from "react";
import { fetchOpenVisitsForProperty } from "../lib/visits";

const fmt = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })
    : "";

/**
 * Read-only renter view of a property's open visit slots for the next `days` days
 * (default 5). Renders nothing while loading or when the listing has no open visits,
 * so it never clutters a property that hasn't published slots.
 */
export default function OpenVisitsList({ propertyId, days = 5 }) {
  const [slots, setSlots] = useState(null); // null = loading

  useEffect(() => {
    let alive = true;
    if (!propertyId) { setSlots([]); return undefined; }
    fetchOpenVisitsForProperty(propertyId, { days })
      .then((s) => { if (alive) setSlots(s); })
      .catch(() => { if (alive) setSlots([]); });
    return () => { alive = false; };
  }, [propertyId, days]);

  if (!slots || slots.length === 0) return null;

  return (
    <div style={{ background: "#fff7ed", padding: "20px", borderRadius: "12px", marginBottom: "24px", border: "1px solid #fed7aa" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: "17px", color: "#0f172a" }}>Open visits — next 5 days</h2>
      <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#9a3412" }}>Drop in during any of these open windows.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {slots.map((s) => (
          <span key={s.id} style={{ background: "white", border: "1px solid #fed7aa", borderRadius: "999px", padding: "7px 12px", fontSize: "13px", fontWeight: 700, color: "#9a3412" }}>
            {fmt(s.slot_at)}
          </span>
        ))}
      </div>
    </div>
  );
}
