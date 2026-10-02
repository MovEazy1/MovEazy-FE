/**
 * A flat's (or its building's) QR poster: a live preview and the A4 PDF.
 * Shared by the owner app and the CRM; styling comes from the caller through
 * `btnClass` / `softClass`, so it sits in either kit.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink } from "lucide-react";
import { downloadPoster, flatUrl, posterData } from "../lib/flatInsights";
import { buildingUrl } from "../lib/buildings";
import { drawPoster } from "../lib/qrPoster";
import logoOnDark from "../assets/logo/moveazy-logo-mint-dark.png";

/** Just the code, for a card: no poster around it. */
export function QrImage({ url, size = 96, title }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) QRCode.toCanvas(ref.current, url, { width: size, margin: 1, errorCorrectionLevel: "Q", color: { dark: "#0B1F17" } }).catch(() => {});
  }, [url, size]);
  return <canvas ref={ref} width={size} height={size} aria-label={title || "QR code"} style={{ width: size, height: size, display: "block", borderRadius: 6 }} />;
}

/**
 * `flat`: an inventory-shaped row. `building`: { code, name, area, landmark, photo, available, rentFrom } to show the building's poster.
 * `onToast(message, kind)`: how the caller says things.
 */
export default function QrPosterBlock({ flat, building, btnClass = "", softClass = "", onToast = () => {}, previewWidth = 230 }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const link = building ? buildingUrl(building.code) : flatUrl(flat.property_id);
  const key = useMemo(() => JSON.stringify([flat?.property_id, flat?.rent, flat?.cover_image_url, building?.code, building?.available]), [flat, building]);

  useEffect(() => {
    let alive = true;
    posterData({ flat, building, logoSrc: logoOnDark }).then((p) => { if (alive && ref.current) drawPoster(ref.current, p.design, p.data, 0.55); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const download = async () => {
    setBusy(true);
    try {
      const name = building ? building.name : `${flat.property_id}`;
      await downloadPoster(await posterData({ flat, building, logoSrc: logoOnDark }), `MovEazy-QR-${String(name).replace(/\W+/g, "-")}.pdf`);
    } catch (e) {
      onToast(e?.message || "Could not make the PDF.", "error");
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); onToast("Link copied"); } catch { onToast(link); }
  };

  return (
    <div>
      <div style={{ display: "grid", placeItems: "center", background: "#F3F0E8", borderRadius: 14, padding: 12 }}>
        <canvas ref={ref} aria-label="Poster preview" style={{ display: "block", width: `min(100%, ${previewWidth}px)`, height: "auto", borderRadius: 4, boxShadow: "0 8px 24px rgba(0,0,0,.18)", background: "#fff" }} />
      </div>
      <button type="button" className={btnClass} onClick={download} disabled={busy} style={{ width: "100%", marginTop: 10, justifyContent: "center" }}>
        <Download size={17} /> {busy ? "Making the PDF…" : "Download A4 poster (PDF)"}
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        <button type="button" className={softClass} onClick={copy} style={{ justifyContent: "center" }}><Copy size={15} /> Copy link</button>
        <a className={softClass} href={link} target="_blank" rel="noreferrer" style={{ justifyContent: "center", textDecoration: "none" }}><ExternalLink size={15} /> Open page</a>
      </div>
    </div>
  );
}
