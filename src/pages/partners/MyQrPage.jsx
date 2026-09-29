/**
 * My QR — the broker's poster and what it brings in.
 *
 * Two poster designs, both printable as an A4 PDF: their profile beside the
 * QR, or "Looking for a Premium Home?" over a big QR. The photo they upload
 * goes on both, and on the storefront the QR opens (moveazy.co.in/b/<code>).
 * Below: visitors and QR scans this week, and who liked which flat — with the
 * tenant's number, since the storefront told them it would be shared.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Copy, Download, ExternalLink, Heart, Phone, QrCode, Star, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePartner } from "./PartnerApp";
import { Avatar, Loading, TopBar, WhatsAppIcon, toast } from "./partnerUi";
import { SmartListingImage } from "./partnerMedia";
import { friendlyError, inr, pp, telLink, waLink } from "../../lib/partners";
import {
  fetchMyStorefront, removeStorefrontPhoto, storefrontDisplay, storefrontUrl, uploadStorefrontPhoto,
} from "../../lib/storefront";
import { POSTER_DESIGNS, drawPoster, loadImage, posterFontsReady, posterPdf } from "../../lib/qrPoster";
import logoOnDark from "../../assets/logo/moveazy-logo-mint-dark.png";

function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? "Yesterday" : `${d} days ago`;
}

export default function MyQrPage() {
  const { user } = useAuth();
  const { me } = usePartner() || {};
  const partner = me?.partner || {};
  const [sf, setSf] = useState(null);
  const [err, setErr] = useState("");
  const [design, setDesign] = useState("profile");
  const [photoSrc, setPhotoSrc] = useState("");
  const [busy, setBusy] = useState("");
  const canvasRef = useRef(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const d = await fetchMyStorefront();
      setSf(d);
      setErr("");
      return d;
    } catch (e) {
      setErr(friendlyError(e, "Could not load your QR."));
      return null;
    }
  }, []);

  useEffect(() => {
    load().then((d) => { if (d?.photo_url) setPhotoSrc((cur) => cur || d.photo_url); });
  }, [load]);

  const posterData = useCallback(async () => {
    const [photo, logo] = await Promise.all([loadImage(photoSrc), loadImage(logoOnDark), posterFontsReady()]);
    return {
      broker: { name: partner.name, agency: partner.agency, phone: partner.phone, rating: sf?.rating, ratings: sf?.ratings },
      url: storefrontUrl(sf.code, { qr: true }),
      displayUrl: storefrontDisplay(sf.code),
      photo,
      logo,
    };
  }, [photoSrc, partner.name, partner.agency, partner.phone, sf]);

  // The preview: the same drawing the PDF gets, smaller.
  useEffect(() => {
    if (!sf?.code || !canvasRef.current) return undefined;
    let alive = true;
    posterData().then((data) => { if (alive && canvasRef.current) drawPoster(canvasRef.current, design, data, 0.9); });
    return () => { alive = false; };
  }, [sf?.code, design, posterData]);

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast("Pick a photo (JPG or PNG).", "error"); return; }
    const local = URL.createObjectURL(file);
    const before = photoSrc;
    setPhotoSrc(local);
    setBusy("photo");
    try {
      await uploadStorefrontPhoto(user?.id, file);
      await load();
      toast("Photo added");
    } catch (ex) {
      setPhotoSrc(before);
      toast(friendlyError(ex, "Could not upload that photo."), "error");
    } finally {
      setBusy("");
    }
  };

  const removePhoto = async () => {
    setBusy("photo");
    try {
      await removeStorefrontPhoto();
      setPhotoSrc("");
      await load();
    } catch (ex) {
      toast(friendlyError(ex, "Could not remove the photo."), "error");
    } finally {
      setBusy("");
    }
  };

  const download = async () => {
    setBusy("pdf");
    try {
      const blob = await posterPdf(design, await posterData());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MovEazy-QR-${design === "premium" ? "premium-home" : "profile"}-${sf.code}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (ex) {
      toast(friendlyError(ex, "Could not make the PDF."), "error");
    } finally {
      setBusy("");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(storefrontUrl(sf.code));
      toast("Link copied");
    } catch {
      toast(storefrontDisplay(sf.code));
    }
  };

  if (!sf && !err) return <><TopBar title="My QR poster" back /><Loading /></>;
  if (!sf) {
    return (
      <>
        <TopBar title="My QR poster" back />
        <div className="pz-pad"><div className="pz-section">{err} <button type="button" className="pz-btn pz-btn--sm" onClick={load}>Try again</button></div></div>
      </>
    );
  }

  const days = sf.by_day || [];
  const peak = Math.max(1, ...days.map((d) => d.views));
  const share = `https://wa.me/?text=${encodeURIComponent(`See the homes I have on MovEazy: ${storefrontUrl(sf.code)}`)}`;

  return (
    <>
      <TopBar title="My QR poster" back />
      <div className="pz-pad">
        <div className="pz-section" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", textAlign: "center", padding: 10 }}>
          {[["Visitors", sf.visitors_week, "this week"], ["QR scans", sf.scans_week, "this week"], ["Likes", sf.likes_total, "all time"]].map(([k, v, s]) => (
            <div key={k}><div style={{ fontSize: 22, fontWeight: 800 }}>{v ?? 0}</div><div className="pz-meta">{k}<span style={{ display: "block", fontSize: 11 }}>{s}</span></div></div>
          ))}
        </div>

        <div className="pz-section">
          <h2>Last 7 days <span className="pz-meta" style={{ fontWeight: 500 }}><i className="myqr-key" /> QR scans <i className="myqr-key myqr-key--v" /> visitors</span></h2>
          <div className="myqr-bars">
            {days.map((d) => (
              <div key={d.day} className="myqr-bar" title={`${d.views} visitors, ${d.scans} from the QR`}>
                <div className="myqr-col" style={{ height: `${(d.views / peak) * 100}%` }}>
                  <div className="myqr-scan" style={{ height: d.views ? `${(d.scans / d.views) * 100}%` : 0 }} />
                </div>
                <span>{new Date(`${d.day}T00:00:00`).toLocaleDateString("en-IN", { weekday: "narrow" })}</span>
              </div>
            ))}
          </div>
          <p className="pz-hint" style={{ margin: "10px 0 0", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2px 12px" }}>
            <span>{Number(sf.visitors) || 0} visitors all time</span>
            {Number(sf.ratings) > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Star size={12} fill="#E4B659" color="#E4B659" /> {Number(sf.rating).toFixed(1)} from {sf.ratings} rating{Number(sf.ratings) === 1 ? "" : "s"}
              </span>
            )}
          </p>
        </div>

        <div className="pz-section">
          <h2>Your poster</h2>
          <div className="myqr-designs" role="radiogroup" aria-label="Poster design">
            {POSTER_DESIGNS.map((d) => (
              <button key={d.id} type="button" role="radio" aria-checked={design === d.id} className={`myqr-design${design === d.id ? " on" : ""}`} onClick={() => setDesign(d.id)}>
                <span className={`myqr-thumb myqr-thumb--${d.id}`} aria-hidden><QrCode size={16} /></span>
                <span><b>{d.label}</b><small>A4 {d.orientation}</small></span>
              </button>
            ))}
          </div>
          <div className={`myqr-preview myqr-preview--${design}`}>
            <canvas ref={canvasRef} aria-label="Poster preview" />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button type="button" className="pz-btn" style={{ flex: 1 }} onClick={() => fileRef.current?.click()} disabled={busy === "photo"}>
              <Camera size={17} /> {busy === "photo" ? "Uploading…" : photoSrc ? "Change photo" : "Add your photo"}
            </button>
            {photoSrc && (
              <button type="button" className="pz-btn" onClick={removePhoto} disabled={busy === "photo"} aria-label="Remove photo"><Trash2 size={17} /></button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
          </div>
          <button type="button" className="pz-btn pz-btn--primary pz-btn--block" style={{ marginTop: 10 }} onClick={download} disabled={busy === "pdf"}>
            <Download size={18} /> {busy === "pdf" ? "Making your PDF…" : "Download A4 PDF"}
          </button>
          <p className="pz-hint" style={{ textAlign: "center", margin: "8px 0 0" }}>Print it and paste it where tenants look — society gates, cafés, PG notice boards.</p>
        </div>

        <div className="pz-section">
          <h2>Your storefront</h2>
          <p className="pz-meta" style={{ margin: "0 0 10px" }}>
            The QR opens <b style={{ color: "var(--ink)" }}>{storefrontDisplay(sf.code)}</b> — your photo, rating and the {sf.homes} live flat{Number(sf.homes) === 1 ? "" : "s"} you’ve listed.
          </p>
          {Number(sf.homes) === 0 && (
            <p className="pz-row" style={{ background: "var(--warnbg)", color: "var(--warn)", borderRadius: 10, padding: 10, fontSize: 13.5, margin: "0 0 10px" }}>
              Nothing to show yet. <Link to={pp("/add/property")} style={{ fontWeight: 700, color: "inherit" }}>Add a property</Link>
            </p>
          )}
          <div className="pz-actions" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 0 }}>
            <a className="pz-btn pz-wa" href={share} target="_blank" rel="noreferrer"><WhatsAppIcon /> Share</a>
            <button type="button" className="pz-btn" onClick={copy}><Copy size={16} /> Copy</button>
            <a className="pz-btn" href={storefrontUrl(sf.code)} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open</a>
          </div>
        </div>

        <div className="pz-section" style={{ padding: 0 }}>
          <h2 style={{ padding: "14px 14px 0" }}>Who liked what</h2>
          {(sf.likes || []).length === 0 ? (
            <p className="pz-meta" style={{ padding: "0 14px 14px", margin: 0 }}>When a tenant hearts one of your flats, they show up here with their number.</p>
          ) : (
            sf.likes.map((l, i) => (
              <div key={`${l.property_id}-${l.at}`} className="pz-row" style={{ padding: "12px 14px", borderTop: i ? "1px solid var(--line)" : "1px solid var(--line)", alignItems: "flex-start" }}>
                <Avatar name={l.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 15 }}>{l.name}</strong>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#E11D48", fontWeight: 700 }}>
                    <Heart size={12} fill="#E11D48" color="#E11D48" style={{ flex: "none" }} /> {[l.flat_type, l.area].filter(Boolean).join(" · ")}{l.rent ? ` · ${inr(l.rent)}` : ""}
                  </span>
                  <span className="pz-hint">{ago(l.at)}</span>
                  {l.phone && (
                    <div className="pz-row" style={{ gap: 8, marginTop: 8 }}>
                      <a className="pz-btn pz-btn--sm pz-wa" href={waLink(l.phone, `Hi ${l.name.split(" ")[0]}, this is ${partner.name || "your broker"} from MovEazy — you liked the ${[l.flat_type, l.area].filter(Boolean).join(" in ")}. Shall I set up a visit?`)} target="_blank" rel="noreferrer"><WhatsAppIcon size={15} /> WhatsApp</a>
                      <a className="pz-btn pz-btn--sm" href={telLink(l.phone)}><Phone size={15} /> Call</a>
                    </div>
                  )}
                </div>
                <Link to={pp(`/property/${l.property_id}`)} className="pz-prop-img" style={{ width: 64, height: 50, borderRadius: 8, overflow: "hidden", flex: "none", aspectRatio: "auto" }}>
                  <SmartListingImage listing={l} />
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
      <style>{CSS}</style>
    </>
  );
}

const CSS = `
.myqr-key { display: inline-block; width: 9px; height: 9px; border-radius: 3px; background: var(--g); margin: 0 3px 0 8px; vertical-align: 0; }
.myqr-key--v { background: var(--gl2); }
.myqr-bars { display: flex; gap: 8px; align-items: flex-end; height: 104px; }
.myqr-bar { flex: 1; height: 100%; display: flex; flex-direction: column; align-items: stretch; justify-content: flex-end; gap: 4px; }
.myqr-bar span { font-size: 11px; color: var(--dim); text-align: center; }
.myqr-col { background: var(--gl2); border-radius: 6px; min-height: 3px; display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; }
.myqr-scan { background: var(--g); }
.myqr-designs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.myqr-design { display: flex; align-items: center; gap: 10px; text-align: left; padding: 10px; border-radius: 12px; border: 1.5px solid var(--line); background: #fff; font: inherit; color: var(--ink); cursor: pointer; }
.myqr-design.on { border-color: var(--g); background: var(--gl); }
.myqr-design b { display: block; font-size: 14px; }
.myqr-design small { display: block; font-size: 12px; color: var(--dim); }
.myqr-thumb { flex: none; display: grid; place-items: center; border-radius: 5px; }
.myqr-thumb--profile { width: 38px; height: 27px; background: #F7F5EE; border: 1px solid var(--line); color: var(--ink); }
.myqr-thumb--premium { width: 27px; height: 38px; background: #0A3A2A; color: #E4B659; }
.myqr-preview { margin-top: 12px; display: flex; justify-content: center; background: #EEF0EE; border-radius: 12px; padding: 12px; }
.myqr-preview canvas { display: block; width: 100%; height: auto; border-radius: 4px; box-shadow: 0 8px 24px rgba(0,0,0,.18); background: #fff; }
.myqr-preview--premium canvas { width: min(100%, 300px); }
`;
