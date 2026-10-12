/**
 * Screen 3 — Home: the society, the earn-together card, three numbers
 * (flats, available, what *you* earned), Add Available Flat, recently added.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Clock, Plus, X } from "lucide-react";
import { fetchSocietyHome, rupees, societyError, sp } from "../../lib/society";
import { useSociety } from "./SocietyApp";
import { Avatar, BuildingArt, Empty, FlatRow, Loading } from "./societyUi";

export default function Home() {
  const { me, society, member } = useSociety();
  const [home, setHome] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    fetchSocietyHome().then((h) => { if (alive) setHome(h); }, (e) => { if (alive) setErr(societyError(e)); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="sx-page hm">
      <style>{CSS}</style>
      <header className="hm-head">
        <Link to={sp("/profile")} className="hm-who">
          <Avatar name={society.name} size={46} />
          <span><b>{society.name}</b><em>{[society.area, "Bangalore"].filter(Boolean).join(", ")}</em></span>
        </Link>
        <Link to={sp("/notifications")} className="sx-icon hm-bell" aria-label={`Notifications${me.unread ? `, ${me.unread} new` : ""}`}>
          <Bell size={24} />{me.unread > 0 && <i>{me.unread > 9 ? "9+" : me.unread}</i>}
        </Link>
      </header>

      {society.status === "pending" && (
        <div className="sx-banner sx-banner--amber"><Clock size={18} /><span><b>Waiting for MovEazy&apos;s approval.</b> Keep adding flats and inviting your team — they go live on moveazy.co.in once approved.</span></div>
      )}
      {society.status === "rejected" && (
        <div className="sx-banner sx-banner--red"><X size={18} />
          <span><b>MovEazy asked for changes:</b> {society.reject_reason}
            {member.role === "manager" && <> <Link to={sp("/setup")} style={{ fontWeight: 800 }}>Fix details</Link></>}</span>
        </div>
      )}

      <section className="hm-hero">
        <div>
          <h2>Earn together with MovEazy</h2>
          <p>Get {Math.round(society.pool_pct ?? 70)}% of the brokerage when a flat is closed.</p>
        </div>
        <BuildingArt className="hm-art" tone="dark" />
      </section>

      {err && <p className="sx-err">{err}</p>}
      {!home && !err ? <Loading /> : home && (
        <>
          <div className="hm-stats">
            <div><b>{home.total}</b><span>Total Flats</span></div>
            <div className="mint"><b>{home.available}</b><span>Available</span></div>
            <div><b>{rupees(home.my_earned)}</b><span>You Earned</span></div>
          </div>

          <Link to={sp("/flats/new")} className="hm-add">
            <span className="hm-plus"><Plus size={26} strokeWidth={2.6} /></span>
            Add Available Flat
          </Link>

          <div className="sx-section-head">
            <h2>Recently Added</h2>
            <Link to={sp("/flats")} className="sx-link">View all</Link>
          </div>
          {home.recent.length === 0 ? (
            <Empty title="No flats yet">Add the first flat that&apos;s free to rent — it takes under a minute.</Empty>
          ) : home.recent.map((f) => <FlatRow key={f.property_id} flat={f} to={sp(`/flats/${f.property_id}`)} />)}
        </>
      )}
    </div>
  );
}

const CSS = `
.hm-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 0 6px; }
.hm-who { display: flex; align-items: center; gap: 12px; text-decoration: none; min-width: 0; }
.hm-who b { display: block; font-size: 18px; }
.hm-who em { font-style: normal; color: var(--dim); font-size: 14px; }
.hm-bell { position: relative; color: var(--em); }
.hm-bell i { position: absolute; top: 4px; right: 4px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 99px; background: #E5484D; color: #fff;
  font-size: 11px; font-style: normal; font-weight: 800; display: grid; place-items: center; }
.hm-hero { margin-top: 12px; border-radius: 20px; overflow: hidden; position: relative; min-height: 150px; padding: 20px 18px; color: #fff;
  background: radial-gradient(120% 120% at 0% 0%, #13805D, #0A5E44 45%, #063B2D); display: flex; align-items: center; box-shadow: 0 12px 28px rgba(6,59,45,.25); }
.hm-hero > div { position: relative; z-index: 1; max-width: 60%; }
.hm-hero h2 { font-size: 22px; line-height: 1.2; margin: 0 0 8px; letter-spacing: -0.01em; }
.hm-hero p { margin: 0; font-size: 14.5px; color: #D7EEE4; line-height: 1.45; }
.hm-art { position: absolute; right: -54px; bottom: -14px; width: 200px; opacity: .9; }
.hm-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }
.hm-stats div { background: #fff; border: 1px solid #EEE9DD; border-radius: 16px; padding: 14px 8px; text-align: center; }
.hm-stats div.mint { background: #EAF6F0; border-color: #D3EBDF; }
.hm-stats b { display: block; font-size: 22px; font-weight: 800; letter-spacing: -0.01em; }
.hm-stats span { font-size: 13px; color: var(--dim); }
.hm-add { margin-top: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 128px; border-radius: 20px;
  background: radial-gradient(130% 120% at 50% 0%, #13805D, #0A6B4E 55%, #075139); color: #fff; font-size: 19px; font-weight: 800; text-decoration: none;
  box-shadow: 0 14px 30px rgba(6,59,45,.28); }
.hm-add:active { transform: scale(.99); }
.hm-plus { width: 48px; height: 48px; border-radius: 99px; background: #fff; color: var(--em); display: grid; place-items: center; }
`;
