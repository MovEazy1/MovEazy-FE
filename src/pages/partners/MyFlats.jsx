/**
 * My flats (/my-flats): every flat the partner uploaded — live, paused, let
 * out — each with how complete its details are, and one tap to mark it let
 * out or available again. Free and Premium alike.
 *
 * Also the Performance page (/performance): comparing a partner with others is
 * coming for Premium; free partners see what it is and how to get it.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Building2, ChevronRight, Crown, Plus, Sparkles, Trophy } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Empty, FlatHead, Loading, TopBar, toast } from "./partnerUi";
import { SmartListingImage } from "./partnerMedia";
import FlatActions from "./FlatActions";
import { friendlyError, hasPremium, pp, setListingStatus } from "../../lib/partners";
import { flatName } from "../../lib/partnerMatcher";
import { flatDetailScore, myFlats } from "../../lib/partnerTenants";
import { fetchMySocieties } from "../../lib/societyPartners";
import { AdviceNudge } from "./societyContacts";

function FlatRow({ l, action }) {
  const sc = flatDetailScore(l);
  return (
    <div className="mf-row">
      <Link to={pp(`/property/${l.property_id}`)} className="mf-thumb" aria-label={flatName(l)}>{(l.cover_image_url || (l.images ?? []).length) ? <SmartListingImage listing={l} thumb /> : <Building2 size={20} />}</Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <FlatHead listing={l} to={pp(`/property/${l.property_id}`)} />
        <span className="mf-bar" aria-label={`${sc.done} of ${sc.total} details`}><i style={{ width: `${(sc.done / sc.total) * 100}%` }} /></span>
        <div className="mf-foot">
          <span className="pz-hint">{sc.done}/{sc.total} details{sc.missing.length ? ` · add ${sc.missing.slice(0, 2).join(", ").toLowerCase()}` : " · complete"}</span>
          {action}
          <FlatActions listing={l} mine />
        </div>
      </div>
    </div>
  );
}

/**
 * The societies this partner onboarded (submitted or live), on top of My
 * flats: "Ask for inventory" — tap for the tenants who asked and the numbers
 * to ask for flats. Only for society partners (the call fails quietly for others).
 */
function SocietyCards() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let alive = true;
    fetchMySocieties().then((r) => alive && setRows(r.filter((x) => x.status === "submitted" || x.status === "approved")), () => {});
    return () => { alive = false; };
  }, []);
  if (!rows.length) return null;
  return (
    <div className="pz-section" style={{ padding: 0 }}>
      <h2 style={{ padding: "14px 14px 4px" }}>My societies · {rows.length}</h2>
      {rows.map((x) => (
        <Link key={x.id} to={pp(`/societies/${x.id}`)} style={{ display: "block", padding: "10px 14px", borderTop: "1px solid var(--line)", color: "inherit", textDecoration: "none" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 44, height: 44, borderRadius: 10, background: "#ECE9E2", overflow: "hidden", flex: "none", display: "grid", placeItems: "center" }}>
              {x.cover ? <img src={x.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Building2 size={20} color="var(--dim)" />}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: "block", fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}</b>
              <span className="pz-meta" style={{ display: "block" }}>
                {x.status === "approved" ? "Live" : "With MovEazy for review"}
                {x.leads ? ` · ${x.leads} tenant enquir${x.leads === 1 ? "y" : "ies"}${x.new_leads ? ` (${x.new_leads} new)` : ""}` : ""}
              </span>
            </span>
            <span className="pz-pill" style={{ background: "#FFF1D6", color: "#8A6419", borderColor: "transparent", flex: "none" }}>Ask for inventory</span>
            <ChevronRight size={16} color="var(--dim)" style={{ flex: "none" }} />
          </span>
          <AdviceNudge counts={x.contact_counts} compact style={{ marginTop: 6 }} />
        </Link>
      ))}
    </div>
  );
}

export default function MyFlats() {
  const { inventory, reloadInventory } = usePartner();
  const [busy, setBusy] = useState("");
  if (!inventory) return <><TopBar title="My flats" back /><Loading /></>;
  const f = myFlats(inventory);
  const setStatus = async (l, status, ok) => {
    setBusy(l.property_id);
    try { await setListingStatus(l.property_id, status); await reloadInventory(); toast(ok); } catch (e) { toast(friendlyError(e), "error"); } finally { setBusy(""); }
  };
  const section = (title, rows, action, empty) => (
    <div className="pz-section" style={{ padding: 0 }}>
      <h2 style={{ padding: "14px 14px 4px" }}>{title} · {rows.length}</h2>
      {rows.length === 0 ? <p className="pz-hint" style={{ padding: "0 14px 14px", margin: 0 }}>{empty}</p> : rows.map((l) => <FlatRow key={l.property_id} l={l} action={action(l)} />)}
    </div>
  );
  return (
    <>
      <TopBar title="My flats" back right={<Link to={pp("/add/property")} className="pz-iconbtn" aria-label="Add a flat" style={{ background: "var(--goldg)", color: "#1F1605", borderRadius: 999 }}><Plus size={20} /></Link>} />
      <style>{CSS}</style>
      <div className="pz-pad">
        <div className="mf-tip">
          <Sparkles size={18} />
          <span>The more flats you upload, the better the tenants you’re matched with — and the more details on each, the better the AI maps it to the right tenant.</span>
        </div>
        <SocietyCards />
        {section("Available", f.live, (l) => (
          <button type="button" className="pz-btn pz-btn--sm" disabled={busy === l.property_id} onClick={() => setStatus(l, "rented", "Marked let out — it won't be matched any more")}>Let out</button>
        ), "No available flats. Add one — it takes a minute.")}
        {f.paused.length > 0 && section("Paused", f.paused, (l) => (
          <button type="button" className="pz-btn pz-btn--sm pz-btn--primary" disabled={busy === l.property_id} onClick={() => setStatus(l, "published", "Live again")}>Make live</button>
        ), "")}
        {section("Let out", f.letOut, (l) => (
          <button type="button" className="pz-btn pz-btn--sm pz-btn--primary" disabled={busy === l.property_id} onClick={() => setStatus(l, "published", "Available again — tenants are being matched to it")}>Available again</button>
        ), "Flats you mark let out wait here, ready for the next tenant.")}
        {f.live.length + f.paused.length + f.letOut.length === 0 && (
          <Empty action={<Link to={pp("/add/property")} className="pz-btn pz-btn--primary"><Plus size={16} /> Add your first flat</Link>}>
            Upload your flats: the AI matches them to tenants, and 3 available flats unlock 10 free MovEazy leads.
          </Empty>
        )}
      </div>
    </>
  );
}

/** /performance — compare with other partners: coming for Premium. */
export function PerformancePage() {
  const { me } = usePartner();
  const premium = hasPremium(me);
  return (
    <>
      <TopBar title="Performance" back />
      <style>{CSS}</style>
      <div className="pz-pad">
        <div className="mf-perf">
          <span className="mf-perf-ic"><Trophy size={28} /></span>
          <h2>{premium ? "Coming soon" : "A Premium feature"}</h2>
          <p>See how you’re doing next to other MovEazy partners in your areas — closures, how fast you reply to tenants, how many of your flats get liked, and visits to deals.</p>
          <ul>
            <li><BarChart3 size={15} /> Your closures and visits, month by month</li>
            <li><Trophy size={15} /> Where you rank among partners in your areas</li>
            <li><Sparkles size={15} /> What the top partners do differently</li>
          </ul>
          {premium
            ? <span className="pz-pill" style={{ background: "var(--goldg)", color: "#1F1605" }}>You’ll have it first — we’ll let you know</span>
            : <Link to={pp("/premium")} className="pz-btn pz-btn--gold pz-btn--block"><Crown size={17} /> Get Premium</Link>}
        </div>
      </div>
    </>
  );
}

const CSS = `
.mf-tip { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; margin-bottom: 12px; border-radius: 14px;
  background: linear-gradient(135deg, #FFFBEB, #FFF3D6); border: 1px solid #F1D99B; font-size: 13.5px; color: #5C3F05; line-height: 1.45; }
.mf-tip svg { color: #8A6419; flex: none; margin-top: 1px; }
.mf-row { display: flex; gap: 10px; align-items: flex-start; padding: 10px 14px; border-top: 1px solid var(--line); }
.mf-thumb { width: 64px; height: 50px; border-radius: 8px; overflow: hidden; flex: none; background: #E9E6DF; display: grid; place-items: center; color: var(--dim); }
.mf-thumb img, .mf-thumb video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.mf-foot { display: flex; align-items: center; gap: 8px; }
.mf-foot .pz-hint { flex: 1; min-width: 0; }
.mf-bar { display: block; height: 5px; border-radius: 99px; background: var(--line); margin: 5px 0 3px; overflow: hidden; }
.mf-bar i { display: block; height: 100%; background: var(--goldg); border-radius: 99px; }
.mf-perf { text-align: center; padding: 26px 18px; border-radius: 20px; color: #fff;
  background: radial-gradient(120% 90% at 50% 0%, rgba(212,164,55,.3), transparent 62%), #0E0D12; border: 1px solid rgba(212,164,55,.4); }
.mf-perf-ic { width: 60px; height: 60px; border-radius: 18px; display: grid; place-items: center; margin: 0 auto 12px; color: #1F1605; background: var(--goldg); }
.mf-perf h2 { margin: 0 0 8px; font-size: 21px; color: #fff; }
.mf-perf p { margin: 0 0 12px; font-size: 14px; color: #D9D6E0; line-height: 1.5; }
.mf-perf ul { list-style: none; padding: 0; margin: 0 0 16px; display: grid; gap: 8px; text-align: left; font-size: 13.5px; color: #E7E3EE; }
.mf-perf li { display: flex; gap: 8px; align-items: center; }
.mf-perf li svg { color: var(--gold); flex: none; }
`;
