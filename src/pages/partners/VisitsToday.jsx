/**
 * Home: today's visits (IST), soonest first, each one WhatsApp away. Loading it
 * is also what puts "N visits today" in the bell, once a day
 * (partner_visits_today in partner_matcher_history.sql).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { WhatsAppIcon } from "./partnerUi";
import { pp, waLink } from "../../lib/partners";
import { fetchTodaysVisits, keyToSlug } from "../../lib/partnerMatcher";

const time = (at) => new Date(at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });

export default function VisitsToday() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let alive = true;
    fetchTodaysVisits().then((r) => alive && setRows(r), () => {});
    return () => { alive = false; };
  }, []);
  if (!rows.length) return null;
  return (
    <div className="pz-card" style={{ padding: 14, marginBottom: 12, borderColor: "var(--gold)" }}>
      <strong style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 15.5 }}>
        <CalendarClock size={17} color="var(--gold)" /> Today’s visits · {rows.length}
      </strong>
      {rows.map((v) => {
        const name = v.tenant?.name || "Your tenant";
        const flat = String(v.flat || "").replace(/\s*\([^)]*\)$/, "");
        const key = v.assignment_id ? `asg:${v.assignment_id}` : `lead:${v.lead_id}`;
        return (
          <div key={v.id} className="pz-row" style={{ gap: 10, paddingTop: 10, marginTop: 10, borderTop: "1px solid var(--line)" }}>
            <b style={{ width: 64, flex: "none", fontSize: 14 }}>{time(v.visit_at)}</b>
            <Link to={pp(`/ai-matcher/${keyToSlug(key)}`)} style={{ flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}>
              <strong style={{ display: "block", fontSize: 14 }}>{name}</strong>
              <span className="pz-hint">{flat}</span>
            </Link>
            {v.tenant?.phone && (
              <a className="pz-iconbtn" aria-label={`WhatsApp ${name}`} target="_blank" rel="noreferrer"
                style={{ background: "var(--goldg)", color: "#1F1605", borderRadius: 999, width: 34, height: 34 }}
                href={waLink(v.tenant.phone, `Hi ${name.split(" ")[0]}, see you at ${time(v.visit_at)} today for the ${flat} visit.`)}>
                <WhatsAppIcon size={17} />
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
