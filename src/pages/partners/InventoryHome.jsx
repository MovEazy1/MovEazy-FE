/**
 * PRD 01 — Inventory, the Inventory tab: one list of everything the partner
 * can see, and cards you can act on without opening. (Home is PartnerHome.jsx.)
 *
 * Under the search, big pills pick the source — All · MovEazy · Brokers ·
 * Groups · Mine — then a row of BHK | Brokerage | ⚙: the first two open small
 * dropdowns; only ⚙ opens the full filter sheet.
 *
 * Search, filters and scroll position survive a trip into Details and back
 * (PRD: "Preserve scroll position when returning").
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useInView } from "react-intersection-observer";
import { ChevronDown, Crown, Search, SlidersHorizontal, X } from "lucide-react";
import { usePartner } from "./PartnerApp";
import FilterSheet from "./FilterSheet";
import { Chip, Empty, Loading, PropertyCard } from "./partnerUi";
import { PartnerHeader } from "./PartnerChrome";
import { DEMO_COUNTS, DEMO_GROUPS, DemoBanner, demoRows } from "./demoMode";
import { customerMessage, hasPremium, inSource, listerWhatsApp, pp, waLink } from "../../lib/partners";
import { BHK_CHIPS, BROKERAGE_CHIPS, EMPTY_FILTERS, activeFilterCount, applyFilters } from "../../lib/partnerFilters";

const PAGE = 20;
const SOURCE_OPTIONS = [
  { key: "moveazy", label: "MovEazy" },
  { key: "broker", label: "Brokers" },
  { key: "group", label: "Groups" },
  { key: "mine", label: "Mine" },
];

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

  const inSources = useMemo(() => everything.filter((l) =>
    (!sources.length || sources.some((s) => inSource(l, s)))
    && (!groupId || !sources.includes("group") || (l.group_ids || []).includes(groupId))),
  [everything, sources, groupId]);
  const rows = useMemo(() => applyFilters(inSources, filters, ui.q), [inSources, filters, ui.q]);
  const counts = useMemo(() => (demo
    ? { ...DEMO_COUNTS, mine: realMine.length || DEMO_COUNTS.mine }
    : Object.fromEntries(SOURCE_OPTIONS.map((s) => [s.key, (inventory ?? []).filter((l) => inSource(l, s.key)).length]))),
  [inventory, demo, realMine]);

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

  // Scroll: restore once the list exists, remember on the way out.
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (restored.current || !inventory) return;
    restored.current = true;
    if (ui.scrollY) {
      setShown(Math.max(PAGE, ui.shown || PAGE));
      requestAnimationFrame(() => window.scrollTo(0, ui.scrollY));
    }
  }, [inventory, ui.scrollY, ui.shown]);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  useEffect(() => () => setUi({ scrollY: window.scrollY, shown: shownRef.current }), [setUi]);

  const open = (kind) => (e) => {
    const box = filterRef.current?.getBoundingClientRect();
    const chip = e.currentTarget.getBoundingClientRect();
    const left = Math.max(0, Math.min(chip.left - (box?.left || 0), (box?.width || 320) - 250));
    setMenu((m) => (m?.kind === kind ? null : { kind, left }));
  };
  const setFilters = (patch) => setUi({ filters: { ...filters, ...patch } });
  const pickSource = (key) => setUi({ sources: key ? [key] : [], groupId: "" });
  const sourceOn = (key) => (key ? sources.length === 1 && sources[0] === key : !sources.length);

  const nFilters = activeFilterCount(filters);
  const bhkLabel = !filters.bhk.length ? "BHK" : filters.bhk.length === 1 ? filters.bhk[0] : `${filters.bhk[0]} +${filters.bhk.length - 1}`;
  const lockedCount = !demo && !premium ? rows.filter((l) => l.locked).length : 0;

  return (
    <>
      <PartnerHeader>
        <div className="pc-band" role="toolbar" aria-label="Whose flats">
          <label className="pc-search">
            <Search size={18} strokeWidth={2.4} />
            <input type="search" placeholder="Search area or BHK" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search inventory" />
          </label>
          <button type="button" className={`pc-pill${sourceOn("") ? " on" : ""}`} aria-pressed={sourceOn("")} onClick={() => pickSource("")}>All</button>
          {SOURCE_OPTIONS.map((s) => (
            <button key={s.key} type="button" className={`pc-pill${sourceOn(s.key) ? " on" : ""}`} aria-pressed={sourceOn(s.key)} onClick={() => pickSource(s.key)}>
              {s.label} <span style={{ opacity: 0.6, fontWeight: 600 }}>{Number(counts[s.key] || 0).toLocaleString("en-IN")}</span>
            </button>
          ))}
        </div>
      </PartnerHeader>

      <div className="pz-pad ih-filters" style={{ paddingBottom: 4 }} ref={filterRef}>
        <style>{FILTER_CSS}</style>
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
          <Empty action={sources.length === 1 && sources[0] === "mine" ? <Link to={pp("/add/property")} className="pz-btn pz-btn--primary">Add a property</Link> : null}>
            {inSources.length === 0
              ? sources.length === 1 && sources[0] === "mine" ? "You haven't added a property yet."
                : sources.length === 1 && sources[0] === "group" ? (groups.length ? "Nothing has been shared in your groups yet." : "Join or create a group to see its inventory.")
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

      {sheet && (
        <FilterSheet value={filters} rows={inSources} query={ui.q} onClose={() => setSheet(false)}
          onApply={(f) => { setUi({ filters: f }); setSheet(false); }} />
      )}
    </>
  );
}

// The small dropdowns under BHK and Brokerage.
const FILTER_CSS = `
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
