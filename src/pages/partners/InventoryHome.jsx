/**
 * The Inventory tab. Under the search, two pills:
 *   - My inventory (always what the tab opens on): the partner's live flats.
 *     None yet → upload your inventory to start getting clients. Some → how
 *     complete each one's details are, and a nudge to fill the gaps (Add
 *     details opens the flat's details sheet).
 *   - All inventory: everything else they can see — their groups and
 *     associations, other brokers' shared flats, and MovEazy's flats marked
 *     to share with partners (partner_inventory decides). Chips narrow it to
 *     MovEazy · Brokers · Groups, then BHK | Brokerage | ⚙.
 * (Home is PartnerHome.jsx.) Search and filters survive a trip into a flat.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useInView } from "react-intersection-observer";
import { Building2, CheckCircle2, ChevronDown, Crown, Plus, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { usePartner } from "./PartnerApp";
import FilterSheet from "./FilterSheet";
import { Chip, Empty, Loading, PropertyCard } from "./partnerUi";
import { PartnerHeader } from "./PartnerChrome";
import { DEMO_COUNTS, DEMO_GROUPS, DemoBanner, demoRows } from "./demoMode";
import { customerMessage, hasPremium, inSource, listerWhatsApp, pp, waLink } from "../../lib/partners";
import { BHK_CHIPS, BROKERAGE_CHIPS, EMPTY_FILTERS, activeFilterCount, applyFilters } from "../../lib/partnerFilters";
import { flatDetailScore, myFlats } from "../../lib/partnerTenants";
import { flatLine } from "../../lib/partnerMatcher";
import { SmartListingImage } from "./partnerMedia";

const PAGE = 20;
// All inventory's narrowing chips (the partner's own flats live under My inventory).
const SOURCE_OPTIONS = [
  { key: "moveazy", label: "MovEazy" },
  { key: "broker", label: "Brokers" },
  { key: "group", label: "Groups & associations" },
];

/** My inventory: the partner's live flats, each with how complete its details are. */
function MyInventory({ inventory, query }) {
  const live = useMemo(() => myFlats(inventory ?? []).live, [inventory]);
  const others = useMemo(() => (inventory ?? []).filter((l) => l.source === "mine" && l.status !== "published").length, [inventory]);
  const rows = useMemo(() => applyFilters(live, EMPTY_FILTERS, query)
    .map((l) => ({ l, sc: flatDetailScore(l) }))
    .sort((a, b) => a.sc.done / a.sc.total - b.sc.done / b.sc.total), [live, query]);
  const missing = rows.filter((r) => r.sc.missing.length).length;

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
          <span><b>Every live flat has full details</b>Upload more flats to get more clients.</span>
        </div>
      )}
      {rows.length === 0 ? <Empty>None of your flats match that search.</Empty> : (
        <div className="pz-card ih-mine">
          {rows.map(({ l, sc }) => (
            <div key={l.property_id} className="ih-flat">
              <Link to={pp(`/property/${l.property_id}`)} className="ih-thumb" aria-label={flatLine(l) || "Open flat"}>
                {(l.cover_image_url || (l.images ?? []).length) ? <SmartListingImage listing={l} thumb /> : <Building2 size={22} />}
              </Link>
              <Link to={pp(`/property/${l.property_id}`)} className="ih-flat-txt">
                <strong>{flatLine(l) || l.title || l.property_id}</strong>
                <span className={`ih-bar${sc.missing.length ? "" : " ih-bar--ok"}`} aria-hidden><i style={{ width: `${(sc.done / sc.total) * 100}%` }} /></span>
                <span className="pz-hint">{sc.done}/{sc.total} details{sc.missing.length ? ` · add ${sc.missing.slice(0, 2).join(", ").toLowerCase()}` : " · complete"}</span>
              </Link>
              {sc.missing.length > 0
                ? <Link to={pp(`/property/${l.property_id}?details=1`)} className="pz-btn pz-btn--sm pz-btn--gold" style={{ flex: "none" }}>Add details</Link>
                : <CheckCircle2 size={20} color="var(--g)" style={{ flex: "none" }} aria-label="Complete" />}
            </div>
          ))}
        </div>
      )}
      <Link to={pp("/add/property")} className="pz-btn pz-btn--block" style={{ marginTop: 4 }}><Plus size={17} /> Upload another flat</Link>
    </>
  );
}

export default function InventoryHome() {
  const { me, inventory, invError, ui, setUi, saved, toggleSave, groups, demo, explain } = usePartner();
  const [q, setQ] = useState(ui.q || "");
  const [sheet, setSheet] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [menu, setMenu] = useState(null); // { kind: "bhk" | "brokerage", left }
  const filterRef = useRef(null);
  const filters = ui.filters || EMPTY_FILTERS;
  const sources = useMemo(() => (Array.isArray(ui.sources) ? ui.sources : []), [ui.sources]); // [] = everything
  const groupId = ui.groupId || "";
  const premium = hasPremium(me);
  // Always opens on the partner's own flats.
  const [view, setView] = useState("mine");
  const [searching, setSearching] = useState(false);

  // Demo mode: sample rows for everything a plan unlocks (the partner's own listings stay real).
  const realMine = useMemo(() => (inventory ?? []).filter((l) => inSource(l, "mine")), [inventory]);
  const everything = useMemo(() => {
    if (!demo) return inventory ?? [];
    const d = demoRows(inventory ?? []);
    return [...(realMine.length ? realMine : d.mine), ...d.moveazy, ...d.broker, ...d.group];
  }, [demo, inventory, realMine]);
  const tabGroups = demo ? DEMO_GROUPS : groups;

  // Debounced into the shared UI state, so it is still there on return.
  useEffect(() => {
    const id = setTimeout(() => setUi({ q }), 200);
    return () => clearTimeout(id);
  }, [q, setUi]);

  const inSources = useMemo(() => everything.filter((l) => !inSource(l, "mine")
    && (!sources.length || sources.some((s) => inSource(l, s)))
    && (!groupId || !sources.includes("group") || (l.group_ids || []).includes(groupId))),
  [everything, sources, groupId]);
  const rows = useMemo(() => applyFilters(inSources, filters, ui.q), [inSources, filters, ui.q]);
  const counts = useMemo(() => (demo
    ? { ...DEMO_COUNTS, all: DEMO_COUNTS.moveazy + DEMO_COUNTS.broker + DEMO_COUNTS.group }
    : { ...Object.fromEntries(SOURCE_OPTIONS.map((s) => [s.key, (inventory ?? []).filter((l) => inSource(l, s.key)).length])),
      all: (inventory ?? []).filter((l) => !inSource(l, "mine")).length }),
  [inventory, demo]);
  const liveMine = useMemo(() => myFlats(inventory ?? []).live.length, [inventory]);

  useEffect(() => { setShown(PAGE); }, [sources.join(), filters, ui.q, groupId]); // eslint-disable-line react-hooks/exhaustive-deps
  const { ref: more, inView } = useInView({ rootMargin: "600px" });
  useEffect(() => { if (inView) setShown((n) => n + PAGE); }, [inView]);

  // A dropdown closes on a tap anywhere else.
  useEffect(() => {
    if (!menu) return undefined;
    const away = (e) => { if (!filterRef.current?.contains(e.target)) setMenu(null); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [menu]);

  const open = (kind) => (e) => {
    const box = filterRef.current?.getBoundingClientRect();
    const chip = e.currentTarget.getBoundingClientRect();
    const left = Math.max(0, Math.min(chip.left - (box?.left || 0), (box?.width || 320) - 250));
    setMenu((m) => (m?.kind === kind ? null : { kind, left }));
  };
  const setFilters = (patch) => setUi({ filters: { ...filters, ...patch } });
  const pickSource = (key) => setUi({ sources: key ? [key] : [], groupId: "" });
  const sourceOn = (key) => (key ? sources.length === 1 && sources[0] === key : !sources.length || sources.includes("mine"));

  const nFilters = activeFilterCount(filters);
  const bhkLabel = !filters.bhk.length ? "BHK" : filters.bhk.length === 1 ? filters.bhk[0] : `${filters.bhk[0]} +${filters.bhk.length - 1}`;
  const lockedCount = !demo && !premium ? rows.filter((l) => l.locked).length : 0;

  return (
    <>
      <PartnerHeader>
        <div className="pc-band" role="tablist" aria-label="Whose flats">
          <button type="button" className={`pc-pill${searching || q ? " on" : ""}`} style={{ width: 42, padding: 0, justifyContent: "center", color: searching || q ? "#fff" : "#C8102E" }}
            aria-label="Search" aria-expanded={searching} onClick={() => setSearching((v) => !v)}><Search size={18} strokeWidth={2.4} /></button>
          <button type="button" role="tab" aria-selected={view === "mine"} className={`pc-pill${view === "mine" ? " on" : ""}`} onClick={() => setView("mine")}>
            My inventory <span style={{ opacity: 0.6, fontWeight: 600 }}>{liveMine}</span>
          </button>
          <button type="button" role="tab" aria-selected={view === "all"} className={`pc-pill pc-pill--gold${view === "all" ? " on" : ""}`} onClick={() => setView("all")}>
            All inventory <span style={{ opacity: 0.6, fontWeight: 600 }}>{Number(counts.all || 0).toLocaleString("en-IN")}</span>
          </button>
        </div>
        {(searching || q) && (
          <div className="pz-pad" style={{ background: "#ECE9E2", paddingTop: 0, paddingBottom: 10 }}>
            <label className="pc-search" style={{ width: "100%", boxSizing: "border-box" }}>
              <Search size={18} strokeWidth={2.4} />
              <input type="search" placeholder="Search area, BHK or rent" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search inventory"
                autoFocus={searching && !q} style={{ width: "100%" }} />
              {q && <button type="button" className="pz-iconbtn" style={{ width: 30, height: 30 }} aria-label="Clear search" onClick={() => { setQ(""); setSearching(false); }}><X size={16} /></button>}
            </label>
          </div>
        )}
      </PartnerHeader>
      <style>{FILTER_CSS}</style>

      {view === "mine" ? (
        <div className="pz-pad pz-list"><MyInventory inventory={inventory} query={ui.q} /></div>
      ) : (
      <>

      <div className="pz-pad ih-filters" style={{ paddingBottom: 4 }} ref={filterRef}>
        <div className="pz-chips pz-chips--scroll" style={{ marginBottom: 8 }}>
          <Chip on={sourceOn("")} onClick={() => pickSource("")}>Everything</Chip>
          {SOURCE_OPTIONS.map((o) => (
            <Chip key={o.key} on={sourceOn(o.key)} onClick={() => pickSource(o.key)}>
              {o.label} <span style={{ opacity: 0.6 }}>{Number(counts[o.key] || 0).toLocaleString("en-IN")}</span>
            </Chip>
          ))}
        </div>
        <div className="pz-chips pz-chips--scroll">
          <Chip on={filters.bhk.length > 0} onClick={open("bhk")} aria-expanded={menu?.kind === "bhk"}>{bhkLabel} <ChevronDown size={14} /></Chip>
          <Chip on={filters.brokerageMin > 0} onClick={open("brokerage")} aria-expanded={menu?.kind === "brokerage"}>
            {filters.brokerageMin > 0 ? `${filters.brokerageMin}%+ brokerage` : "Brokerage"} <ChevronDown size={14} />
          </Chip>
          <Chip on={nFilters > 0} onClick={() => { setMenu(null); setSheet(true); }} aria-label="All filters">
            <SlidersHorizontal size={15} />{nFilters > 0 ? ` ${nFilters}` : ""}
          </Chip>
          {(nFilters > 0 || sources.length > 0) && (
            <Chip onClick={() => { setUi({ filters: EMPTY_FILTERS, sources: [], groupId: "" }); setMenu(null); }}><X size={13} /> Clear</Chip>
          )}
        </div>

        {menu && (
          <div className="ih-dd" style={{ left: 16 + menu.left }} role="dialog" aria-label={`${menu.kind} filter`}>
            {menu.kind === "bhk" && (
              <div className="ih-grid">
                {BHK_CHIPS.map((b) => (
                  <button key={b} type="button" className={`ih-pill${filters.bhk.includes(b) ? " on" : ""}`}
                    onClick={() => setFilters({ bhk: filters.bhk.includes(b) ? filters.bhk.filter((x) => x !== b) : [...filters.bhk, b] })}>{b}</button>
                ))}
              </div>
            )}
            {menu.kind === "brokerage" && BROKERAGE_CHIPS.map((c) => (
              <button key={c.label} type="button" className={`ih-opt${filters.brokerageMin === c.min ? " on" : ""}`}
                onClick={() => { setFilters({ brokerageMin: c.min }); setMenu(null); }}>
                <span className="ih-radio">{filters.brokerageMin === c.min && <i />}</span> {c.min ? `${c.label} brokerage` : "Any brokerage"}
              </button>
            ))}
            {menu.kind === "bhk" && (
              <div className="ih-dd-foot">
                <button type="button" className="pz-btn pz-btn--sm" onClick={() => setFilters({ bhk: [] })}>Reset</button>
                <button type="button" className="pz-btn pz-btn--sm pz-btn--primary" onClick={() => setMenu(null)}>Show {rows.length.toLocaleString("en-IN")}</button>
              </div>
            )}
          </div>
        )}
        {sources.length === 1 && sources[0] === "group" && tabGroups.length > 1 && (
          <div className="pz-chips pz-chips--scroll" style={{ paddingTop: 8 }}>
            <Chip on={!groupId} onClick={() => setUi({ groupId: "" })}>All groups</Chip>
            {tabGroups.map((g) => <Chip key={g.id} on={groupId === g.id} onClick={() => setUi({ groupId: g.id })}>{g.name}</Chip>)}
          </div>
        )}
      </div>

      <div className="pz-pad pz-list">
        {inventory && !invError && <p className="pz-meta" style={{ margin: "0 0 2px" }}>{rows.length.toLocaleString("en-IN")} flat{rows.length === 1 ? "" : "s"}</p>}
        {demo && (
          <DemoBanner>Samples from {DEMO_COUNTS.moveazy.toLocaleString("en-IN")} MovEazy, {DEMO_COUNTS.broker} network and {DEMO_COUNTS.group} group listings.</DemoBanner>
        )}
        {lockedCount > 0 && (
          <Link to={pp("/premium")} className="pz-card" style={{ display: "flex", gap: 12, padding: 14, textDecoration: "none",
            color: "inherit", background: "linear-gradient(135deg,#ECFDF3,#FFFBEB)", borderColor: "#BBF7D0" }}>
            <span className="pz-avatar" style={{ background: "var(--g)", color: "#fff" }}><Crown size={17} /></span>
            <span style={{ flex: 1 }}>
              <strong style={{ display: "block" }}>Unlock {lockedCount.toLocaleString("en-IN")} MovEazy listings</strong>
              <span className="pz-meta">Updated daily · owner contacts · {me?.property_share ?? 50}% brokerage. Go Premium →</span>
            </span>
          </Link>
        )}

        {!inventory ? (
          <Loading label="Loading inventory…" />
        ) : invError ? (
          <Empty>{invError}</Empty>
        ) : rows.length === 0 ? (
          <Empty>
            {inSources.length === 0
              ? sources.length === 1 && sources[0] === "group" ? (groups.length ? "Nothing has been shared in your groups yet." : "Join or create a group to see its inventory.")
                : "No inventory here yet."
              : "Nothing matches that search. Try fewer filters."}
          </Empty>
        ) : (
          rows.slice(0, shown).map((l) => (l.demo ? (
            <PropertyCard key={l.property_id} listing={l} saved={false}
              onOpen={() => explain(l.source === "moveazy" ? "moveazy" : "details")}
              onToggleSave={() => explain("save")} onWhatsApp={() => explain("whatsapp")} />
          ) : (
            <PropertyCard key={l.property_id} listing={l} saved={saved.has(l.property_id)}
              onToggleSave={() => toggleSave(l.property_id)}
              onWhatsApp={() => window.open(l.source === "mine" ? waLink("", customerMessage(l)) : listerWhatsApp(l, me?.partner?.name),
                "_blank", "noopener")} />
          )))
        )}
        {rows.length > shown && <div ref={more} className="pz-empty" style={{ padding: 16 }}>Loading more…</div>}
      </div>
      </>
      )}

      {sheet && (
        <FilterSheet value={filters} rows={inSources} query={ui.q} onClose={() => setSheet(false)}
          onApply={(f) => { setUi({ filters: f }); setSheet(false); }} />
      )}
    </>
  );
}

// My inventory, and the small dropdowns under BHK and Brokerage.
const FILTER_CSS = `
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
