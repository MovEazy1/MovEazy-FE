/**
 * A flat's (or its building's) QR poster: a live preview and the A4 PDF.
 * Shared by the owner app and the CRM; styling comes from the caller through
 * `btnClass` / `softClass`, so it sits in either kit.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink } from "lucide-react";
import { defaultToLetHeadline, downloadPoster, fetchPosterPhone, flatUrl, posterData, savePosterPhone } from "../lib/flatInsights";
import { buildingUrl } from "../lib/buildings";
import { PROPERTY_POSTER_STYLES, RED_TOLET_POSTER, designOf, drawPoster } from "../lib/qrPoster";
import logoOnDark from "../assets/logo/moveazy-logo-mint-dark.png";
import logoOnLight from "../assets/logo/moveazy-logo-mint-light.png";

const FIELD = { font: "inherit", fontSize: 14, fontWeight: 600, padding: "8px 10px", borderRadius: 10, border: "1.5px solid rgba(0,0,0,.16)", background: "#fff", color: "#13201B", width: "100%", boxSizing: "border-box" };
const LABEL = { display: "grid", gap: 4, fontSize: 12, fontWeight: 700, color: "#3B4743" };
const digits = (v) => String(v || "").replace(/\D/g, "");

/** Just the code, for a card: no poster around it. */
export function QrImage({ url, size = 96, title }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) QRCode.toCanvas(ref.current, url, { width: size, margin: 1, errorCorrectionLevel: "Q", color: { dark: "#0B1F17" } }).catch(() => {});
  }, [url, size]);
  return <canvas ref={ref} width={size} height={size} aria-label={title || "QR code"} style={{ width: size, height: size, display: "block", borderRadius: 6 }} />;
}

/**
 * `flat`: an inventory-shaped row. `building`: { id, code, name, area, landmark, photo, available, rentFrom, bhk, bhks } to show the building's poster.
 * The looks to pick from: PROPERTY_POSTER_STYLES, or only the ids in `styles`.
 * The red To-Let prints two phone numbers, one per line, saved on the flat or
 * on the building — each its own pair (poster_phone.sql) — under an editable
 * headline.
 * `onToast(message, kind)`: how the caller says things. `showLinks`: the copy / open row.
 */
export default function QrPosterBlock({ flat, building, btnClass = "", softClass = "", onToast = () => {}, previewWidth = 230, styles, showLinks = true }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const offered = styles ? PROPERTY_POSTER_STYLES.filter((s) => styles.includes(s.id)) : PROPERTY_POSTER_STYLES;
  const [style, setStyle] = useState(offered[0]?.id || "photo");
  const design = style === "photo" ? "building" : style;
  const toLet = style === RED_TOLET_POSTER.id;
  const link = building ? buildingUrl(building.code) : flatUrl(flat.property_id);

  // The To-Let's two numbers: the flat's own pair, or the building's.
  const buildingId = building?.id || null;
  const propertyId = building ? null : flat?.property_id || null;
  const [saved, setSaved] = useState(null); // { phone, phone2 } once loaded
  const [phones, setPhones] = useState(["", ""]);
  const [savingPhone, setSavingPhone] = useState(false);
  const [headline, setHeadline] = useState(() => defaultToLetHeadline({ flat, building }));
  useEffect(() => {
    if (!toLet || saved || !(buildingId || propertyId)) return undefined;
    let alive = true;
    fetchPosterPhone({ buildingId, propertyId })
      .then((r) => { if (alive) { setSaved(r); setPhones([r.phone || "", r.phone2 || ""]); } })
      .catch((e) => { if (alive) { setSaved({}); onToast(e?.message || "Couldn't load the poster's numbers", "error"); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toLet, buildingId, propertyId]);
  const typed = phones.map(digits);
  const ready = typed.every((d) => d.length >= 10);
  const dirty = Boolean(saved) && (typed[0] !== (saved.phone || "") || typed[1] !== (saved.phone2 || ""));
  const setPhone = (k, v) => setPhones((cur) => cur.map((p, i) => (i === k ? v : p)));

  const savePhone = async () => {
    setSavingPhone(true);
    try {
      const r = await savePosterPhone({ buildingId, propertyId }, phones[0], phones[1]);
      setSaved(r);
      setPhones([r.phone || "", r.phone2 || ""]);
      onToast(r.phone ? "Poster numbers saved" : "Poster numbers removed");
      return true;
    } catch (e) {
      onToast(e?.message || "Couldn't save the numbers", "error");
      return false;
    } finally {
      setSavingPhone(false);
    }
  };

  const key = useMemo(
    () => JSON.stringify([flat?.property_id, flat?.rent, flat?.cover_image_url, flat?.flat_type, building?.code, building?.available, building?.bhk, style, toLet ? headline : "", toLet ? typed.join("|") : ""]),
    [flat, building, style, toLet, headline, typed],
  );
  const dataFor = () => posterData({ flat, building, logoSrc: logoOnDark, lightLogoSrc: logoOnLight, style, headline, phones: typed });

  useEffect(() => {
    let alive = true;
    dataFor().then((p) => { if (alive && ref.current) drawPoster(ref.current, p.design, p.data, 0.55); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const download = async () => {
    if (toLet && dirty && !(await savePhone())) return;
    setBusy(true);
    try {
      const name = building ? building.name : `${flat.property_id}`;
      await downloadPoster(await dataFor(), `MovEazy-QR-${String(name).replace(/\W+/g, "-")}${style === "photo" ? "" : `-${toLet ? "To-Let" : style}`}.pdf`);
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
      {offered.length > 1 && (
        <div role="radiogroup" aria-label="Poster design" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))", gap: 6, marginBottom: 8 }}>
          {offered.map((s) => {
            const on = style === s.id;
            return (
              <button key={s.id} type="button" role="radio" aria-checked={on} onClick={() => setStyle(s.id)} title={s.hint}
                style={{
                  padding: "7px 8px", borderRadius: 10, cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 700, lineHeight: 1.25, textAlign: "center",
                  border: `1.5px solid ${on ? "#0B3D2C" : "rgba(0,0,0,.14)"}`, background: on ? "#E8F1EC" : "#fff", color: on ? "#0B3D2C" : "#3B4743",
                }}>
                {s.label}
                <span style={{ display: "block", fontSize: 10.5, fontWeight: 500, opacity: 0.75 }}>{s.hint}</span>
              </button>
            );
          })}
        </div>
      )}
      {toLet && (
        <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
          <label style={LABEL}>
            Headline
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={40} style={FIELD} />
          </label>
          <div style={LABEL}>
            <span>Poster phone numbers</span>
            {[0, 1].map((k) => (
              <input key={k} type="tel" inputMode="numeric" value={phones[k]} onChange={(e) => setPhone(k, e.target.value)} maxLength={16}
                placeholder={`${k ? "Second" : "First"} 10-digit number`} disabled={!saved} style={FIELD} aria-label={`Poster phone number ${k + 1}`} />
            ))}
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ flex: 1, fontSize: 11, fontWeight: 500, color: "#6B7570", lineHeight: 1.4 }}>
                {!saved ? "Loading the saved numbers…" : `Both print on the poster, one per line. Saved on this ${buildingId ? "building's" : "flat's"} poster only.`}
              </span>
              <button type="button" className={softClass} onClick={savePhone} disabled={!dirty || savingPhone} style={{ justifyContent: "center", flexShrink: 0 }}>
                {savingPhone ? "Saving…" : "Save"}
              </button>
            </span>
          </div>
        </div>
      )}
      <div style={{ display: "grid", placeItems: "center", background: "#F3F0E8", borderRadius: 14, padding: 12 }}>
        <canvas ref={ref} aria-label="Poster preview" style={{ display: "block", width: `min(100%, ${previewWidth}px)`, height: "auto", borderRadius: 4, boxShadow: "0 8px 24px rgba(0,0,0,.18)", background: "#fff" }} />
      </div>
      <button type="button" className={btnClass} onClick={download} disabled={busy || savingPhone || (toLet && !ready)} style={{ width: "100%", marginTop: 10, justifyContent: "center" }}>
        <Download size={17} /> {busy ? "Making the PDF…" : toLet && !ready ? "Add both poster numbers first" : `Download ${designOf(design).paper || "A4"} poster (PDF)`}
      </button>
      {showLinks && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
          <button type="button" className={softClass} onClick={copy} style={{ justifyContent: "center" }}><Copy size={15} /> Copy link</button>
          <a className={softClass} href={link} target="_blank" rel="noreferrer" style={{ justifyContent: "center", textDecoration: "none" }}><ExternalLink size={15} /> Open page</a>
        </div>
      )}
    </div>
  );
}
