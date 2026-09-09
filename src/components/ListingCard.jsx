/**
 * One listing, as a card.
 *
 * Extracted from the map's List tab so the same card renders wherever listings
 * are shown — the map list, and the recommendations a seeker gets after telling
 * us what they want. Those had drifted into two different layouts for the same
 * object, which made the second set look like a different product.
 */
import { isVideoUrl } from "../lib/listingMedia";

function Media({ src, alt, style }) {
  if (!src) return null;
  if (isVideoUrl(src)) return <video src={src} style={style} autoPlay muted loop playsInline />;
  return <img src={src} alt={alt} loading="lazy" style={style} />;
}

export default function ListingCard({
  listing: l, saved, isActive, isMobile, commuteLabel, distanceKm,
  onSelect, onSave, onDetails, cover,
  // Slots so a caller can add what only its own flow has — match reasons on the
  // recommendations page, for instance — without forking the card's layout.
  badges = null, extra = null, onHover,
}) {
  // Matches how the map's own "Flatmate" filter defines it (MapView line ~898),
  // so the badge and the filter can never disagree.
  const isFlatmate = l.bhk === "Roommate needed";
  const listingCoverSrc = () => cover ?? (l.image || (l.images || [])[0] || "");

  return (
    <article
          role="button"
        tabIndex={0}
        onClick={() => onSelect?.(l)}
        onMouseEnter={() => onHover?.(l)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect?.(l); } }}
        style={{
          background: "#fff",
          border: isActive ? "1px solid #ee5b45" : "1px solid #e9e3db",
          borderRadius: 16,
          overflow: "hidden",
          display: "flex",
          cursor: "pointer",
          transition: "transform 0.18s, box-shadow 0.18s, border-color 0.18s",
          boxShadow: isActive ? "0 4px 14px rgba(23,20,18,.08), 0 10px 34px rgba(23,20,18,.07)" : "0 1px 2px rgba(23,20,18,.05), 0 2px 6px rgba(23,20,18,.04)",
        }}
      >
        <div style={{ width: isMobile ? 120 : 148, flexShrink: 0, position: "relative", background: "#efe7dc" }}>
          {listingCoverSrc() ? (
            <Media src={listingCoverSrc()} alt={l.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ width: "100%", height: "100%" }} aria-hidden />
          )}
          <span
            style={{
              position: "absolute", top: 10, left: 10,
              background: isFlatmate ? "rgba(124,140,107,.92)" : "rgba(23,20,18,.82)",
              color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
            }}
          >
            {isFlatmate ? "Flatmate" : "Entire flat"}
          </span>
          <button
            type="button"
            aria-label={saved ? "Remove from saved" : "Save listing"}
            onClick={(e) => {
              e.stopPropagation();
              onSave?.(l);
            }}
            style={{
              position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: "50%",
              border: "none", background: "rgba(255,255,255,.9)", boxShadow: "0 1px 2px rgba(23,20,18,.05)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: saved ? "#ee5b45" : "#5c554e",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-7-4.4-9.5-8.5C.7 9 2 5.5 5 5.5c2 0 3.2 1.3 4 2.5.8-1.2 2-2.5 4-2.5 3 0 4.3 3.5 2.5 7C19 16.6 12 21 12 21z" />
            </svg>
          </button>
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: "10px 13px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 800, fontSize: 16.5, letterSpacing: "-0.01em", color: "#171412" }}>{l.price}</div>
            {commuteLabel ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#ee5b45", background: "#fdeee9", padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }} title={`${commuteLabel} drive to office · ${distanceKm} km`}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" /></svg>
                {commuteLabel} to office
              </span>
            ) : distanceKm ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#ee5b45", background: "#fdeee9", padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
                ~{distanceKm} km from pin
              </span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#7c8c6b", background: "#eef1e9", padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
                {l.bhk}
              </span>
            )}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14.5, margin: "4px 0 1px", letterSpacing: "-0.01em", color: "#171412", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {l.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#5c554e", fontSize: 12.5 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, color: "#948c83" }}>
              <path d="M12 22s7-7.8 7-13a7 7 0 10-14 0c0 5.2 7 13 7 13z" /><circle cx="12" cy="9" r="2.5" />
            </svg>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.address}</span>
          </div>
          {badges}
          <div style={{ display: "flex", gap: 10, marginTop: "auto", paddingTop: 7, color: "#5c554e", fontSize: 11.5, fontWeight: 600, flexWrap: "wrap" }}>
            {l.propertyType ? <span>{l.propertyType}</span> : null}
            {l.furnishing ? <span>· {l.furnishing}</span> : null}
            {l.availability ? <span>· {l.availability}</span> : null}
          </div>
          {extra}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 7, paddingTop: 7, borderTop: "1px solid #f1ece5" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#5c554e" }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#fdeee9", color: "#d8412b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800, flexShrink: 0 }}>
                {String(l.seller || "?").trim().charAt(0).toUpperCase() || "?"}
              </span>
              {l.seller}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDetails(l);
              }}
              style={{
                border: "none", background: "none", padding: 0, cursor: "pointer",
                fontSize: 12.5, fontWeight: 700, color: "#d8412b", display: "flex", alignItems: "center", gap: 3,
              }}
            >
              Details
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
        </div>
      </article>
    );
}
