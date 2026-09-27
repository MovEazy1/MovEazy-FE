/**
 * PRD 05 — the customer hand-off. Whatever is chosen, the customer receives
 * the public moveazy.co.in/p/:id page; nothing is stored here.
 */
import { useState } from "react";
import QRCode from "qrcode";
import { ChevronRight, Copy, Globe, QrCode, Share2 } from "lucide-react";
import { Sheet, WhatsAppIcon, toast } from "./partnerUi";
import { SmartListingImage } from "./partnerMedia";
import { bhkLabel, customerMessage, displayLink, inr, partnerPropertyLink, waLink } from "../../lib/partners";

export default function ShareSheet({ listing: l, leadPhone = "", leadName = "", onClose, onSent }) {
  const [qr, setQr] = useState("");
  const message = customerMessage(l, { leadName });

  const copy = async () => {
    const link = partnerPropertyLink(l.property_id, "copy");
    try {
      await navigator.clipboard.writeText(link);
      toast("Link copied");
    } catch {
      window.prompt("Copy this link", link);
    }
  };

  const native = async () => {
    const url = partnerPropertyLink(l.property_id, "native_share");
    if (navigator.share) {
      try { await navigator.share({ title: `${bhkLabel(l)} in ${l.area}`, text: message.split("\n")[0], url }); } catch { /* dismissed */ }
    } else {
      copy();
    }
  };

  const showQr = async () => {
    try {
      setQr(await QRCode.toDataURL(partnerPropertyLink(l.property_id, "qr"), { width: 560, margin: 1, color: { dark: "#111827" } }));
    } catch {
      toast("Could not make a QR code", "error");
    }
  };

  const row = (icon, title, sub, onClick, href) => {
    const inner = (
      <>
        <span className="pz-avatar" style={{ background: "#F3F4F6", color: "var(--ink)" }}>{icon}</span>
        <span style={{ flex: 1 }}>{title}{sub && <span className="pz-sub">{sub}</span>}</span>
        <ChevronRight size={18} color="#9CA3AF" />
      </>
    );
    return href
      ? <a className="pz-menurow" href={href} target="_blank" rel="noreferrer" onClick={onClick}>{inner}</a>
      : <button type="button" className="pz-menurow" onClick={onClick}>{inner}</button>;
  };

  return (
    <Sheet title="Share Property" onClose={onClose}>
      <div className="pz-pad">
        <div className="pz-card pz-row" style={{ padding: 10 }}>
          <div style={{ width: 72, height: 56, borderRadius: 8, overflow: "hidden", flex: "none", background: "#E5E7EB" }}
            className="pz-prop-img"><SmartListingImage listing={l} /></div>
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: "block" }}>{bhkLabel(l)} in {l.area}</strong>
            <span style={{ fontSize: 14 }}>{inr(l.rent)} / month</span>
            <span style={{ display: "block", color: "#2563EB", fontSize: 13 }}>{displayLink(l.property_id)}</span>
          </div>
        </div>
      </div>

      {qr ? (
        <div className="pz-pad" style={{ textAlign: "center" }}>
          <img src={qr} alt={`QR code for ${displayLink(l.property_id)}`} style={{ width: "min(280px, 80vw)", borderRadius: 12, border: "1px solid var(--line)" }} />
          <p className="pz-meta">Customer scans this to open the property page.</p>
          <button type="button" className="pz-btn" onClick={() => setQr("")}>Back to share options</button>
        </div>
      ) : (
        <>
          <div className="pz-pad" style={{ paddingTop: 0 }}>
            <span className="pz-label">Share via WhatsApp</span>
            <a className="pz-card pz-menurow" style={{ borderRadius: 12 }} target="_blank" rel="noreferrer"
              href={waLink(leadPhone, message)} onClick={() => onSent?.()}>
              <span className="pz-avatar" style={{ background: "#22C55E", color: "#fff" }}><WhatsAppIcon /></span>
              <span style={{ flex: 1 }}>Send on WhatsApp
                <span className="pz-sub">{leadName ? `To ${leadName}` : "Open WhatsApp with property link"}</span></span>
              <ChevronRight size={18} color="#9CA3AF" />
            </a>
          </div>
          <div className="pz-pad" style={{ paddingTop: 0 }}>
            <span className="pz-label">Other options</span>
            <div className="pz-card">
              {row(<Copy size={17} />, "Copy Link", "", copy)}
              {row(<Globe size={17} />, "Share on Facebook", "Opens Facebook's share window", null,
                `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(partnerPropertyLink(l.property_id, "facebook"))}`)}
              {row(<Share2 size={17} />, "Share via More Apps", "", native)}
              {row(<QrCode size={17} />, "Show QR Code", "When you're with the customer", showQr)}
            </div>
          </div>
          <div className="pz-pad" style={{ paddingTop: 0 }}>
            <div style={{ background: "#F3F4F6", borderRadius: 12, padding: 12, fontSize: 13.5, whiteSpace: "pre-wrap", color: "#374151" }}>
              {message}
            </div>
          </div>
        </>
      )}
    </Sheet>
  );
}
