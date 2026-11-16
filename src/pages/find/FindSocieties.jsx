/**
 * moveazy.co.in/find/societies — the gated societies MovEazy partners have
 * onboarded and our team checked: photos taken there, amenities, typical
 * rents. Nearest first once the tenant shares where they are.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, LocateFixed, MapPin } from "lucide-react";
import { FindShell, useFindGate } from "./findKit";
import { fetchLiveSocieties, distanceLabel, currentSpot } from "../../lib/societyPartners";
import { rentRange } from "../../lib/societyProspects";

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
  useEffect(() => { fetchLiveSocieties().then(setRows, () => setRows([])); }, []);
  const nearMe = async () => {
    setLocating(true);
    try { const s = await currentSpot(); setRows(await fetchLiveSocieties(s.lat, s.lng)); } catch { /* keep the list as it is */ } finally { setLocating(false); }
  };

  return (
    <FindShell kicker="Gated societies" title="Societies" sub="Checked in person by a MovEazy partner — real photos of the amenities and a sample flat, and typical rents."
      aside={<button type="button" className="fd-timer" style={{ cursor: "pointer", border: 0 }} onClick={nearMe} disabled={locating}>
        <LocateFixed size={17} /> {locating ? "Finding you…" : "Nearest to me"}</button>}>
      {gate}
      {allowed && (rows === null ? <div className="fd-empty">Loading societies…</div> : rows.length === 0 ? (
        <div className="fd-empty"><b>Societies are being added</b>Our partners are visiting gated societies around HSR and Sarjapur Road right now. Check back soon.</div>
      ) : (
        <div className="fd-grid">
          {rows.map((s) => (
            <article key={s.code} className="fd-deal">
              <button type="button" className="fd-deal-photo" onClick={() => navigate(`/find/societies/${s.code}`)} aria-label={`Open ${s.name}`}>
                {s.cover ? <img src={s.cover} alt="" loading="lazy" /> : <span className="fd-deal-nophoto">{s.name}</span>}
                {s.photos > 1 && <span className="fd-deal-badge">{s.photos} photos</span>}
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
          ))}
        </div>
      ))}
    </FindShell>
  );
}
