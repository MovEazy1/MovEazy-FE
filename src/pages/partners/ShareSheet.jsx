/**
 * PRD 05 — the customer hand-off. Whatever is chosen, the customer receives
 * the public moveazy.co.in/p/:id page; nothing is stored here.
 */
import { useState } from "react";
import QRCode from "qrcode";
import { ChevronRight, QrCode } from "lucide-react";
import { Sheet, toast } from "./partnerUi";
import ShareOptions from "./ShareOptions";
import { SmartListingImage } from "./partnerMedia";
import { bhkLabel, customerMessage, displayLink, inr, partnerPropertyLink } from "../../lib/partners";

export default function ShareSheet({ listing: l, leadPhone = "", leadName = "", onClose, onSent }) {
  const [qr, setQr] = useState("");
  const message = customerMessage(l, { leadName });


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
            <ShareOptions url={partnerPropertyLink(l.property_id, leadPhone ? "whatsapp" : "share")} phone={leadPhone} onShare={() => onSent?.()}
              waLabel={leadName ? `WhatsApp ${leadName.split(" ")[0]}` : undefined} title={`${bhkLabel(l)} in ${l.area}`}
              message={message} post={`🏠 ${bhkLabel(l)} for rent in ${l.area || "Bengaluru"} — ${inr(l.rent)}/month. Photos and details:`} />
          </div>
          <div className="pz-pad" style={{ paddingTop: 0 }}>
            <div className="pz-card">
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
