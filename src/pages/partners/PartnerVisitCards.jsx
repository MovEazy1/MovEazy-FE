/**
 * Partner Home: the visits the MovEazy team gave you, each a card — who, which
 * flat, when, and what's next (share the spot, waiting, live). And the
 * floating bubble while a visit needs you or is live, on every screen.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CalendarCheck, ChevronRight } from "lucide-react";
import { pp } from "../../lib/partners";
import { VISIT_STATUS, fetchPartnerLiveVisits, pingPartner, useLivePing, visitTime } from "../../lib/liveVisits";
import LiveVisitBubble, { bubbleVisit } from "../../components/LiveVisitBubble";

/** The partner's open visits, kept fresh (every 20 s while one is live, else every 2 min). */
export function usePartnerLiveVisits() {
  const [rows, setRows] = useState([]);
  const load = useCallback(() => fetchPartnerLiveVisits().then(setRows, () => {}), []);
  const live = rows.some((v) => v.live);
  useEffect(() => {
    load();
    const t = setInterval(load, live ? 20000 : 120000);
    return () => clearInterval(t);
  }, [load, live]);
  return [rows, setRows];
}

export default function PartnerVisitCards() {
  const [rows] = usePartnerLiveVisits();
  const open = rows.filter((v) => v.status !== "done");
  if (!open.length) return null;
  return (
    <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
      {open.map((v) => {
        const st = VISIT_STATUS[v.status] || VISIT_STATUS.assigned;
        const next = v.live ? "Live — see where they are" : v.status === "assigned" ? "Share where to meet" : `Waiting for ${String(v.client?.name || "the tenant").split(" ")[0]} to set off`;
        return (
          <Link key={v.id} to={pp(`/visits/${v.id}`)} className="pz-section"
            style={{ display: "flex", alignItems: "center", gap: 12, margin: 0, textDecoration: "none", color: "inherit", borderColor: v.status === "assigned" || v.live ? st.tone : undefined }}>
            <span style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: `${st.tone}18`, color: st.tone, flex: "none" }}>
              <CalendarCheck size={21} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 14.5, display: "block" }}>Visit · {v.client?.name || "MovEazy tenant"}</b>
              <span className="pz-meta" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.flat?.title} · {visitTime(v.visit_at)}</span>
              <span className="pz-meta" style={{ color: st.tone, fontWeight: 700 }}>{next}</span>
            </span>
            <ChevronRight size={18} color="var(--dim)" />
          </Link>
        );
      })}
    </div>
  );
}

/** The bubble, mounted once in the app shell. Also keeps sharing your location while a visit is live. */
export function PartnerVisitBubble() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [rows, setRows] = usePartnerLiveVisits();
  const v = bubbleVisit(rows, "partner");
  // On the visit's own page, that page shares the location.
  const onPage = Boolean(v && pathname.endsWith(`/visits/${v.id}`));
  useLivePing(v, v?.broker_sharing && !onPage, pingPartner, (row) => setRows((cur) => cur.map((x) => (x.id === row.id ? { ...x, ...row } : x))));
  if (!v || onPage) return null;
  return <LiveVisitBubble visit={v} side="partner" onOpen={() => navigate(pp(`/visits/${v.id}`))} />;
}
