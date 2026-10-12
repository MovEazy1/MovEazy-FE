/**
 * My flats (/my-flats): every flat the partner uploaded — live, paused, let
 * out — each with how complete its details are, and one tap to mark it let
 * out or available again. Free and Premium alike.
 *
 * Also the Performance page (/performance): comparing a partner with others is
 * coming for Premium; free partners see what it is and how to get it.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Building2, Crown, Plus, Sparkles, Trophy } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Empty, Loading, TopBar, toast } from "./partnerUi";
import { SmartListingImage } from "./partnerMedia";
import { friendlyError, hasPremium, pp, setListingStatus } from "../../lib/partners";
import { flatLine } from "../../lib/partnerMatcher";
import { flatDetailScore, myFlats } from "../../lib/partnerTenants";

function FlatRow({ l, action }) {
  const sc = flatDetailScore(l);
  return (
    <div className="mf-row">
      <Link to={pp(`/property/${l.property_id}`)} className="mf-thumb">{(l.cover_image_url || (l.images ?? []).length) ? <SmartListingImage listing={l} thumb /> : <Building2 size={20} />}</Link>
      <Link to={pp(`/property/${l.property_id}`)} style={{ flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}>
        <strong style={{ display: "block", fontSize: 14.5 }}>{flatLine(l) || l.property_id}</strong>
        <span className="mf-bar" aria-label={`${sc.done} of ${sc.total} details`}><i style={{ width: `${(sc.done / sc.total) * 100}%` }} /></span>
        <span className="pz-hint">{sc.done}/{sc.total} details{sc.missing.length ? ` · add ${sc.missing.slice(0, 2).join(", ").toLowerCase()}` : " · complete"}</span>
      </Link>
      {action}
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
.mf-row { display: flex; gap: 10px; align-items: center; padding: 10px 14px; border-top: 1px solid var(--line); }
.mf-thumb { width: 64px; height: 50px; border-radius: 8px; overflow: hidden; flex: none; background: #E9E6DF; display: grid; place-items: center; color: var(--dim); }
.mf-thumb img, .mf-thumb video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
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
