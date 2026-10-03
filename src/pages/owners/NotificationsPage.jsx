/**
 * What happened on the owner's flats: visits booked or asked for, likes, and
 * the team's updates on requests. Only things worth a look (PRD: avoid noise) —
 * and nothing is pushed; opening this marks everything seen.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CalendarClock, Heart, Wrench, Zap } from "lucide-react";
import { useOwner } from "./OwnerApp";
import { Empty, Loading, TopBar } from "./ownerUi";
import { fetchActivity, fmtDateTime, friendlyError, op, propertyName, relTime } from "../../lib/owners";

const SEEN_KEY = "mz_owner_seen_at";
const ICON = { visit_booked: CalendarClock, visit_requested: CalendarClock, building_visit: CalendarClock, instant_visit: Zap, liked: Heart, request_update: Wrench };

export default function NotificationsPage() {
  const { byId } = useOwner();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchActivity(30).then(setRows, (e) => { setRows([]); setError(friendlyError(e)); });
    try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* ignore */ }
  }, []);

  const text = (a) => {
    const where = byId.get(a.property_id) ? propertyName(byId.get(a.property_id)) : a.property_id;
    switch (a.kind) {
      case "visit_booked": return [`${a.who} booked a visit`, `${where}${a.slot_at ? ` · ${fmtDateTime(a.slot_at)}` : ""}`];
      case "visit_requested": return [`${a.who} asked to visit`, `${where} · MovEazy will confirm a time`];
      // Through a building's QR: the building's name comes as the message.
      case "instant_visit": return [`${a.who} is coming for an instant visit`, `${a.message}${a.slot_at ? ` · there by ${fmtDateTime(a.slot_at)}` : ""}`];
      case "building_visit": return [`${a.who} asked to visit`, `${a.message} · ${a.slot_at ? fmtDateTime(a.slot_at) : "the partner will fix a time"}`];
      case "liked": return [`${a.who} liked your flat`, where];
      default: return [a.message, where];
    }
  };
  const to = (a) => (a.request_id ? op(`/repairs/${a.request_id}`)
    : a.building_id ? op(`/buildings/${a.building_id}`) : op(`/properties/${a.property_id}/find-tenant`));

  return (
    <>
      <TopBar title="Notifications" back />
      <div className="oz-pad">
        {rows === null ? <Loading /> : error ? <Empty>{error}</Empty> : rows.length === 0 ? (
          <Empty icon={<Bell size={22} />}>Nothing new in the last 30 days. Visits, interest and repair updates will show up here.</Empty>
        ) : (
          <div className="oz-card">
            {rows.map((a, i) => {
              const Icon = ICON[a.kind] || Bell;
              const [title, sub] = text(a);
              return (
                <Link key={`${a.at}-${i}`} to={to(a)} className="oz-menurow">
                  <span className="oz-avatar" style={{
                    background: a.kind === "request_update" ? "var(--bluebg)" : a.kind === "instant_visit" ? "var(--champ2)" : "var(--emt)",
                    color: a.kind === "request_update" ? "var(--blue)" : a.kind === "instant_visit" ? "var(--champ3)" : "var(--em)" }}>
                    <Icon size={17} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}><strong style={{ fontWeight: 600 }}>{title}</strong><span className="oz-sub">{sub}</span></span>
                  <span className="oz-hint" style={{ flex: "none" }}>{relTime(a.at)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
