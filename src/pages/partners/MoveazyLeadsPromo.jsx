/**
 * MovEazy leads, made hard to miss: the black, logo-led tab in Leads (NEW until
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

const CSS = `
.mzl-tab { position: relative; flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 9px 6px;
  border: 0; border-radius: 9px; font: inherit; font-weight: 700; font-size: 14px; cursor: pointer; background: #0B0B0F; color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,.22); transition: box-shadow .2s; }
.mzl-tab[aria-selected="true"] { box-shadow: 0 0 0 2px var(--gold), 0 4px 14px rgba(212,164,55,.35); }
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

  const badge = moveazyTabBadge(seen || selected, assignedProp ?? assigned);
  return (
    <>
      <style>{CSS}</style>
      <button type="button" role="tab" aria-selected={selected} className="mzl-tab" onClick={onSelect}
        aria-label={`MovEazy leads${badge === "NEW" ? ", new" : badge ? `, ${badge} not contacted yet` : ""}`}>
        <img src={logo} alt="" height="15" style={{ height: 15 }} />
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
