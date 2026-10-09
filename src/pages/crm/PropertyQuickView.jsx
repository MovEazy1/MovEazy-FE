/**
 * A flat, without leaving the client: the photos (swipe, tap for full
 * screen), the facts an agent quotes, who listed it, and the three things you
 * do next — open the public page, edit it, mark it sold out.
 *
 * Also exports the pieces the client screens share: the one-tap Sold out
 * button (today, with Undo) and a hook for a client's own swipes.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { fetchClientListingReactions } from "../../lib/crmClients";
import { propertyLink } from "../../lib/crmSettings";
import { markSoldOut, relistProperty, soldOutDate, todayInIndia } from "../../lib/soldOut";
import { listingMedia, MediaItem } from "../partners/partnerMedia";
import { useSnapTrack } from "../../hooks/useSnapTrack";
import { usePhotoViewer } from "../../hooks/usePhotoViewer";
import { useBackClose } from "../../hooks/useBackClose";
import { Btn, C, inr } from "./crmUi";

/* ── A client's own swipes, shared by the record, the matches and curating ── */

const reactionCache = new Map();

/** Their listing_reactions, fetched once per client per visit to the page. */
export function useClientReactions(userId) {
  const [rows, setRows] = useState(() => (userId && reactionCache.has(userId) ? reactionCache.get(userId).rows : []));
  useEffect(() => {
    let alive = true;
    if (!userId) { setRows([]); return undefined; }
    let entry = reactionCache.get(userId);
    if (!entry) {
      entry = { rows: [], promise: fetchClientListingReactions(userId).then((r) => { entry.rows = r ?? []; return entry.rows; }) };
      reactionCache.set(userId, entry);
    }
    entry.promise.then((r) => alive && setRows(r));
    return () => { alive = false; };
  }, [userId]);
  return rows;
}

/* ── Sold out, in one tap ─────────────────────────────────────────────────── */

/**
 * Marks the flat sold out today. Once marked it turns into "Sold out · Undo"
 * (relists it); a flat already sold out says when. The date can be changed
 * later in Properties.
 */
export function QuickSoldOut({ listing, canEdit, onPatch, onToast, sm = true, stop = false }) {
  const [busy, setBusy] = useState(false);
  const [justNow, setJustNow] = useState(false);
  if (!listing || !canEdit) return null;
  const halt = (e) => { if (stop) e.stopPropagation(); };

  if (listing.status === "rented") {
    const undo = async (e) => {
      halt(e);
      setBusy(true);
      try {
        await relistProperty(listing.property_id);
        onPatch(listing.property_id, { status: "published", sold_out_at: null, sold_out_by: "" });
        setJustNow(false);
        onToast(`${listing.property_id} is back on the market`);
      } catch (err) {
        onToast(err?.message || "Couldn't undo it", "error");
      } finally {
        setBusy(false);
      }
    };
    return justNow ? (
      <Btn sm={sm} onClick={undo} disabled={busy} style={{ borderColor: C.gold, color: C.gold }}>
        {busy ? "…" : "Sold out · Undo"}
      </Btn>
    ) : (
      <span className="crm-chip" style={{ pointerEvents: "none", borderColor: C.gold, color: C.gold, fontWeight: 600 }}>
        Sold out{listing.sold_out_at ? ` · ${soldOutDate(listing.sold_out_at)}` : ""}
      </span>
    );
  }

  const mark = async (e) => {
    halt(e);
    setBusy(true);
    try {
      const r = await markSoldOut(listing.property_id, todayInIndia());
      onPatch(listing.property_id, {
        status: "rented", sold_out_at: r?.sold_out_at ?? new Date().toISOString(), sold_out_by: r?.sold_out_by ?? "",
      });
      setJustNow(true);
      onToast(`${listing.property_id} marked sold out today`);
    } catch (err) {
      onToast(err?.message || "Couldn't mark it sold out", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Btn sm={sm} onClick={mark} disabled={busy} title="Sold out today — takes it off the site. Undo right after, or change the date in Properties.">
      {busy ? "…" : "Sold out"}
    </Btn>
  );
}

/* ── The preview ──────────────────────────────────────────────────────────── */

const STATUS = { published: ["Live", C.accent], paused: ["Paused", C.textMute], rented: ["Sold out", C.gold] };

function Photos({ listing }) {
  const media = listingMedia(listing);
  const { index, trackProps } = useSnapTrack();
  const full = usePhotoViewer(media, `${listing.flat_type || "Home"} · ${listing.area || ""}`);
  if (!media.length) {
    return <div style={{ height: 56, display: "grid", placeItems: "center", background: C.surfaceAlt, color: C.textMute, fontSize: 12 }}>No photos</div>;
  }
  return (
    <div style={{ position: "relative", aspectRatio: "4 / 3", background: "#0b1f1b" }}>
      <div className="mz-snap qv-photos" {...trackProps} style={{ position: "absolute", inset: 0 }}>
        {media.map((src, i) => (
          <div key={`${src}-${i}`} style={{ height: "100%", cursor: "zoom-in" }} onClick={() => full.open(i)}>
            {Math.abs(i - index) <= 1 ? <MediaItem src={src} /> : null}
          </div>
        ))}
      </div>
      {media.length > 1 && (
        <span style={{ position: "absolute", left: 10, bottom: 10, background: "rgba(4,33,29,.75)", color: "#fff", fontSize: 11.5, fontWeight: 700, borderRadius: 7, padding: "3px 8px", pointerEvents: "none" }}>
          {index + 1} / {media.length}
        </span>
      )}
      {full.viewer}
    </div>
  );
}

/**
 * @param {object}   listing   the CRM's inventory row
 * @param {string}   [note]    what this client said about it, if anything
 */
export default function PropertyQuickView({ listing, note = "", canEdit, onPatch, onToast, onClose, extra = null }) {
  useBackClose(true, onClose, "crm-property");
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  if (!listing) return null;
  const [label, color] = STATUS[listing.status] || [listing.status || "—", C.textMute];
  const rows = [
    ["Rent", listing.rent ? `${inr(listing.rent)} / month` : "—"],
    ["Deposit", listing.deposit ? inr(listing.deposit) : "—"],
    ["Furnishing", listing.furnishing || "—"],
    ["Available", listing.available_from ? new Date(listing.available_from).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Now"],
    ["Address", listing.full_address || listing.landmark || "—"],
    ["Listed by", [listing.poster_name, listing.posted_by, listing.phone].filter(Boolean).join(" · ") || "—"],
  ];
  return createPortal(
    <div className="crm qv-bg" onClick={onClose} role="presentation">
      <style>{CSS}</style>
      <div className="qv" role="dialog" aria-modal="true" aria-label={`${listing.property_id} preview`} onClick={(e) => e.stopPropagation()}>
        <div className="qv-head">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{listing.flat_type || "Home"} · {listing.area || "—"}</div>
            <div className="crm-mute crm-num" style={{ fontSize: 11.5 }}>
              {listing.property_id} · <span style={{ color, fontWeight: 700 }}>{label}</span>
              {listing.status === "rented" && listing.sold_out_at ? ` ${soldOutDate(listing.sold_out_at)}` : ""}
            </div>
          </div>
          <button type="button" className="qv-x" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="qv-body">
          <Photos listing={listing} />
          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {note && <div style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>{note}</div>}
            <div className="qv-kv">
              {rows.map(([k, v]) => <div key={k}><span className="crm-label">{k}</span><span style={{ fontSize: 12.5 }}>{v}</span></div>)}
            </div>
            {listing.description && <p style={{ margin: 0, fontSize: 12.5, color: C.textDim, lineHeight: 1.55, whiteSpace: "pre-line" }}>{listing.description}</p>}
          </div>
        </div>
        <div className="qv-foot">
          {extra}
          <a className="crm-btn" href={propertyLink(listing.property_id)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>Public page</a>
          {canEdit && <Link className="crm-btn" to={`/crm/properties/${encodeURIComponent(listing.property_id)}/edit`} style={{ textDecoration: "none" }}>Edit</Link>}
          <QuickSoldOut listing={listing} canEdit={canEdit} onPatch={onPatch} onToast={onToast} sm={false} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

const CSS = `
.crm.qv-bg { position: fixed; min-height: 0; inset: 0; z-index: 1200; background: rgba(4,33,29,.5); display: flex; align-items: center; justify-content: center; padding: 16px; }
.qv { width: 100%; max-width: 460px; max-height: calc(100dvh - 32px); background: ${C.bg}; border-radius: 14px; overflow: hidden;
  display: flex; flex-direction: column; box-shadow: 0 24px 60px rgba(4,33,29,.3); }
.qv-head { display: flex; align-items: center; gap: 10px; padding: 11px 12px 11px 14px; border-bottom: 1px solid ${C.line}; flex: none; }
.crm .qv-x { width: 34px; height: 34px; border-radius: 99px; border: 1px solid ${C.line}; background: ${C.surface}; display: grid; place-items: center; cursor: pointer; flex: none; color: ${C.text}; }
.qv-body { overflow-y: auto; flex: 1; min-height: 0; }
.qv-photos img, .qv-photos video { width: 100%; height: 100%; object-fit: cover; display: block; }
.qv-kv { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; }
.qv-kv > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
.qv-foot { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid ${C.line}; flex: none; }
@media (max-width: 600px) {
  .crm.qv-bg { align-items: flex-end; padding: 0; }
  .qv { max-width: none; border-radius: 16px 16px 0 0; max-height: 92dvh; }
}
`;
