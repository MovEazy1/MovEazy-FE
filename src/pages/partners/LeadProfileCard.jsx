/**
 * "What they told MovEazy" on a MovEazy lead's page: every answer the tenant
 * filled in on the website's requirement form, with the MovEazy team's CRM
 * corrections taking their place (partner_lead_profile, partner_lead_details.sql).
 * The move-in is an exact date: the day they filled the form plus what they
 * picked. Age and lead source are not shown to brokers.
 */
import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { budgetLabel, moveInFact } from "./leadBits";
import { fetchLeadProfile } from "../../lib/partnerTenants";

const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "");
const list = (a) => (Array.isArray(a) ? a.filter(Boolean).join(", ") : "");

export default function LeadProfileCard({ tenant }) {
  const [p, setP] = useState(undefined);
  useEffect(() => {
    if (!tenant.assignment_id) return undefined;
    let live = true;
    fetchLeadProfile(tenant.assignment_id).then((x) => live && setP(x ?? null), () => live && setP(null));
    return () => { live = false; };
  }, [tenant.assignment_id]);
  if (!tenant.assignment_id || p === undefined) return null;

  const mi = p ? moveInFact({ move_in: p.move_in, move_in_flexible: p.move_in_flexible, stage: tenant.stage }) : null;
  const budget = p ? [budgetLabel(p), p.stretch ? "can stretch ~15%" : ""].filter(Boolean).join(" · ") : "";
  const commute = p?.commute_minutes ? `${p.commute_minutes} min by bike${p.commute_flexible ? ", a little more is fine" : " at most"}` : "";
  const rows = p ? [
    ["Who's moving in", list(p.occupants)],
    ["Flat type", list(p.flat_types)],
    ["Areas", list(p.localities)],
    ["Budget", budget],
    ["Furnishing", p.furnishing],
    ["Move-in", mi ? mi.text.replace(/^Move-in /, "") : p.move_in_raw,
      p.move_in && p.move_in_raw ? `They picked “${p.move_in_raw}”${p.move_in_said_at ? ` on ${day(p.move_in_said_at)}` : ""}` : "", mi?.passed],
    ["Office", p.office],
    ["Time to office", commute],
    ["Must-haves", list(p.must_haves)],
    ["Deal breakers", list(p.deal_breakers)],
    ["Lifestyle", list(p.lifestyle)],
    ["Priorities", (p.priority ?? []).length ? (p.priority.map((x, i) => <span key={x} style={{ display: "block" }}>{i + 1}. {x}</span>)) : ""],
    ["About them", p.profile],
    ["Why they're moving", p.move_reason],
    ["Also", list(p.about)],
  ].filter(([, v]) => v) : [];

  return (
    <div className="pz-section">
      <h2 style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 8, fontSize: 16, margin: "0 0 6px", textAlign: "left" }}>
        <ClipboardList size={17} color="var(--g)" /> What they told MovEazy
      </h2>
      {rows.length === 0 ? (
        <p className="pz-hint" style={{ margin: 0 }}>They haven't filled the requirement form yet — ask them on WhatsApp.</p>
      ) : (
        <div className="lp-card">
          {rows.map(([label, value, sub, warn]) => (
            <div key={label} className="lp-row">
              <span className="lp-k">{label}</span>
              <span className="lp-v">
                <span className={warn ? "tk-due" : ""}>{value}</span>
                {sub && <span className="lp-sub">{sub}</span>}
              </span>
            </div>
          ))}
          {p?.filled_at && <p className="pz-hint" style={{ margin: "8px 0 0" }}>Form last filled {day(p.filled_at)}.</p>}
        </div>
      )}
      <style>{`
        .lp-card { padding: 2px 0; }
        .lp-row { display: grid; grid-template-columns: 112px 1fr; gap: 10px; padding: 9px 0; border-top: 1px solid var(--line); font-size: 13.5px; }
        .lp-row:first-child { border-top: 0; }
        .lp-k { color: var(--dim); }
        .lp-v { font-weight: 600; min-width: 0; overflow-wrap: anywhere; }
        .lp-sub { display: block; font-weight: 400; font-size: 12px; color: var(--dim); margin-top: 2px; }
      `}</style>
    </div>
  );
}
