/**
 * moveazy.co.in/find/societies — gated societies across Bangalore: the ones
 * MovEazy partners onboarded (checked in person: photos taken there — "Verified
 * by MovEazy partner"), and the ones our research covers (amenities, typical
 * rents, what's nearby) until a partner does. Filter by amenities and budget;
 * nearest first once the tenant shares where they are.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BadgeCheck, LocateFixed, MapPin } from "lucide-react";
import { FindShell, useFindGate } from "./findKit";
import { fetchLiveSocieties, distanceLabel, currentSpot } from "../../lib/societyPartners";
import { rentRange } from "../../lib/societyProspects";
import { AMENITY_FILTERS, BHK_FILTERS, BUDGETS, budgetLabel, filterSocieties } from "../../lib/societyFilters";
import { coverFor } from "../../lib/amenityPhotos";

/** "2 BHK ₹38k–45k", the most common type first. */
export function rentLine(rents) {
  for (const k of ["2", "3", "1", "1rk", "4"]) {
    const r = rentRange(rents?.[k]);
    if (r) return `${k === "1rk" ? "1 RK" : `${k} BHK`} ${r}`;
  }
  return "";
}

export default function FindSocieties() {
  const navigate = useNavigate();
  const { allowed, gate } = useFindGate();
  const [rows, setRows] = useState(null);
  const [locating, setLocating] = useState(false);
  const [amen, setAmen] = useState([]);
  const [bhk, setBhk] = useState("");
  const [budget, setBudget] = useState(0);
  const { ok, unknown } = useMemo(() => filterSocieties(rows ?? [], { amenities: amen, budget, bhk }), [rows, amen, budget, bhk]);
  const filtering = amen.length > 0 || budget > 0;
  const toggleAmen = (id) => setAmen((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  useEffect(() => { fetchLiveSocieties().then(setRows, () => setRows([])); }, []);
  const nearMe = async () => {
    setLocating(true);
    try { const s = await currentSpot(); setRows(await fetchLiveSocieties(s.lat, s.lng)); } catch { /* keep the list as it is */ } finally { setLocating(false); }
  };

  const card = (s) => (
    <article key={s.code} className="fd-deal">
      <button type="button" className="fd-deal-photo" onClick={() => navigate(`/find/societies/${s.code}`)} aria-label={`Open ${s.name}`}>
        {s.cover ? <img src={s.cover} alt="" loading="lazy" /> : <img src={coverFor(s.code).url} alt="" loading="lazy" />}
        {!s.cover && <span className="fd-deal-badge" style={{ left: "auto", right: 10, background: "rgba(0,0,0,.55)", color: "#fff" }}>Representative image</span>}
        {s.verified && <span className="fd-deal-badge" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><BadgeCheck size={14} /> Verified by MovEazy partner</span>}
        {!s.verified && s.photos > 1 && <span className="fd-deal-badge">{s.photos} photos</span>}
      </button>
      <div className="fd-deal-body">
        <span className="fd-deal-type">Gated society{s.facts?.builder ? ` · ${s.facts.builder}` : ""}</span>
        <button type="button" className="fd-deal-title" onClick={() => navigate(`/find/societies/${s.code}`)}>{s.name}</button>
        <p className="fd-deal-where"><MapPin size={14} /> {[s.area, distanceLabel(s.metres) && `${distanceLabel(s.metres)} away`].filter(Boolean).join(" · ") || "Bengaluru"}</p>
        {rentLine(s.rents) && <p className="fd-deal-rent" style={{ fontSize: 18 }}>{rentLine(s.rents)}</p>}
        {(s.amenities ?? []).length > 0 && (
          <p className="fd-deal-why">{s.amenities.slice(0, 4).join(" · ")}{s.amenity_count > 4 ? ` +${s.amenity_count - 4}` : ""}</p>
        )}
        <div className="fd-deal-acts">
          <button type="button" className="fd-btn fd-btn--go" onClick={() => navigate(`/find/societies/${s.code}`)}>See the society <ArrowRight size={16} /></button>
        </div>
      </div>
    </article>
  );

  return (
    <FindShell kicker="Gated societies" title="Societies" sub="Gated societies across Bangalore — amenities, typical rents and what's nearby. Filter by what you need and your budget."
      aside={<button type="button" className="fd-timer" style={{ cursor: "pointer", border: 0 }} onClick={nearMe} disabled={locating}>
        <LocateFixed size={17} /> {locating ? "Finding you…" : "Nearest to me"}</button>}>
      {gate}
      {allowed && rows !== null && rows.length > 0 && (
        <section className="fs-filters" aria-label="Filters">
          <div className="fs-row">
            <span className="fs-label">Amenities</span>
            <div className="fd-chips" style={{ margin: 0 }}>
              {AMENITY_FILTERS.map((f) => (
                <button key={f.id} type="button" className={`fd-chip${amen.includes(f.id) ? " is-on" : ""}`} aria-pressed={amen.includes(f.id)} onClick={() => toggleAmen(f.id)}>{f.label}</button>
              ))}
            </div>
          </div>
          <div className="fs-row">
            <span className="fs-label">Budget</span>
            <div className="fd-chips" style={{ margin: 0 }}>
              {BHK_FILTERS.map((b) => (
                <button key={b.id} type="button" className={`fd-chip${bhk === b.id ? " is-on" : ""}`} aria-pressed={bhk === b.id} onClick={() => setBhk(bhk === b.id ? "" : b.id)}>{b.label}</button>
              ))}
              <select className="fs-select" value={budget} onChange={(e) => setBudget(Number(e.target.value))} aria-label="Monthly budget">
                <option value={0}>Any budget</option>
                {BUDGETS.map((v) => <option key={v} value={v}>Up to {budgetLabel(v)} / month</option>)}
              </select>
              {filtering && <button type="button" className="fd-chip" onClick={() => { setAmen([]); setBudget(0); setBhk(""); }}>Clear</button>}
            </div>
          </div>
          <p className="fs-note">Societies without the “Verified by MovEazy partner” badge show details from public sources — rents are approximate and may vary.</p>
        </section>
      )}
      {allowed && (rows === null ? <div className="fd-empty">Loading societies…</div> : rows.length === 0 ? (
        <div className="fd-empty"><b>Societies are being added</b>Check back soon.</div>
      ) : ok.length + unknown.length === 0 ? (
        <div className="fd-empty"><b>No society matches all of that</b>Try fewer amenities or a higher budget.</div>
      ) : (
        <>
          <p className="fs-count">{ok.length} societ{ok.length === 1 ? "y" : "ies"}{filtering ? " match" : ""}</p>
          <div className="fd-grid">{ok.map(card)}</div>
          {unknown.length > 0 && (
            <>
              <h2 className="fs-sub">Rent not known yet · {unknown.length}</h2>
              <div className="fd-grid">{unknown.map(card)}</div>
            </>
          )}
        </>
      ))}
      <style>{FS_CSS}</style>
    </FindShell>
  );
}

const FS_CSS = `
.fs-filters { display: grid; gap: 12px; margin: 0 0 18px; padding: 14px; border: 1px solid var(--line, #E4E1D8); border-radius: 18px; background: #fff; }
.fs-row { display: grid; gap: 8px; }
.fs-label { font-size: 12.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #5C6B67; }
.fs-select { border: 1.5px solid var(--line, #E4E1D8); border-radius: 999px; padding: 8px 14px; font: inherit; font-weight: 700; font-size: 14px; background: #fff; max-width: 100%; }
.fs-note { margin: 0; font-size: 12.5px; color: #5C6B67; }
.fs-count { margin: 0 0 10px; font-weight: 700; color: #5C6B67; }
.fs-sub { margin: 26px 0 12px; font-size: 18px; }
`;
