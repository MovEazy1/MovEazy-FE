/**
 * MovEazy leads, made hard to miss: the logo-led tab in Leads — black halftone
 * dots when closed, red (like whichever tab is open) when open — NEW until
 * it's first opened, then a count of leads not yet contacted) and the Home card
 * that shows until a broker first asks for leads. Kept small — Home and Leads
 * load it up front, MoveazyLeads.jsx itself stays lazy.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import logo from "../../assets/logo/moveazy-logo-mint-dark.png";
import { fetchLeadStats, fetchMyAssignedLeads, fetchMyLeadRequests, hasAskedForLeads, moveazyTabBadge, topSets } from "../../lib/partnerLeads";
import { pp } from "../../lib/partners";

// Remembered on this device, per partner.
const flag = (k) => { try { return localStorage.getItem(k) === "1"; } catch { return false; } };
const setFlag = (k) => { try { localStorage.setItem(k, "1"); } catch { /* fine without */ } };

const OPEN_RED = "#C62828";

/** Black halftone: big dots that all but touch on the left, thinning out to the right. */
export function halftoneSvg(w = 240, h = 40, step = 6) {
  let dots = "";
  for (let row = 0, y = step / 2; y < h + step; row += 1, y += step * 0.866) {
    for (let x = (row % 2) * (step / 2); x < w; x += step) {
      const r = 3.7 * Math.max(0, 1 - x / (w * 0.85)) ** 1.15;
      if (r >= 0.4) dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${dots}</svg>`;
}
const HALFTONE = `url("data:image/svg+xml,${encodeURIComponent(halftoneSvg())}")`;

/** The logo in one solid colour (white on the red tab); the original until it's drawn. */
const tinted = new Map();
function useTintedLogo(src, color) {
  const key = `${src}|${color}`;
  const [url, setUrl] = useState(() => tinted.get(key) || "");
  useEffect(() => {
    if (tinted.has(key)) { setUrl(tinted.get(key)); return undefined; }
    let alive = true;
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const x = c.getContext("2d");
        x.fillStyle = color;
        x.fillRect(0, 0, c.width, c.height);
        x.globalCompositeOperation = "destination-in";
        x.drawImage(img, 0, 0);
        tinted.set(key, c.toDataURL("image/png"));
        if (alive) setUrl(tinted.get(key));
      } catch { /* keep the regular logo */ }
    };
    img.src = src;
    return () => { alive = false; };
  }, [key, src, color]);
  return url;
}

const CSS = `
.mzl-mine, .mzl-tab { flex: 1; padding: 9px 6px; border: 0; border-radius: 9px; font: inherit; font-weight: 700; font-size: 14px;
  cursor: pointer; transition: background-color .2s, color .2s, box-shadow .2s; }
.mzl-mine { background: transparent; color: var(--dim); }
.mzl-tab { position: relative; display: flex; align-items: center; justify-content: center; gap: 5px; color: #fff;
  background: ${HALFTONE} left center / auto 100% no-repeat, #26232E; box-shadow: 0 2px 8px rgba(0,0,0,.22); }
.mzl-mine[aria-selected="true"], .mzl-tab[aria-selected="true"] { background: ${OPEN_RED}; color: #fff;
  box-shadow: 0 0 0 2px var(--gold), 0 4px 14px rgba(198,40,40,.32); }
.mzl-tab[aria-selected="true"] .mzl-badge { background: #fff; color: ${OPEN_RED}; }
.mzl-tab img, .mzl-card img { display: block; width: auto; }
.mzl-badge { position: absolute; top: -9px; right: -5px; min-width: 20px; height: 19px; padding: 0 6px; border-radius: 99px;
  background: #EF4444; color: #fff; font-size: 10.5px; font-weight: 800; letter-spacing: .04em; line-height: 1;
  display: grid; place-items: center; border: 2px solid var(--card); }
.mzl-badge--new { animation: mzl-pop 2.6s ease-in-out infinite; }
@keyframes mzl-pop { 0%, 78%, 100% { transform: scale(1); } 86% { transform: scale(1.18); } }
.mzl-card { display: block; position: relative; overflow: hidden; padding: 16px; margin-bottom: 12px; text-decoration: none;
  color: #fff; background: radial-gradient(120% 90% at 100% 0%, rgba(212,164,55,.28), transparent 60%), #0B0B0F; border-color: #0B0B0F; }
.mzl-card-top { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 15px; }
.mzl-card-top .mzl-new { margin-left: auto; padding: 3px 8px; border-radius: 99px; background: #EF4444; font-size: 10.5px; font-weight: 800; letter-spacing: .04em; }
.mzl-card-n { display: block; margin-top: 12px; font-size: 26px; line-height: 1.1; font-weight: 800; }
.mzl-card-line { display: block; font-size: 14px; color: #D9D6E0; margin-top: 2px; }
.mzl-card-sub { display: block; font-size: 12.5px; color: #A7A3B3; margin-top: 8px; }
.mzl-card-cta { display: inline-flex; align-items: center; gap: 2px; margin-top: 12px; padding: 8px 14px; border-radius: 99px;
  background: var(--goldg); color: #1F1605; font-weight: 800; font-size: 14px; }
@media (prefers-reduced-motion: reduce) { .mzl-badge--new { animation: none; } }
`;

/** "My Leads" — red when open, like its neighbour. */
export function MyLeadsTab({ selected, onSelect }) {
  return (
    <button type="button" role="tab" aria-selected={selected} className="mzl-mine" onClick={onSelect}>My Leads</button>
  );
}

/** The "MovEazy leads" tab button for the Leads switch. */
export function MoveazyTab({ me, selected, onSelect, assigned: assignedProp }) {
  const id = me?.partner?.user_id ?? "";
  const seenKey = `pz-mzleads-seen:${id}`;
  const [seen, setSeen] = useState(() => flag(seenKey));
  const [assigned, setAssigned] = useState([]);

  // Opened once → NEW gives way to the count.
  useEffect(() => {
    if (selected && !seen) { setFlag(seenKey); setSeen(true); }
  }, [selected, seen, seenKey]);

  // The count, until the tab itself reports a fresher list.
  useEffect(() => {
    if (!id || assignedProp) return undefined;
    let alive = true;
    fetchMyAssignedLeads().then((r) => alive && setAssigned(r), () => {});
    return () => { alive = false; };
  }, [id, assignedProp]);

  const white = useTintedLogo(logo, "#FFFFFF");
  const badge = moveazyTabBadge(seen || selected, assignedProp ?? assigned);
  return (
    <>
      <style>{CSS}</style>
      <button type="button" role="tab" aria-selected={selected} className="mzl-tab" onClick={onSelect}
        aria-label={`MovEazy leads${badge === "NEW" ? ", new" : badge ? `, ${badge} not contacted yet` : ""}`}>
        <img src={selected && white ? white : logo} alt="" height="15" style={{ height: 15 }} />
        <span>leads</span>
        {badge && <span className={`mzl-badge${badge === "NEW" ? " mzl-badge--new" : ""}`} aria-hidden="true">{badge}</span>}
      </button>
    </>
  );
}

/** Home: how many MovEazy clients are looking — until the broker first asks for leads. */
export function MoveazyLeadsCard({ me }) {
  const id = me?.partner?.user_id ?? "";
  const askedKey = `pz-mzleads-asked:${id}`;
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!id || flag(askedKey)) return undefined;
    let alive = true;
    Promise.all([fetchLeadStats(), fetchMyLeadRequests()]).then(([s, reqs]) => {
      if (!alive) return;
      if (hasAskedForLeads(reqs)) { setFlag(askedKey); return; }
      if (s?.total > 0) setStats(s);
    }, () => { /* not a partner who can see these — no card */ });
    return () => { alive = false; };
  }, [id, askedKey]);

  if (!stats) return null;
  // The biggest specific set, the broker's own areas first.
  const top = topSets((stats.bhk_area ?? []).filter((p) => p.bhk !== "Any" && p.area !== "Anywhere"),
    me?.partner?.operational_areas ?? [], 1)[0];
  return (
    <Link to={pp("/leads?tab=moveazy")} className="pz-card mzl-card">
      <style>{CSS}</style>
      <span className="mzl-card-top">
        <img src={logo} alt="MovEazy" height="17" style={{ height: 17 }} /> leads
        <span className="mzl-new">NEW</span>
      </span>
      <strong className="mzl-card-n">{Number(stats.total).toLocaleString("en-IN")} clients</strong>
      <span className="mzl-card-line">
        are looking for a flat right now{top ? ` · ${top.n} want a ${top.bhk.replace("Room in Preoccupied flat", "room")} in ${top.area}` : ""}
      </span>
      <span className="mzl-card-sub">
        {stats.premium
          ? "Free for you as a Premium partner — you pay only a small share on closures."
          : "Your first 10 leads are free — names and numbers, the moment you ask."}
      </span>
      <span className="mzl-card-cta">Get leads <ChevronRight size={16} /></span>
    </Link>
  );
}
