/**
 * CRM → a partner broker's QR: the poster for their storefront, which shows
 * only that broker's flats (partner_storefront.sql). The code is made on first
 * ask (crm_partner_storefront), so MovEazy can print it for a broker who has
 * never opened "My QR poster" themselves.
 */
import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, X } from "lucide-react";
import { Btn, C } from "./crmUi";
import { fetchPartnerStorefront } from "../../lib/crmPropertyInternal";
import { storefrontDisplay, storefrontUrl } from "../../lib/storefront";
import { POSTER_DESIGNS, designOf, drawPoster, loadImage, posterFontsReady, posterPdf } from "../../lib/qrPoster";
import logoOnDark from "../../assets/logo/moveazy-logo-mint-dark.png";

export default function CrmBrokerQr({ partner, onClose, onToast }) {
  const [sf, setSf] = useState(null);
  const [err, setErr] = useState("");
  const [design, setDesign] = useState("profile");
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    fetchPartnerStorefront(partner.user_id).then(setSf, (e) => setErr(e?.message || "Could not get the QR."));
  }, [partner.user_id]);

  const data = async () => {
    const [photo, logo] = await Promise.all([loadImage(sf.photo_url), loadImage(logoOnDark), posterFontsReady()]);
    return {
      broker: { name: sf.name, agency: sf.agency, phone: sf.phone, rating: sf.rating, ratings: sf.ratings },
      url: storefrontUrl(sf.code, { qr: true }), displayUrl: storefrontDisplay(sf.code), photo, logo,
    };
  };

  useEffect(() => {
    if (!sf) return undefined;
    let alive = true;
    data().then((d) => { if (alive && ref.current) drawPoster(ref.current, design, d, 0.5); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sf, design]);

  const download = async () => {
    setBusy(true);
    try {
      const blob = await posterPdf(design, await data());
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `MovEazy-QR-${String(sf.name || sf.code).replace(/\W+/g, "-")}-${design}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 30000);
    } catch (e) {
      onToast?.(e?.message || "Could not make the PDF", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="presentation" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(16,34,30,.45)", zIndex: 80, display: "grid", placeItems: "center", padding: 20 }}>
      <div role="dialog" aria-modal="true" aria-label={`${partner.name}'s QR`} onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 12, padding: 18, width: "min(560px, 100%)", maxHeight: "92vh", overflow: "auto", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontSize: 15 }}>{partner.name}'s QR — their flats only</strong>
          <button type="button" className="crm-btn crm-btn--sm" onClick={onClose} aria-label="Close"><X size={14} /></button>
        </div>
        {err ? <span style={{ color: C.coral, fontSize: 13 }}>{err}</span> : !sf ? <span className="crm-mute">Getting the code…</span> : (
          <>
            <div style={{ display: "flex", gap: 6 }}>
              {POSTER_DESIGNS.map((d) => (
                <Btn key={d.id} sm variant={design === d.id ? "primary" : undefined} onClick={() => setDesign(d.id)}>{d.label}</Btn>
              ))}
            </div>
            <div style={{ display: "grid", placeItems: "center", background: C.surface, borderRadius: 10, padding: 12 }}>
              <canvas ref={ref} aria-label="Poster preview"
                style={{ width: designOf(design).orientation === "portrait" ? 260 : "100%", height: "auto", boxShadow: "0 6px 18px rgba(0,0,0,.15)", background: "#fff" }} />
            </div>
            <span className="crm-mute" style={{ fontSize: 11.5 }}>
              {sf.homes} live flat{Number(sf.homes) === 1 ? "" : "s"} on it · moveazy.co.in/b/{sf.code} · leads and likes go to {partner.name.split(" ")[0]}'s partner app.
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <Btn variant="primary" onClick={download} disabled={busy}><Download size={14} /> {busy ? "Making the PDF…" : "Download A4 PDF"}</Btn>
              <a className="crm-btn" href={storefrontUrl(sf.code)} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><ExternalLink size={14} /> Open page</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
