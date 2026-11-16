/**
 * The floating bubble during a visit, on every screen: the other person and
 * how far they are ("Ravi · 1.2 km away"), or — before it's live — that the
 * meeting spot is ready. Tap: the visit, with the map.
 *
 * `visit` is the tenant's or the partner's visit; `side` says which we are.
 */
import { MapPin } from "lucide-react";
import { distanceText, metresBetween, seenAgo } from "../lib/liveVisits";

export default function LiveVisitBubble({ visit, side, onOpen }) {
  if (!visit) return null;
  const other = side === "partner" ? visit.tenant_loc : visit.broker_loc;
  const mine = side === "partner" ? visit.broker_loc : visit.tenant_loc;
  const name = side === "partner"
    ? String(visit.client?.name || "Tenant").split(" ")[0]
    : String(visit.partner?.name || "Partner").split(" ")[0];
  const target = mine || visit.meet;
  const m = other && target ? metresBetween(other, target) : null;
  const line = visit.live
    ? (other ? `${name} · ${distanceText(m)} away${seenAgo(other.at) !== "just now" ? ` · ${seenAgo(other.at)}` : ""}` : `${name} · waiting for location`)
    : visit.status === "shared" && side === "tenant" ? "Meeting spot shared · tap to open"
      : visit.status === "assigned" && side === "partner" ? `Share where to meet ${name}`
        : visit.status === "shared" && side === "partner" ? `Waiting for ${name} to set off` : "";
  if (!line) return null;
  const initial = name.slice(0, 1).toUpperCase();
  return (
    <button type="button" onClick={onOpen} aria-label={`Visit: ${line}`}
      style={{
        position: "fixed", right: 14, bottom: "calc(86px + env(safe-area-inset-bottom))", zIndex: 1200, display: "flex", alignItems: "center", gap: 10,
        maxWidth: "min(330px, calc(100vw - 28px))", padding: "8px 14px 8px 8px", borderRadius: 999, border: 0, cursor: "pointer",
        background: "#04211D", color: "#fff", boxShadow: "0 12px 30px rgba(4,33,29,.38)", font: "inherit", textAlign: "left",
      }}>
      <span style={{ position: "relative", width: 40, height: 40, borderRadius: 999, flex: "none", display: "grid", placeItems: "center",
        background: visit.live ? "#5EEAD4" : "#E4B659", color: "#04211D", fontWeight: 900, fontSize: 17 }}>
        {visit.live ? initial : <MapPin size={20} />}
        {visit.live && <span style={{ position: "absolute", inset: -4, borderRadius: 999, border: "2px solid #5EEAD4", animation: "lvb-pulse 1.6s ease-out infinite" }} />}
      </span>
      <span style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{line}</span>
      <style>{"@keyframes lvb-pulse { from { transform: scale(.9); opacity: .9 } to { transform: scale(1.45); opacity: 0 } }"}</style>
    </button>
  );
}

/** The visit the bubble is about: a live one first, then one waiting on this side. */
export function bubbleVisit(visits = [], side) {
  return visits.find((v) => v.live)
    || (side === "tenant" ? visits.find((v) => v.status === "shared") : visits.find((v) => v.status === "assigned" || v.status === "shared"))
    || null;
}
