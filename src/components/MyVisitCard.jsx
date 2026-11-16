/**
 * The tenant home's top card: "My visit" — a visit with a MovEazy partner
 * (partner_live_visits.sql) that's coming up, live, or done today. Tap: the
 * visit (/my-visit/<id>) with the meeting spot, "I am coming" and the live map.
 * Nothing shows when there's no visit.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, ChevronRight } from "lucide-react";
import { fetchTenantLiveVisits, visitTime } from "../lib/liveVisits";

/** What the tenant should do next, in a few words. */
function nextStep(v, partner) {
  if (v.live) return { text: `Live — see where ${partner} is`, tone: "#5EEAD4" };
  if (v.status === "shared") return { text: "Meeting spot shared · tap \"I am coming\" when you leave", tone: "#E4B659" };
  if (v.status === "done") return v.tenant_answer?.liked ? { text: "Visit done · thanks for telling us", tone: "#A7B5B1" } : { text: "Visit done · tell us how the flat was", tone: "#E4B659" };
  return { text: `${partner} will share where to meet soon`, tone: "#A7B5B1" };
}

export default function MyVisitCard() {
  const [rows, setRows] = useState([]);
  const live = rows.some((v) => v.live);
  useEffect(() => {
    let alive = true;
    const load = () => fetchTenantLiveVisits().then((r) => alive && setRows(r), () => {});
    load();
    const t = setInterval(load, live ? 20000 : 120000);
    return () => { alive = false; clearInterval(t); };
  }, [live]);

  // Live first, then the soonest coming up, then today's done ones.
  const shown = [...rows]
    .filter((v) => v.status !== "cancelled")
    .sort((a, b) => (b.live - a.live) || ((a.status === "done") - (b.status === "done")) || String(a.visit_at || "").localeCompare(String(b.visit_at || "")))
    .slice(0, 2);
  if (!shown.length) return null;

  return (
    <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
      {shown.map((v) => {
        const partner = String(v.partner?.name || "Your partner").split(" ")[0];
        const step = nextStep(v, partner);
        return (
          <Link key={v.id} to={`/my-visit/${v.id}`} aria-label={`My visit: ${v.flat?.title || "flat"}, ${step.text}`}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 18, background: "#04211D", color: "#fff",
              textDecoration: "none", boxShadow: "0 10px 26px rgba(4,33,29,.22)", minWidth: 0 }}>
            <span style={{ width: 42, height: 42, borderRadius: 12, flex: "none", display: "grid", placeItems: "center", background: "rgba(255,255,255,.1)", color: step.tone }}>
              <CalendarCheck size={21} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 11.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#5EEAD4" }}>My visit</span>
              <b style={{ display: "block", fontSize: 15.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.flat?.title || "Your visit"}</b>
              <span style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,.75)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {visitTime(v.visit_at)} · with {v.partner?.name || "your MovEazy partner"}
              </span>
              <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: step.tone, marginTop: 2 }}>{step.text}</span>
            </span>
            <ChevronRight size={18} style={{ flex: "none", opacity: 0.7 }} />
          </Link>
        );
      })}
    </div>
  );
}
