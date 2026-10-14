/**
 * The Inventory tab: the partner's own flats, and only theirs.
 *   - On top, the next upload milestone (MilestoneBar) and how many flats
 *     their AI matching searches besides their own — other partners' and
 *     MovEazy's, never listed here (partner_pool_milestones.sql). Group flats
 *     are in Groups.
 *   - My inventory: none yet → upload your inventory to start getting
 *     clients. Some → each flat with its details (complete at 6 of 9, with
 *     rent, BHK, area and a photo) and "Live on MovEazy Website" once it has a
 *     photo; Add details opens the flat's details sheet.
 * (Home is PartnerHome.jsx.) The search survives a trip into a flat.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, CheckCircle2, Globe, Plus, Search, Sparkles, X } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Empty, Loading } from "./partnerUi";
import { PartnerHeader } from "./PartnerChrome";
import MilestoneBar from "./MilestoneBar";
import { pp } from "../../lib/partners";
import { EMPTY_FILTERS, applyFilters } from "../../lib/partnerFilters";
import { flatDetailScore, myFlats } from "../../lib/partnerTenants";
import { flatLine } from "../../lib/partnerMatcher";
import { fetchPoolCount, fetchUploadProgress, isFlatComplete, liveOnWebsite } from "../../lib/partnerPool";
import { SmartListingImage } from "./partnerMedia";

/** My inventory: the partner's live flats, each with how complete its details are. */
function MyInventory({ inventory, query }) {
  const live = useMemo(() => myFlats(inventory ?? []).live, [inventory]);
  const others = useMemo(() => (inventory ?? []).filter((l) => l.source === "mine" && l.status !== "published").length, [inventory]);
  const rows = useMemo(() => applyFilters(live, EMPTY_FILTERS, query)
    .map((l) => ({ l, sc: flatDetailScore(l), ok: isFlatComplete(l) }))
    .sort((a, b) => Number(a.ok) - Number(b.ok) || a.sc.done / a.sc.total - b.sc.done / b.sc.total), [live, query]);
  const missing = rows.filter((r) => !r.ok).length;

  if (!inventory) return <Loading label="Loading your flats…" />;
  if (!live.length) {
    return (
      <div className="ih-none">
        <span className="ih-none-ic" aria-hidden><Building2 size={34} /></span>
        <h2>You haven't uploaded your inventory yet</h2>
        <p>Upload your inventory to start getting clients. MovEazy matches every flat you add to tenants looking for it.</p>
        <Link to={pp("/add/property")} className="ih-add"><Plus size={20} strokeWidth={2.6} /> Upload a flat</Link>
        {others > 0 && <Link to={pp("/my-flats")} className="ih-other">See your {others} paused or let-out flat{others === 1 ? "" : "s"}</Link>}
      </div>
    );
  }
  return (
    <>
      {missing > 0 ? (
        <div className="ih-nudge">
          <Sparkles size={20} />
          <span><b>{missing === live.length && missing > 1 ? `All ${missing} flats are` : `${missing} flat${missing === 1 ? " is" : "s are"}`} missing details</b>
            Add them to get matched to more clients: photos, deposit and furnishing count the most.</span>
        </div>
      ) : (
        <div className="ih-nudge ih-nudge--ok">
          <CheckCircle2 size={20} />
          <span><b>Every live flat has its details in</b>Upload more flats to get more clients — there's no limit.</span>
        </div>
      )}
      {rows.length === 0 ? <Empty>None of your flats match that search.</Empty> : (
        <div className="pz-card ih-mine">
          {rows.map(({ l, sc, ok }) => (
            <div key={l.property_id} className="ih-flat">
              <Link to={pp(`/property/${l.property_id}`)} className="ih-thumb" aria-label={flatLine(l) || "Open flat"}>
                {(l.cover_image_url || (l.images ?? []).length) ? <SmartListingImage listing={l} thumb /> : <Building2 size={22} />}
              </Link>
              <Link to={pp(`/property/${l.property_id}`)} className="ih-flat-txt">
                <strong>{flatLine(l) || l.title || l.property_id}</strong>
                {liveOnWebsite(l) && <span className="ih-web"><Globe size={11} /> Live on MovEazy Website</span>}
                <span className={`ih-bar${ok ? " ih-bar--ok" : ""}`} aria-hidden><i style={{ width: `${ok ? 100 : (sc.done / sc.total) * 100}%` }} /></span>
                <span className="pz-hint">{ok ? "All details in" : `${sc.done}/${sc.total} details · add ${sc.missing.slice(0, 2).join(", ").toLowerCase()}`}</span>
              </Link>
              {!ok
                ? <Link to={pp(`/property/${l.property_id}?details=1`)} className="pz-btn pz-btn--sm pz-btn--gold" style={{ flex: "none" }}>Add details</Link>
                : <CheckCircle2 size={20} color="var(--g)" style={{ flex: "none" }} aria-label="All details in" />}
            </div>
          ))}
        </div>
      )}
      <Link to={pp("/add/property")} className="pz-btn pz-btn--block" style={{ marginTop: 4 }}><Plus size={17} /> Upload another flat</Link>
    </>
  );
}

export default function InventoryHome() {
  const { inventory, ui, setUi, demo } = usePartner();
  const [q, setQ] = useState(ui.q || "");
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState(null);
  const [pool, setPool] = useState(null);
  const liveMine = useMemo(() => myFlats(inventory ?? []).live.length, [inventory]);

  // Debounced into the shared UI state, so it is still there on return.
  useEffect(() => {
    const id = setTimeout(() => setUi({ q }), 200);
    return () => clearTimeout(id);
  }, [q, setUi]);

  // Re-read when their flats change (an upload, details added): it also gives a reward that's due.
  const mineKey = (inventory ?? []).filter((l) => l.source === "mine").map((l) => `${l.property_id}:${l.updated_at || ""}`).join();
  useEffect(() => {
    if (demo) return;
    fetchUploadProgress().then(setProgress, () => setProgress(null));
    fetchPoolCount().then(setPool, () => setPool(null));
  }, [demo, mineKey]);

  return (
    <>
      <PartnerHeader>
        <div className="pc-band" role="tablist" aria-label="Inventory">
          <button type="button" className={`pc-pill${searching || q ? " on" : ""}`} style={{ width: 42, padding: 0, justifyContent: "center", color: searching || q ? "#fff" : "#C8102E" }}
            aria-label="Search" aria-expanded={searching} onClick={() => setSearching((v) => !v)}><Search size={18} strokeWidth={2.4} /></button>
          <span role="tab" aria-selected className="pc-pill on">
            My inventory <span style={{ opacity: 0.6, fontWeight: 600 }}>{liveMine}</span>
          </span>
        </div>
        {(searching || q) && (
          <div className="pz-pad" style={{ background: "#ECE9E2", paddingTop: 0, paddingBottom: 10 }}>
            <label className="pc-search" style={{ width: "100%", boxSizing: "border-box" }}>
              <Search size={18} strokeWidth={2.4} />
              <input type="search" placeholder="Search your flats: area, BHK or rent" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search your inventory"
                autoFocus={searching && !q} style={{ width: "100%" }} />
              {q && <button type="button" className="pz-iconbtn" style={{ width: 30, height: 30 }} aria-label="Clear search" onClick={() => { setQ(""); setSearching(false); }}><X size={16} /></button>}
            </label>
          </div>
        )}
      </PartnerHeader>
      <style>{FILTER_CSS}</style>

      <div className="pz-pad pz-list">
        {progress && <MilestoneBar progress={progress} />}
        {Number(pool) > 0 && (
          <Link to={pp("/ai-matcher")} className="ih-pool">
            <Sparkles size={17} />
            <span><b>{Number(pool).toLocaleString("en-IN")} flats from other MovEazy partners</b>
              AI Matching searches them for your tenants. You see who listed one once your tenant likes it.</span>
          </Link>
        )}
        <MyInventory inventory={inventory} query={ui.q} />
      </div>
    </>
  );
}

// My inventory, and the small dropdowns under BHK and Brokerage.
const FILTER_CSS = `
.ih-web { display: inline-flex; align-items: center; gap: 4px; justify-self: start; font-size: 11px; font-weight: 800; color: #0B6E4F; background: var(--gl);
  border-radius: 99px; padding: 2px 8px; }
.ih-pool { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 14px; background: var(--noir); color: #fff; text-decoration: none;
  font-size: 12.5px; line-height: 1.45; }
.ih-pool svg { flex: none; color: #F0CF7C; margin-top: 2px; }
.ih-pool b { display: block; font-size: 14px; color: #F0CF7C; }
.ih-none { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 34px 18px 20px; background: var(--card);
  border: 1px solid var(--line); border-radius: 18px; }
.ih-none-ic { width: 76px; height: 76px; border-radius: 999px; background: var(--gl); color: var(--g); display: grid; place-items: center; }
.ih-none h2 { margin: 16px 0 0; font-size: 21px; line-height: 1.25; }
.ih-none p { margin: 10px 0 0; font-size: 15px; line-height: 1.5; color: var(--dim); }
.ih-add { margin-top: 20px; height: 52px; padding: 0 28px; border-radius: 999px; background: var(--goldg); color: #1F1605; font-size: 16px; font-weight: 800;
  text-decoration: none; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 10px 24px rgba(212,164,55,.35); }
.ih-other { margin-top: 14px; font-size: 13.5px; font-weight: 700; color: var(--g); }
.ih-nudge { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 14px; background: #FEF7E6; border: 1px solid #F1D99B;
  color: #5C3F05; font-size: 13.5px; line-height: 1.45; }
.ih-nudge svg { flex: none; margin-top: 1px; color: #B8860B; }
.ih-nudge b { display: block; font-size: 14.5px; }
.ih-nudge--ok { background: var(--gl); border-color: var(--gl2); color: var(--g2); }
.ih-nudge--ok svg { color: var(--g); }
.ih-mine { padding: 0; overflow: hidden; }
.ih-flat { display: flex; align-items: center; gap: 12px; padding: 12px; border-top: 1px solid var(--line); }
.ih-flat:first-child { border-top: 0; }
.ih-thumb { width: 58px; height: 58px; border-radius: 12px; overflow: hidden; flex: none; background: var(--bg); display: grid; place-items: center; color: var(--mute); }
.ih-thumb img { width: 100%; height: 100%; object-fit: cover; }
.ih-flat-txt { flex: 1; min-width: 0; color: inherit; text-decoration: none; display: grid; gap: 4px; }
.ih-flat-txt strong { font-size: 14.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ih-bar { display: block; height: 6px; border-radius: 99px; background: #EFECE6; overflow: hidden; }
.ih-bar i { display: block; height: 100%; background: var(--gold); border-radius: 99px; }
.ih-bar--ok i { background: var(--g); }
.ih-filters { position: relative; }
.ih-dd { position: absolute; top: calc(100% - 2px); z-index: 30; width: 250px; background: #fff; border: 1px solid var(--line); border-radius: 14px;
  box-shadow: 0 18px 40px rgba(14,13,18,.2); padding: 6px; animation: ihdd .14s ease; }
@keyframes ihdd { from { opacity: 0; transform: translateY(-4px); } }
.ih-opt { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 10px; border: 0; border-radius: 10px; background: none;
  font: inherit; font-size: 14px; color: var(--ink); cursor: pointer; text-align: left; }
.ih-opt:hover { background: #F6F4EF; }
.ih-opt.on { font-weight: 700; }
.ih-n { margin-left: auto; font-size: 12px; color: var(--dim); font-weight: 600; }
.ih-box { width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid #C9C5BC; display: grid; place-items: center; flex: none; }
.ih-opt.on .ih-box { background: var(--noir); border-color: var(--noir); color: var(--gold); }
.ih-radio { width: 18px; height: 18px; border-radius: 99px; border: 1.5px solid #C9C5BC; display: grid; place-items: center; flex: none; }
.ih-radio i { width: 8px; height: 8px; border-radius: 99px; background: var(--gold); }
.ih-opt.on .ih-radio { border-color: var(--noir); background: var(--noir); }
.ih-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 4px; }
.ih-pill { border: 1px solid var(--line); background: #fff; border-radius: 10px; padding: 9px 4px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--ink); }
.ih-pill.on { background: var(--noir); border-color: var(--noir); color: #fff; }
.ih-dd-foot { display: flex; justify-content: space-between; gap: 8px; padding: 8px 4px 2px; border-top: 1px solid var(--line); margin-top: 4px; }
`;
