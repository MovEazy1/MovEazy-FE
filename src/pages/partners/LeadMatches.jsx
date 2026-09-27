/**
 * PRD 11 — the bridge between Leads and Inventory. Every flat the caller may
 * see, scored against this lead; WhatsApp sends it straight to the lead.
 */
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowUpDown, SlidersHorizontal } from "lucide-react";
import { usePartner } from "./PartnerApp";
import FilterSheet from "./FilterSheet";
import { useSendToLead } from "./LeadDetail";
import { Avatar, Chip, Empty, Loading, PropertyCard, TopBar } from "./partnerUi";
import { requirementLine } from "./leadBits";
import { pp } from "../../lib/partners";
import { matchesForLead } from "../../lib/partnerMatch";
import { EMPTY_FILTERS, activeFilterCount, applyFilters } from "../../lib/partnerFilters";

const SORTS = [["match", "Best match"], ["rent", "Rent: low to high"], ["brokerage", "Brokerage: high to low"]];

export default function LeadMatches() {
  const { id } = useParams();
  const { leads, inventory, saved, toggleSave } = usePartner();
  const lead = leads.find((l) => l.id === id);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sheet, setSheet] = useState(false);
  const [sort, setSort] = useState("match");
  const [sortOpen, setSortOpen] = useState(false);
  const send = useSendToLead(lead || { id, name: "", phone: "" });

  const all = useMemo(() => (lead ? matchesForLead(lead, inventory ?? []) : []), [lead, inventory]);
  const rows = useMemo(() => {
    const keep = new Set(applyFilters(all.map((m) => m.listing), filters).map((l) => l.property_id));
    const list = all.filter((m) => keep.has(m.listing.property_id));
    if (sort === "rent") list.sort((a, b) => (Number(a.listing.rent) || 0) - (Number(b.listing.rent) || 0));
    if (sort === "brokerage") list.sort((a, b) => (Number(b.listing.brokerage_pct) || 0) - (Number(a.listing.brokerage_pct) || 0));
    return list;
  }, [all, filters, sort]);

  if (!lead) return <><TopBar title="Matching Properties" back={pp("/leads")} />{leads.length ? <Empty>Lead not found.</Empty> : <Loading />}</>;

  const n = activeFilterCount(filters);
  return (
    <>
      <TopBar title="Matching Properties" back={pp(`/leads/${id}`)} right={
        <div className="pz-row" style={{ gap: 0 }}>
          <button type="button" className="pz-iconbtn" aria-label="Sort" onClick={() => setSortOpen((o) => !o)}><ArrowUpDown size={20} /></button>
          <button type="button" className="pz-iconbtn" aria-label="Filter" onClick={() => setSheet(true)} style={n ? { color: "var(--g)" } : undefined}>
            <SlidersHorizontal size={20} />
          </button>
        </div>
      } />
      <div className="pz-pad" style={{ background: "var(--card)", borderBottom: "1px solid var(--line)" }}>
        <div className="pz-row">
          <Avatar name={lead.name} size="lg" />
          <div>
            <strong style={{ display: "block", fontSize: 16 }}>{lead.name}</strong>
            <span className="pz-meta">{[requirementLine(lead), (lead.localities ?? []).join(", ")].filter(Boolean).join(" • ")}</span>
            <span style={{ display: "block", fontSize: 13.5, color: "var(--g)", fontWeight: 600 }}>{rows.length} matching properties</span>
          </div>
        </div>
        {sortOpen && (
          <div className="pz-chips" style={{ marginTop: 10 }}>
            {SORTS.map(([k, label]) => <Chip key={k} on={sort === k} onClick={() => { setSort(k); setSortOpen(false); }}>{label}</Chip>)}
          </div>
        )}
      </div>
      <div className="pz-pad pz-list">
        {!inventory ? <Loading /> : rows.length === 0 ? (
          <Empty>{all.length ? "No matches with those filters." : "Nothing matches this requirement yet."}</Empty>
        ) : rows.map((m) => (
          <PropertyCard key={m.listing.property_id} listing={m.listing} saved={saved.has(m.listing.property_id)}
            onToggleSave={() => toggleSave(m.listing.property_id)} onWhatsApp={() => send(m.listing)}
            extra={
              <div className="pz-row" style={{ marginTop: 10, gap: 8 }}>
                <span className="pz-score" title="Match score">{m.score}</span>
                <span className="pz-meta">{m.reasons.join(" · ") || "Partial match"}</span>
              </div>
            } />
        ))}
      </div>
      {sheet && (
        <FilterSheet value={filters} rows={all.map((m) => m.listing)} onClose={() => setSheet(false)}
          onApply={(f) => { setFilters(f); setSheet(false); }} />
      )}
    </>
  );
}
