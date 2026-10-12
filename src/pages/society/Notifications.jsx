/**
 * The bell: approval, people joining, move-out reminders, earnings and
 * payouts. Opening it marks everything read.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlarmClock, BadgeCheck, Bell, IndianRupee, UserPlus, XCircle } from "lucide-react";
import { fetchSocietyNotifications, markSocietyNotificationsRead, societyError, sp } from "../../lib/society";
import { useSociety } from "./SocietyApp";
import { Empty, Loading, TopBar } from "./societyUi";

const ICON = { approved: BadgeCheck, rejected: XCircle, member_joined: UserPlus, move_out: AlarmClock, earning: IndianRupee, paid: IndianRupee };
const ago = (d) => {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export default function Notifications() {
  const { reload } = useSociety();
  const [items, setItems] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetchSocietyNotifications().then((r) => { setItems(r); if (r.some((x) => !x.read)) markSocietyNotificationsRead().then(reload); }, (e) => setErr(societyError(e)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="sx-page nt">
      <style>{CSS}</style>
      <TopBar title="Notifications" back={sp("/")} />
      {err && <p className="sx-err">{err}</p>}
      {!items && !err ? <Loading /> : items && (items.length === 0 ? <Empty title="Nothing yet">Approvals, reminders and earnings show up here.</Empty> : (
        <div className="sx-card" style={{ padding: "4px 0" }}>
          {items.map((n) => {
            const Icon = ICON[n.kind] || Bell;
            const body = (
              <>
                <span className={`nt-ic${n.kind === "rejected" ? " bad" : ""}`}><Icon size={20} /></span>
                <span className="nt-main"><b>{n.title}</b>{n.body && <em>{n.body}</em>}<small>{ago(n.created_at)}</small></span>
                {!n.read && <i className="nt-dot" aria-label="New" />}
              </>
            );
            return n.link ? <Link key={n.id} to={sp(n.link)} className="nt-row">{body}</Link> : <div key={n.id} className="nt-row">{body}</div>;
          })}
        </div>
      ))}
    </div>
  );
}

const CSS = `
.nt-row { display: flex; gap: 12px; align-items: flex-start; padding: 14px; border-bottom: 1px solid #F0ECE2; text-decoration: none; color: inherit; }
.nt-row:last-child { border-bottom: 0; }
.nt-ic { width: 40px; height: 40px; border-radius: 99px; background: var(--mint); color: var(--em); display: grid; place-items: center; flex: none; }
.nt-ic.bad { background: #FDECEC; color: #B42318; }
.nt-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.nt-main b { font-size: 15.5px; }
.nt-main em { font-style: normal; color: var(--dim); font-size: 14px; line-height: 1.4; }
.nt-main small { color: #8A928E; font-size: 12.5px; }
.nt-dot { width: 9px; height: 9px; border-radius: 99px; background: var(--teal); margin-top: 6px; flex: none; }
`;
