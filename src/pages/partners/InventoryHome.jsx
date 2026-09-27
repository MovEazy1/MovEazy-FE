/**
 * PRD 01 — Inventory, the home screen. Search, the four sources, quick
 * filters, and cards you can act on without opening.
 *
 * The tab, search, filters and scroll position survive a trip into Details and
 * back (PRD: "Preserve scroll position when returning").
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useInView } from "react-intersection-observer";
import { ChevronDown, Crown, Search, SlidersHorizontal } from "lucide-react";
import { usePartner } from "./PartnerApp";
import FilterSheet from "./FilterSheet";
import { Avatar, Chip, Empty, Loading, PropertyCard } from "./partnerUi";
import { SOURCES, customerMessage, hasPremium, inSource, pp, waLink } from "../../lib/partners";
import { EMPTY_FILTERS, activeFilterCount, applyFilters } from "../../lib/partnerFilters";

const PAGE = 20;

export default function InventoryHome() {
  const { me, inventory, invError, ui, setUi, saved, toggleSave, groups } = usePartner();
  const [q, setQ] = useState(ui.q || "");
  const [sheet, setSheet] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [groupId, setGroupId] = useState(ui.groupId || "");
  const filters = ui.filters || EMPTY_FILTERS;
  const source = ui.source || "moveazy";
  const premium = hasPremium(me);

  // Debounced into the shared UI state, so it is still there on return.
  useEffect(() => {
    const id = setTimeout(() => setUi({ q }), 200);
    return () => clearTimeout(id);
  }, [q, setUi]);

  const inTab = useMemo(
    () => (inventory ?? []).filter((l) => inSource(l, source) && (source !== "group" || !groupId || l.group_ids.includes(groupId))),
    [inventory, source, groupId],
  );
  const rows = useMemo(() => applyFilters(inTab, filters, ui.q), [inTab, filters, ui.q]);
  const counts = useMemo(() => Object.fromEntries(SOURCES.map((s) => [s.key, (inventory ?? []).filter((l) => inSource(l, s.key)).length])),
    [inventory]);

  useEffect(() => { setShown(PAGE); }, [source, filters, ui.q, groupId]);
  const { ref: more, inView } = useInView({ rootMargin: "600px" });
  useEffect(() => { if (inView) setShown((n) => n + PAGE); }, [inView]);

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

  const nFilters = activeFilterCount(filters);
  const lockedCount = source === "moveazy" && !premium ? inTab.length : 0;

  return (
    <>
      <header className="pz-top" style={{ flexDirection: "column", alignItems: "stretch", gap: 10, paddingBottom: 0 }}>
        <div className="pz-between">
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--g2)" }}>Moveazy</h1>
          <span className="pz-chip" style={{ cursor: "default" }}>Bangalore</span>
          <Link to={pp("/more")} aria-label="Your profile" style={{ textDecoration: "none" }}>
            <Avatar name={me?.partner?.name || "You"} />
          </Link>
        </div>
        <div className="pz-search">
          <Search size={17} />
          <input className="pz-input" type="search" placeholder="Search by location, BHK, rent…" value={q}
            onChange={(e) => setQ(e.target.value)} aria-label="Search inventory" />
        </div>
        <div className="pz-tabs" style={{ padding: 0, margin: "0 -16px", paddingInline: 8 }} role="tablist">
          {SOURCES.map((s) => (
            <button key={s.key} type="button" role="tab" aria-selected={source === s.key}
              className={`pz-tab${source === s.key ? " pz-tab--on" : ""}`}
              onClick={() => { setUi({ source: s.key, scrollY: 0 }); window.scrollTo(0, 0); }}>
              {s.label}{inventory ? <span style={{ fontWeight: 500, opacity: 0.7 }}> {counts[s.key]}</span> : null}
            </button>
          ))}
        </div>
      </header>

      <div className="pz-pad" style={{ paddingBottom: 4 }}>
        <div className="pz-chips pz-chips--scroll">
          <Chip on={filters.bhk.length > 0} onClick={() => setSheet(true)}>BHK <ChevronDown size={14} /></Chip>
          <Chip on={Boolean(filters.rentMin || filters.rentMax)} onClick={() => setSheet(true)}>Rent <ChevronDown size={14} /></Chip>
          <Chip on={filters.brokerageMin > 0} onClick={() => setSheet(true)}>
            {filters.brokerageMin > 0 ? `${filters.brokerageMin}%+` : "Brokerage"} <ChevronDown size={14} />
          </Chip>
          <Chip on={nFilters > 0} onClick={() => setSheet(true)} aria-label="All filters">
            <SlidersHorizontal size={15} />{nFilters > 0 ? ` ${nFilters}` : ""}
          </Chip>
          {nFilters > 0 && <Chip onClick={() => setUi({ filters: EMPTY_FILTERS })}>Clear</Chip>}
        </div>
        {source === "group" && groups.length > 1 && (
          <div className="pz-chips pz-chips--scroll" style={{ marginTop: 8 }}>
            <Chip on={!groupId} onClick={() => { setGroupId(""); setUi({ groupId: "" }); }}>All groups</Chip>
            {groups.map((g) => (
              <Chip key={g.id} on={groupId === g.id} onClick={() => { setGroupId(g.id); setUi({ groupId: g.id }); }}>{g.name}</Chip>
            ))}
          </div>
        )}
      </div>

      <div className="pz-pad pz-list">
        {lockedCount > 0 && (
          <Link to={pp("/premium")} className="pz-card" style={{ display: "flex", gap: 12, padding: 14, textDecoration: "none",
            color: "inherit", background: "linear-gradient(135deg,#ECFDF3,#FFFBEB)", borderColor: "#BBF7D0" }}>
            <span className="pz-avatar" style={{ background: "var(--g)", color: "#fff" }}><Crown size={17} /></span>
            <span style={{ flex: 1 }}>
              <strong style={{ display: "block" }}>Unlock {lockedCount.toLocaleString("en-IN")} MovEazy listings</strong>
              <span className="pz-meta">Updated daily · owner contacts · 100% brokerage. Go Premium →</span>
            </span>
          </Link>
        )}

        {!inventory ? (
          <Loading label="Loading inventory…" />
        ) : invError ? (
          <Empty>{invError}</Empty>
        ) : rows.length === 0 ? (
          <Empty action={source === "mine" ? <Link to={pp("/add/property")} className="pz-btn pz-btn--primary">Add a property</Link> : null}>
            {inTab.length === 0
              ? source === "mine" ? "You haven't added a property yet."
                : source === "group" ? (groups.length ? "Nothing has been shared in your groups yet." : "Join or create a group to see its inventory.")
                  : source === "broker" ? "No broker has shared a listing with the network yet." : "No inventory here yet."
              : "Nothing matches that search. Try fewer filters."}
          </Empty>
        ) : (
          rows.slice(0, shown).map((l) => (
            <PropertyCard key={l.property_id} listing={l} saved={saved.has(l.property_id)}
              onToggleSave={() => toggleSave(l.property_id)}
              onWhatsApp={() => window.open(waLink("", customerMessage(l)), "_blank", "noopener")} />
          ))
        )}
        {rows.length > shown && <div ref={more} className="pz-empty" style={{ padding: 16 }}>Loading more…</div>}
      </div>

      {sheet && (
        <FilterSheet value={filters} rows={inTab} query={ui.q} onClose={() => setSheet(false)}
          onApply={(f) => { setUi({ filters: f }); setSheet(false); }} />
      )}
    </>
  );
}
