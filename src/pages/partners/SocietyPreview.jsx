/**
 * Societies → Onboard new: tap a society (on the map or in the list) and this
 * card slides up over the bottom of the screen, the way Google Maps does —
 * name, area, how far, who has it, amenities, rents, Directions, and the
 * button to map it out (or carry on with it).
 */
import { Navigation, X } from "lucide-react";
import { distanceLabel, RENT_TYPES } from "../../lib/societyPartners";
import { rentRange, roadLabel } from "../../lib/societyProspects";

const directions = (s) => `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;

export default function SocietyPreview({ society: s, state, busy, onAction, onClose }) {
  if (!s) return null;
  const rents = RENT_TYPES.map((t) => [t.label, rentRange(s.rents?.[t.id])]).filter(([, r]) => r);
  const amenities = s.amenities ?? [];
  const more = Math.max(0, (s.amenity_count || 0) - amenities.length);
  const free = s.state === "open";
  return (
    <div role="dialog" aria-label={s.name}
      style={{
        position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 0, zIndex: 45, width: "100%", maxWidth: 520,
        minHeight: "20vh", maxHeight: "55vh", overflow: "auto", background: "#fff", borderRadius: "18px 18px 0 0",
        boxShadow: "0 -10px 30px rgba(0,0,0,.18)", padding: "6px 16px calc(10px + env(safe-area-inset-bottom))",
      }}>
      <div style={{ width: 40, height: 4, borderRadius: 99, background: "#D9D5CC", margin: "0 auto 6px" }} />
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: "block", fontSize: 16.5, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</b>
          <div className="pz-meta">{[s.area || roadLabel(s.road), distanceLabel(s.metres)].filter(Boolean).join(" · ")}{" · "}<span style={{ color: state.tone, fontWeight: 700 }}>{state.text}</span></div>
        </div>
        <button type="button" className="pz-iconbtn" aria-label="Close" onClick={onClose}><X size={20} /></button>
      </div>

      {/* One line each, so the card stays near a fifth of the screen. */}
      {amenities.length > 0 && (
        <div className="pz-meta" style={{ marginTop: 4, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {amenities.join(" · ")}{more > 0 ? ` +${more} more` : ""}
        </div>
      )}
      {rents.length > 0 && (
        <div className="pz-meta" style={{ color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Rent (approx): {rents.map(([l, r]) => `${l} ${r}`).join(" · ")}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {state.action && (
          <button type="button" className="pz-btn pz-btn--primary" style={{ flex: 1, minHeight: 42 }} disabled={busy} onClick={onAction}>
            {busy ? "…" : free ? "Map out this society" : state.action}
          </button>
        )}
        {s.lat != null && (
          <a className="pz-btn" style={{ flex: state.action ? "none" : 1, minHeight: 42 }} href={directions(s)} target="_blank" rel="noreferrer">
            <Navigation size={16} /> Directions
          </a>
        )}
      </div>
      {free && (
        <p className="pz-hint" style={{ margin: "6px 0 0", fontSize: 11.5, lineHeight: 1.4 }}>
          Mapping this society makes you its lifetime MovEazy Partner once the MovEazy team approves it. Every MovEazy customer for this society will be closed via you.
        </p>
      )}
    </div>
  );
}
