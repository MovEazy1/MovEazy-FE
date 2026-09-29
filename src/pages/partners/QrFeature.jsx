/**
 * "Your QR. Your storefront." — the partner landing's QR section (live: My QR in the app).
 *
 * One looping scene tells it: the broker's QR poster lifts out of the app,
 * gets pasted on a wall in their area, a tenant walks up and scans it, and the
 * broker's phone lights up with who viewed and who liked what. Below it, the
 * two screens that story ends on — the tenant's view of the broker's homes and
 * the broker's QR insights — over MovEazy's real inventory.
 *
 * The scene is one SVG so it scales as a single picture. Its resting state is
 * the story's last frame; the loop only runs once it's on screen, and never
 * for people who asked for reduced motion.
 *
 * On a phone the two screens sit side by side in a strip that is pinned while
 * the page scrolls past it: scrolling down slides the strip right, to its end,
 * and scrolling up slides it back.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { BadgeCheck, Heart, MapPin, Phone, Star } from "lucide-react";
import { Shot, useScrollSlide } from "../landing/landingKit";
import { Avatar, TopBar, WhatsAppIcon } from "./partnerUi";
import { SmartListingImage } from "./partnerMedia";
import { inr } from "../../lib/landingCalc";
import logoOnDark from "../../assets/logo/moveazy-logo-mint-dark.png";

// The demo poster's code is real: scanning it opens the partner sign-up.
const QR_TARGET = "https://partners.moveazy.co.in/";
const AGENT = { name: "Ravi Kumar", rating: "4.9", reviews: 126, homes: 24 };
const FONT = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";

function useQrModules(text) {
  return useMemo(() => {
    try {
      const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
      const n = modules.size;
      let d = "";
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (modules.data[y * n + x]) d += `M${x} ${y}h1v1h-1z`;
      return { n, d };
    } catch {
      return null;
    }
  }, [text]);
}

/** A QR code drawn at (x, y), `size` wide, with a one-module white margin. */
function QrMark({ qr, x, y, size }) {
  if (!qr) return <rect x={x} y={y} width={size} height={size} rx="6" fill="#0B1F17" opacity=".1" />;
  const k = size / (qr.n + 2);
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <rect width={qr.n + 2} height={qr.n + 2} fill="#fff" />
      <path transform="translate(1 1)" d={qr.d} fill="#0B1F17" shapeRendering="crispEdges" />
    </g>
  );
}

/** An illustrated broker portrait in a 100 × 100 box. */
function AgentFace({ clip }) {
  return (
    <g>
      <clipPath id={clip}><circle cx="50" cy="50" r="50" /></clipPath>
      <circle cx="50" cy="50" r="50" fill="#F7E9C6" />
      <g clipPath={`url(#${clip})`}>
        <path d="M10 108 C14 80 32 70 50 70 C68 70 86 80 90 108 Z" fill="#0A3A2A" />
        <path d="M41 71 L50 88 L59 71 Z" fill="#fff" />
        <rect x="44" y="56" width="12" height="16" rx="4" fill="#B97A50" />
        <ellipse cx="33.5" cy="46" rx="3.5" ry="5" fill="#C98B5E" />
        <ellipse cx="66.5" cy="46" rx="3.5" ry="5" fill="#C98B5E" />
        <ellipse cx="50" cy="44" rx="17" ry="20" fill="#C98B5E" />
        <path d="M33 43 C30 24 43 17 52 18 C64 18 71 27 67 43 C64 33 58 29 50 30 C42 30 36 35 33 43 Z" fill="#231815" />
        <circle cx="43.5" cy="45" r="1.9" fill="#231815" />
        <circle cx="56.5" cy="45" r="1.9" fill="#231815" />
        <path d="M44.5 54 Q50 58.5 55.5 54" stroke="#7A3E22" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </g>
      <circle cx="50" cy="50" r="48.5" fill="none" stroke="#E4B659" strokeWidth="3" />
    </g>
  );
}

/** The poster, 300 × 180: the broker on the left, their QR on the right. */
function Poster({ qr, clip }) {
  return (
    <g>
      <rect x="0" y="4" width="300" height="180" rx="16" fill="#0B1F17" opacity=".16" />
      <rect width="300" height="180" rx="16" fill="#fff" />
      <rect width="300" height="8" rx="4" fill="#15803D" />
      <g transform="translate(34 20) scale(.72)"><AgentFace clip={clip} /></g>
      <text x="70" y="118" textAnchor="middle" fontSize="19" fontWeight="800" fill="#111827">{AGENT.name}</text>
      <text x="70" y="143" textAnchor="middle" fontSize="16" fontWeight="800" fill="#111827">
        <tspan fill="#E4A21C">★</tspan> {AGENT.rating}<tspan fontSize="12.5" fontWeight="600" fill="#6B7280"> ({AGENT.reviews})</tspan>
      </text>
      <text x="70" y="164" textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#15803D">✓ MovEazy partner</text>
      <line x1="150" y1="22" x2="150" y2="160" stroke="#E5E7EB" strokeWidth="1.5" strokeDasharray="4 4" />
      <QrMark qr={qr} x={164} y={18} size={122} />
      <text x="225" y="164" textAnchor="middle" fontSize="12" fontWeight="800" fill="#111827">Scan for my homes</text>
    </g>
  );
}

function Scene() {
  const qr = useQrModules(QR_TARGET);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids = { screen: `qs${uid}`, brick: `qb${uid}`, beam: `qg${uid}`, f1: `qf1${uid}`, f2: `qf2${uid}` };
  const rows = [
    ["Anjali S.", "♥ Liked 2 BHK · HSR", "#E11D48", "#FDE7EC:#9F1239"],
    ["Rohit V.", "Viewed 5 homes", "#6B7280", "#E0F2FE:#075985"],
    ["Meera N.", "♥ Liked 1 BHK · BTM", "#E11D48", "#EDE9FE:#5B21B6"],
  ];

  return (
    <svg className="qr-svg" viewBox="0 0 640 480" role="img" style={{ fontFamily: FONT }}
      aria-label="A broker's QR poster lifts out of the MovEazy app and is pasted on a wall. A tenant scans it, sees the broker's homes and likes one; the broker's phone shows who viewed and who liked what.">
      <defs>
        <linearGradient id={ids.brick + "w"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F4ECDD" /><stop offset="1" stopColor="#E7DAC2" />
        </linearGradient>
        <pattern id={ids.brick} width="64" height="32" patternUnits="userSpaceOnUse">
          <path d="M0 .5H64M0 16.5H64M.5 0V16M32.5 16V32" stroke="#000" strokeOpacity=".05" fill="none" />
        </pattern>
        <linearGradient id={ids.beam} x1="1" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#5EEAD4" stopOpacity=".95" /><stop offset="1" stopColor="#5EEAD4" stopOpacity=".12" />
        </linearGradient>
        <clipPath id={ids.screen}><rect x="34" y="50" width="180" height="380" rx="26" /></clipPath>
      </defs>

      {/* The street: a wall, a sign, the pavement. */}
      <rect width="640" height="480" fill={`url(#${ids.brick}w)`} />
      <rect width="640" height="404" fill={`url(#${ids.brick})`} />
      <rect y="404" width="640" height="76" fill="#D6C7AB" />
      <rect y="400" width="640" height="6" fill="#C9B894" />
      <g>
        <rect x="496" y="14" width="126" height="32" rx="6" fill="#1D4E89" />
        <rect x="499" y="17" width="120" height="26" rx="4" fill="none" stroke="#fff" strokeOpacity=".7" />
        <text x="559" y="35" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" letterSpacing=".06em">HSR LAYOUT</text>
      </g>

      {/* The broker's phone. */}
      <ellipse cx="124" cy="458" rx="84" ry="9" fill="#000" opacity=".12" />
      <rect x="24" y="40" width="200" height="400" rx="34" fill="#0C0F0E" />
      <rect x="34" y="50" width="180" height="380" rx="26" fill="#fff" />
      <g clipPath={`url(#${ids.screen})`}>
        <g className="qa">
          <text x="50" y="98" fontSize="20" fontWeight="800" fill="#111827">My QR</text>
          <g className="qthumb"><g transform="translate(40 112) scale(.56)"><Poster qr={qr} clip={ids.f1} /></g></g>
          <text x="124" y="240" textAnchor="middle" fontSize="13" fill="#6B7280">Paste it across your areas</text>
          <rect x="46" y="256" width="156" height="40" rx="12" fill="#15803D" />
          <text x="124" y="281" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff">Download poster</text>
          <rect x="46.5" y="304.5" width="155" height="39" rx="12" fill="#fff" stroke="#E5E7EB" />
          <text x="124" y="329" textAnchor="middle" fontSize="14" fontWeight="700" fill="#111827">Share on WhatsApp</text>
          <text x="124" y="384" textAnchor="middle" fontSize="14" fontWeight="800" fill="#15803D">38 scans this week</text>
        </g>
        <g className="qb">
          <text x="50" y="98" fontSize="20" fontWeight="800" fill="#111827">QR insights</text>
          <text className="qold" x="50" y="152" fontSize="44" fontWeight="800" fill="#111827" letterSpacing="-1.5">142</text>
          <text className="qnew" x="50" y="152" fontSize="44" fontWeight="800" fill="#111827" letterSpacing="-1.5">143</text>
          <text x="50" y="174" fontSize="13" fill="#6B7280">viewed your homes</text>
          <text className="qnew" x="50" y="196" fontSize="13" fontWeight="800" fill="#15803D">+1 just now</text>
          <line x1="46" y1="210" x2="202" y2="210" stroke="#E5E7EB" />
          <rect className="qrow" x="38" y="216" width="172" height="52" rx="10" fill="#FDE7EC" />
          {rows.map(([n, what, c, tone], i) => {
            const y = 218 + i * 56;
            const [bg, fg] = tone.split(":");
            return (
              <g key={n}>
                <circle cx="62" cy={y + 24} r="15" fill={bg} />
                <text x="62" y={y + 28.5} textAnchor="middle" fontSize="12" fontWeight="800" fill={fg}>{n.split(" ").map((w) => w[0]).join("")}</text>
                <text x="84" y={y + 19} fontSize="14" fontWeight="800" fill="#111827">{n}</text>
                <text x="84" y={y + 37} fontSize="11.5" fontWeight="600" fill={c}>{what}</text>
              </g>
            );
          })}
        </g>
        <g className="qt">
          <rect x="42" y="72" width="164" height="46" rx="12" fill="#0B1F17" />
          <text x="58" y="100" textAnchor="middle" fontSize="15" fill="#FB7185">♥</text>
          <text x="72" y="91" fontSize="12.5" fontWeight="800" fill="#fff">Anjali liked</text>
          <text x="72" y="108" fontSize="11.5" fill="#fff" fillOpacity=".75">2 BHK · HSR Layout</text>
        </g>
      </g>
      <rect x="104" y="58" width="40" height="10" rx="5" fill="#0C0F0E" />

      {/* The poster, out of the phone and onto the wall. */}
      <g className="qf"><Poster qr={qr} clip={ids.f2} /></g>
      <g className="qtape"><rect x="252" y="52" width="46" height="15" rx="2" fill="#FFF3C4" fillOpacity=".9" transform="rotate(-18 275 60)" /></g>
      <g className="qtape"><rect x="526" y="52" width="46" height="15" rx="2" fill="#FFF3C4" fillOpacity=".9" transform="rotate(18 549 60)" /></g>

      {/* The scan. */}
      <polygon className="qbeam" points="552,252 426,200 550,80" fill={`url(#${ids.beam})`} />
      <g className="qbeam" fill="none" stroke="#14B8A6" strokeWidth="4" strokeLinecap="round">
        <path d="M424 98V76H446M530 76H552V98M552 184V206H530M446 206H424V184" />
      </g>

      {/* What the tenant got. */}
      <g className="qc1">
        <rect x="262" y="262" width="236" height="40" rx="20" fill="#fff" />
        <circle cx="284" cy="282" r="13" fill="#E8F5EC" />
        <path d="M278 283.5 L284 277.5 L290 283.5 M280 282 V288 H288 V282" stroke="#15803D" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <text x="306" y="288" fontSize="16" fontWeight="800" fill="#111827">{AGENT.homes} homes by Ravi</text>
        <path d="M482 276 L488 282 L482 288" stroke="#9CA3AF" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      </g>
      <g className="qc2">
        <rect x="262" y="312" width="236" height="40" rx="20" fill="#fff" />
        <circle cx="284" cy="332" r="13" fill="#FDE7EC" />
        <text x="284" y="338" textAnchor="middle" fontSize="15" fill="#E11D48">♥</text>
        <text x="306" y="338" fontSize="16" fontWeight="800" fill="#111827">Liked 2 BHK · HSR</text>
      </g>

      {/* The tenant. */}
      <g className="qw">
        <g className="qlb"><rect x="592" y="370" width="14" height="80" rx="7" fill="#1F2A44" /><ellipse cx="594" cy="451" rx="12" ry="5" fill="#111" /></g>
        <g className="qlf"><rect x="606" y="370" width="14" height="80" rx="7" fill="#2B3B66" /><ellipse cx="608" cy="451" rx="12" ry="5" fill="#111" /></g>
        <rect x="620" y="296" width="18" height="58" rx="7" fill="#0A3A2A" />
        <rect x="582" y="288" width="46" height="94" rx="18" fill="#0E9F8E" />
        <rect x="598" y="276" width="12" height="16" rx="4" fill="#D69A70" />
        <circle cx="604" cy="262" r="20" fill="#E0A47A" />
        <circle cx="584.5" cy="265" r="3.2" fill="#E0A47A" />
        <path d="M586 257 C584 240 600 234 612 238 C625 242 627 260 621 272 L617 263 C611 252 598 250 586 257 Z" fill="#2B1B14" />
        <circle cx="592" cy="259" r="1.7" fill="#2B1B14" />
        <g className="qarm">
          <path d="M592 302 L557 271" stroke="#0E9F8E" strokeWidth="12" strokeLinecap="round" />
          <circle cx="554" cy="268" r="6.5" fill="#E0A47A" />
          <rect x="545" y="246" width="13" height="23" rx="3" fill="#111" transform="rotate(-16 551 257)" />
        </g>
      </g>
    </svg>
  );
}

function StorefrontScreen({ listings }) {
  const faceId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const areas = [...new Set(listings.map((l) => l.area).filter(Boolean))].slice(0, 3).join(", ") || "HSR, Koramangala, Bellandur";
  return (
    <div style={{ background: "#F6F7F6", minHeight: "100%" }}>
      <div style={{ padding: "46px 16px 18px", background: "radial-gradient(120% 100% at 0% 0%, #145C43, #0A3A2A 60%, #05241A)", color: "#fff" }}>
        <img src={logoOnDark} alt="" height="22" style={{ height: 22, width: "auto", display: "block", opacity: 0.95 }} />
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 16 }}>
          <svg width="66" height="66" viewBox="0 0 100 100" style={{ flex: "none" }} aria-hidden><AgentFace clip={faceId} /></svg>
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: 21, letterSpacing: "-0.01em" }}>{AGENT.name}</strong>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 14, fontWeight: 700 }}>
              <Star size={15} fill="#E4B659" color="#E4B659" /> {AGENT.rating}
              <span style={{ fontWeight: 500, opacity: 0.7 }}>· {AGENT.reviews} reviews</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 12, fontWeight: 700, color: "#1F1605", background: "#E4B659", borderRadius: 99, padding: "3px 9px" }}>
              <BadgeCheck size={13} /> Verified MovEazy partner
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, fontSize: 13.5, opacity: 0.85 }}>
          <MapPin size={14} /> {AGENT.homes} homes · {areas}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
          <span className="pz-btn" style={{ background: "#22C55E", borderColor: "#22C55E", color: "#fff", fontWeight: 700 }}><WhatsAppIcon /> WhatsApp</span>
          <span className="pz-btn" style={{ background: "rgba(255,255,255,.1)", borderColor: "rgba(255,255,255,.3)", color: "#fff", fontWeight: 700 }}><Phone size={16} /> Call</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "12px 16px 4px" }}>
        {[`All ${AGENT.homes}`, "1 BHK", "2 BHK", "3 BHK"].map((t, i) => <span key={t} className={`pz-chip${i === 0 ? " pz-chip--on" : ""}`}>{t}</span>)}
      </div>
      <div style={{ padding: "8px 16px", display: "grid", gap: 12 }}>
        {listings.slice(0, 3).map((l, i) => (
          <div key={l.property_id} className="pz-card" style={{ overflow: "hidden" }}>
            <div className="pz-prop-img" style={{ height: 186, overflow: "hidden" }}>
              <SmartListingImage listing={l} />
              <span style={{ position: "absolute", top: 10, right: 10, width: 36, height: 36, borderRadius: 99, background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}>
                <Heart size={18} color={i === 0 ? "#E11D48" : "#111827"} fill={i === 0 ? "#E11D48" : "none"} />
              </span>
            </div>
            <div style={{ padding: "10px 12px 12px" }}>
              <div className="pz-rent">{inr(l.rent)} <small>/ month</small></div>
              <div style={{ fontWeight: 600, fontSize: 14.5 }}>{l.flat_type} · {l.area}</div>
              {l.furnishing && <div className="pz-meta">{l.furnishing}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightsScreen({ listings }) {
  const bars = [9, 14, 11, 20, 26, 31, 38];
  const likes = [["Anjali Sharma", "2m"], ["Meera Nair", "1h"], ["Karan Patel", "3h"], ["Divya Rao", "Yesterday"]];
  return (
    <>
      <div style={{ height: 34, background: "#fff" }} />
      <TopBar title="QR insights" back />
      <div style={{ padding: "12px 16px", display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {[["143", "Views"], ["38", "Likes"], ["12", "Enquiries"]].map(([v, l]) => (
            <div key={l} className="pz-card" style={{ padding: "12px 10px" }}>
              <strong style={{ display: "block", fontSize: 24, letterSpacing: "-0.02em" }}>{v}</strong>
              <span className="pz-meta">{l}</span>
            </div>
          ))}
        </div>
        <div className="pz-card" style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <strong style={{ fontSize: 15 }}>Scans this week</strong>
            <span style={{ color: "#15803D", fontWeight: 700, fontSize: 13 }}>▲ 42%</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 86, marginTop: 12 }}>
            {bars.map((b, i) => (
              <div key={i} style={{ flex: 1, height: `${(b / 38) * 100}%`, borderRadius: 6, background: i === bars.length - 1 ? "#15803D" : "#D1ECD9" }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="pz-meta" style={{ flex: 1, textAlign: "center", fontSize: 11.5 }}>{d}</span>)}
          </div>
        </div>
        <div className="pz-card">
          <strong style={{ display: "block", fontSize: 15, padding: "14px 14px 4px" }}>Who liked what</strong>
          {likes.map(([name, when], i) => {
            const l = listings[i % Math.max(listings.length, 1)];
            return (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: i ? "1px solid #E5E7EB" : 0 }}>
                <Avatar name={name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 14.5 }}>{name}</strong>
                  <span style={{ fontSize: 12.5, color: "#E11D48", fontWeight: 600 }}>♥ {l ? `${l.flat_type} · ${l.area}` : "2 BHK · HSR Layout"}</span>
                  <span className="pz-meta" style={{ marginLeft: 6 }}>{when}</span>
                </div>
                <div className="pz-prop-img" style={{ width: 58, height: 44, borderRadius: 8, overflow: "hidden", flex: "none", aspectRatio: "auto" }}>
                  {l && <SmartListingImage listing={l} />}
                </div>
              </div>
            );
          })}
        </div>
        <div className="pz-card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <span className="pz-avatar" style={{ background: "#FFF3D6", color: "#8A6419" }}><MapPin size={17} /></span>
          <span style={{ flex: 1 }}>
            <strong style={{ display: "block", fontSize: 14.5 }}>Top poster: 27th Main, HSR</strong>
            <span className="pz-meta">61 scans · 19 likes</span>
          </span>
        </div>
      </div>
    </>
  );
}

export default function QrFeature({ listings }) {
  const ref = useRef(null);
  const pinRef = useRef(null);
  const trackRef = useRef(null);
  const [on, setOn] = useState(false);
  useScrollSlide(pinRef, trackRef);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setOn(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const steps = [
    ["Paste your QR", "Across your areas"],
    ["Tenants scan", "All your homes open"],
    ["See who liked what", "Views, likes, enquiries"],
  ];

  return (
    <section className="lp-sec lp-sec--dark qr" id="qr">
      <style>{CSS}</style>
      <div className="lp-wrap lp-center">
        <p className="lp-kicker"><span className="qr-soon">New · Free with every account</span></p>
        <h2 className="lp-h2">Your QR. <span className="hl">Your storefront.</span></h2>
        <p className="lp-sub">Paste it across your areas. Tenants scan and see all your homes. You see who liked what.</p>

        <div className={`qr-stage${on ? " is-on" : ""}`} ref={ref}>
          <Scene />
          <ol className="qr-steps">
            {steps.map(([t, s], i) => (
              <li key={t} className={`qr-step qr-step--${i + 1}`}><i><b /></i><strong>{t}</strong><span>{s}</span></li>
            ))}
          </ol>
        </div>

        <div className="qr-pin lp-pin" ref={pinRef}>
          <div className="lp-pin-in">
            <div className="qr-shots" ref={trackRef}>
              <Shot title="What tenants see" sub="All your homes, one scan"><StorefrontScreen listings={listings} /></Shot>
              <Shot title="What you see" sub="Views, likes and who liked what"><InsightsScreen listings={listings} /></Shot>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Every element's resting style is the story's last frame; the loop lives in
// the motion query, keyed to one 12-second clock.
const CSS = `
.qr-soon { display: inline-block; padding: 5px 12px; border-radius: 999px; background: rgba(228,182,89,.16); color: var(--gold); }
.qr-stage { max-width: 880px; margin: 30px auto 0; }
.qr-svg { width: 100%; height: auto; display: block; border-radius: 26px; box-shadow: 0 30px 70px rgba(0,0,0,.35); }
.qr-svg .qa, .qr-svg .qbeam { opacity: 0; }
.qr-svg .qf { transform-box: view-box; transform-origin: 0 0; transform: translate(262px, 62px) scale(1) rotate(0deg); }
.qr-svg .qthumb { opacity: .18; }
.qr-svg .qold, .qr-svg .qrow { opacity: 0; }
.qr-svg .qtape, .qr-svg .qc1, .qr-svg .qc2 { transform-box: fill-box; transform-origin: center; }
.qr-svg .qlb { transform-box: view-box; transform-origin: 599px 374px; }
.qr-svg .qlf { transform-box: view-box; transform-origin: 613px 374px; }
.qr-svg .qarm { transform-box: view-box; transform-origin: 592px 302px; }
.qr-steps { list-style: none; margin: 18px 0 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; text-align: left; }
.qr-step i { display: block; height: 4px; border-radius: 4px; background: rgba(255,255,255,.14); overflow: hidden; margin-bottom: 12px; }
.qr-step i b { display: block; height: 100%; background: var(--gold); transform-origin: 0 50%; }
.qr-step strong { display: block; font-size: 16px; letter-spacing: -0.01em; }
.qr-step span { display: block; font-size: 13.5px; color: rgba(255,255,255,.65); margin-top: 2px; }
.qr-shots { display: flex; justify-content: center; flex-wrap: wrap; gap: 28px 48px; margin-top: 54px; }
.qr-shots .lp-shot { flex: none; width: 250px; }
@media (max-width: 520px) {
  .qr-steps { gap: 10px; }
  .qr-step strong { font-size: 13.5px; }
  .qr-step span { display: none; }
  .qr-pin { margin-top: 40px; }
  .qr-shots { flex-wrap: nowrap; justify-content: flex-start; gap: 16px; margin: 0 -20px; padding: 4px 20px 16px; }
}
@media (prefers-reduced-motion: no-preference) {
  .qr-stage.is-on .qr-svg * { animation-duration: 12s; animation-iteration-count: infinite; animation-timing-function: ease-in-out; }
  .qr-stage.is-on .qf { animation-name: qrFly; }
  .qr-stage.is-on .qthumb { animation-name: qrThumb; }
  .qr-stage.is-on .qa { animation-name: qrA; }
  .qr-stage.is-on .qb { animation-name: qrB; }
  .qr-stage.is-on .qtape { animation-name: qrTape; }
  .qr-stage.is-on .qw { animation-name: qrWalk; }
  .qr-stage.is-on .qlb { animation-name: qrLegB; }
  .qr-stage.is-on .qlf { animation-name: qrLegF; }
  .qr-stage.is-on .qarm { animation-name: qrArm; }
  .qr-stage.is-on .qbeam { animation-name: qrBeam; }
  .qr-stage.is-on .qc1 { animation-name: qrC1; }
  .qr-stage.is-on .qc2 { animation-name: qrC2; }
  .qr-stage.is-on .qt { animation-name: qrToast; }
  .qr-stage.is-on .qold { animation-name: qrOld; }
  .qr-stage.is-on .qnew { animation-name: qrNew; }
  .qr-stage.is-on .qrow { animation-name: qrRow; }
  .qr-stage.is-on .qr-step i b { animation: 12s linear infinite; }
  .qr-stage.is-on .qr-step--1 i b { animation-name: qrP1; }
  .qr-stage.is-on .qr-step--2 i b { animation-name: qrP2; }
  .qr-stage.is-on .qr-step--3 i b { animation-name: qrP3; }
  .qr-stage.is-on .qr-step--1 { animation: qrS1 12s infinite; }
  .qr-stage.is-on .qr-step--2 { animation: qrS2 12s infinite; }
  .qr-stage.is-on .qr-step--3 { animation: qrS3 12s infinite; }
}
@keyframes qrFly {
  0%, 10% { transform: translate(40px, 112px) scale(.56) rotate(0deg); opacity: 0; }
  10.5% { opacity: 1; }
  19% { transform: translate(112px, 96px) scale(1.32) rotate(-4deg); }
  28% { transform: translate(262px, 62px) scale(1.03) rotate(0deg); }
  30%, 93% { transform: translate(262px, 62px) scale(1) rotate(0deg); opacity: 1; }
  98%, 100% { transform: translate(262px, 62px) scale(1) rotate(0deg); opacity: 0; }
}
@keyframes qrThumb { 0%, 10% { opacity: 1; } 12%, 96% { opacity: .18; } 100% { opacity: 1; } }
@keyframes qrA { 0%, 66% { opacity: 1; } 69%, 96% { opacity: 0; } 100% { opacity: 1; } }
@keyframes qrB { 0%, 66% { opacity: 0; } 69%, 94% { opacity: 1; } 97%, 100% { opacity: 0; } }
@keyframes qrTape { 0%, 27% { opacity: 0; transform: scale(1.5); } 30%, 93% { opacity: 1; transform: scale(1); } 98%, 100% { opacity: 0; transform: scale(1); } }
@keyframes qrWalk {
  0%, 29% { transform: translate(140px, 0); opacity: 0; }
  30% { opacity: 1; }
  33% { transform: translate(105px, -3px); }
  36% { transform: translate(70px, 0); }
  39% { transform: translate(35px, -3px); }
  42%, 93% { transform: translate(0, 0); opacity: 1; }
  98%, 100% { transform: translate(0, 0); opacity: 0; }
}
@keyframes qrLegB { 0%, 30% { transform: rotate(0deg); } 32% { transform: rotate(14deg); } 35% { transform: rotate(-14deg); } 38% { transform: rotate(14deg); } 41% { transform: rotate(-10deg); } 42.5%, 100% { transform: rotate(0deg); } }
@keyframes qrLegF { 0%, 30% { transform: rotate(0deg); } 32% { transform: rotate(-14deg); } 35% { transform: rotate(14deg); } 38% { transform: rotate(-14deg); } 41% { transform: rotate(10deg); } 42.5%, 100% { transform: rotate(0deg); } }
@keyframes qrArm { 0%, 42% { transform: rotate(-130deg); } 46.5%, 100% { transform: rotate(0deg); } }
@keyframes qrBeam { 0%, 46.5% { opacity: 0; } 48% { opacity: .95; } 50% { opacity: .35; } 52% { opacity: .95; } 54% { opacity: .35; } 56%, 100% { opacity: 0; } }
@keyframes qrC1 { 0%, 55% { opacity: 0; transform: translateY(10px) scale(.9); } 58%, 93% { opacity: 1; transform: translateY(0) scale(1); } 98%, 100% { opacity: 0; transform: translateY(0) scale(1); } }
@keyframes qrC2 { 0%, 61% { opacity: 0; transform: translateY(10px) scale(.9); } 64%, 93% { opacity: 1; transform: translateY(0) scale(1); } 98%, 100% { opacity: 0; transform: translateY(0) scale(1); } }
@keyframes qrToast { 0%, 71% { transform: translateY(-80px); } 74%, 94% { transform: translateY(0); } 97%, 100% { transform: translateY(-80px); } }
@keyframes qrOld { 0%, 75% { opacity: 1; } 77%, 100% { opacity: 0; } }
@keyframes qrNew { 0%, 75% { opacity: 0; } 77%, 100% { opacity: 1; } }
@keyframes qrRow { 0%, 74% { opacity: 0; } 77% { opacity: 1; } 92%, 100% { opacity: 0; } }
@keyframes qrP1 { 0% { transform: scaleX(0); } 40%, 97% { transform: scaleX(1); } 100% { transform: scaleX(0); } }
@keyframes qrP2 { 0%, 40% { transform: scaleX(0); } 66%, 97% { transform: scaleX(1); } 100% { transform: scaleX(0); } }
@keyframes qrP3 { 0%, 66% { transform: scaleX(0); } 97% { transform: scaleX(1); } 100% { transform: scaleX(0); } }
@keyframes qrS1 { 0%, 40% { opacity: 1; } 43%, 97% { opacity: .5; } 100% { opacity: 1; } }
@keyframes qrS2 { 0%, 40% { opacity: .5; } 43%, 66% { opacity: 1; } 69%, 100% { opacity: .5; } }
@keyframes qrS3 { 0%, 66% { opacity: .5; } 69%, 97% { opacity: 1; } 100% { opacity: .5; } }
`;
