/**
 * AI matching for one lead: every flat the broker can see, scored against the
 * tenant's needs. The best ten are pre-picked; the broker adjusts and taps
 * "Send curated list" — one link on WhatsApp, which the tenant swipes through
 * (/c/<token>). Likes come back as notifications (lib/partnerCurated.js).
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowUpDown, Check, SlidersHorizontal, Sparkles } from "lucide-react";
import { usePartner } from "./PartnerApp";
import FilterSheet from "./FilterSheet";
import { useSendToLead } from "./LeadDetail";
import { Avatar, Chip, Empty, Loading, PropertyCard, Sheet, TopBar, toast } from "./partnerUi";
import ShareOptions from "./ShareOptions";
import { requirementLine } from "./leadBits";
import { friendlyError, pp } from "../../lib/partners";
import { matchesForLead } from "../../lib/partnerMatch";
import { EMPTY_FILTERS, activeFilterCount, applyFilters } from "../../lib/partnerFilters";
import { createCuratedList, curatedMessage, curatedUrl } from "../../lib/partnerCurated";
import { DemoListPreview, useMatchPool } from "./AiMatcher";
import { DEMO_LEADS, DemoBanner } from "./demoMode";

const SORTS = [["match", "Best match"], ["rent", "Rent: low to high"], ["brokerage", "Brokerage: high to low"]];
const PRESELECT = 10;

export default function LeadMatches() {
  const { id } = useParams();
  const { me, leads, inventory, saved, toggleSave, demo, explain } = usePartner();
  const lead = leads.find((l) => l.id === id) || (demo ? DEMO_LEADS.find((l) => l.id === id) : null);
  const pool = useMatchPool();
  const [preview, setPreview] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sheet, setSheet] = useState(false);
  const [sort, setSort] = useState("match");
  const [sortOpen, setSortOpen] = useState(false);
  const [picked, setPicked] = useState(null); // Set of property ids, once matches exist
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);
  const send = useSendToLead(lead || { id, name: "", phone: "" });

  const all = useMemo(() => (lead ? matchesForLead(lead, pool) : []), [lead, pool]);
  const rows = useMemo(() => {
    const keep = new Set(applyFilters(all.map((m) => m.listing), filters).map((l) => l.property_id));
    const list = all.filter((m) => keep.has(m.listing.property_id));
    if (sort === "rent") list.sort((a, b) => (Number(a.listing.rent) || 0) - (Number(b.listing.rent) || 0));
    if (sort === "brokerage") list.sort((a, b) => (Number(b.listing.brokerage_pct) || 0) - (Number(a.listing.brokerage_pct) || 0));
    return list;
  }, [all, filters, sort]);

  // The best ten, picked for them the first time matches arrive.
  useEffect(() => {
    if (picked || !all.length) return;
    setPicked(new Set(all.slice(0, PRESELECT).map((m) => m.listing.property_id)));
  }, [all, picked]);

  if (!lead) return <><TopBar title="AI matching" back={pp("/leads")} />{leads.length ? <Empty>Lead not found.</Empty> : <Loading />}</>;

  const toggle = (pid) => setPicked((cur) => {
    const n = new Set(cur || []);
    if (n.has(pid)) n.delete(pid); else if (n.size < 30) n.add(pid); else toast("Up to 30 homes in one list.", "error");
    return n;
  });
  const count = picked?.size || 0;

  const create = async () => {
    if (demo) { if (count) setPreview(true); else explain("curated"); return; }
    if (!count) { toast("Pick at least one home.", "error"); return; }
    setBusy(true);
    try {
      const ordered = all.map((m) => m.listing.property_id).filter((pid) => picked.has(pid));
      const r = await createCuratedList(lead.id, ordered);
      setSent(r);
    } catch (e) {
      toast(friendlyError(e, "Could not make the list."), "error");
    } finally {
      setBusy(false);
    }
  };

  const n = activeFilterCount(filters);
  return (
    <>
      <TopBar title="AI matching" back={pp(`/leads/${id}`)} right={
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
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13.5, color: "var(--g)", fontWeight: 600 }}>
              <Sparkles size={14} /> {rows.length} matches · {count} picked for the list
            </span>
          </div>
        </div>
        {sortOpen && (
          <div className="pz-chips" style={{ marginTop: 10 }}>
            {SORTS.map(([k, label]) => <Chip key={k} on={sort === k} onClick={() => { setSort(k); setSortOpen(false); }}>{label}</Chip>)}
          </div>
        )}
      </div>
      <div className="pz-pad pz-list" style={{ paddingBottom: 110 }}>
        {demo && <DemoBanner>Sample homes — try the curated list, then send for real with Premium.</DemoBanner>}
        {!inventory ? <Loading /> : rows.length === 0 ? (
          <Empty action={<Link className="pz-btn" to={pp(`/leads/${id}/edit`)}>Edit requirement</Link>}>
            {all.length ? "No matches with those filters." : "Nothing matches this requirement yet."}
          </Empty>
        ) : rows.map((m) => {
          const on = picked?.has(m.listing.property_id);
          return (
            <PropertyCard key={m.listing.property_id} listing={m.listing} saved={saved.has(m.listing.property_id)}
              onToggleSave={() => toggleSave(m.listing.property_id)} onWhatsApp={() => send(m.listing)}
              extra={
                <div className="pz-row" style={{ marginTop: 10, gap: 8 }}>
                  <span className="pz-score" title="Match score">{m.score}</span>
                  <span className="pz-meta" style={{ flex: 1 }}>{m.reasons.join(" · ") || "Partial match"}</span>
                  <button type="button" onClick={() => toggle(m.listing.property_id)} aria-pressed={on}
                    className={`pz-btn pz-btn--sm${on ? " pz-btn--primary" : ""}`}>{on ? <><Check size={14} /> In list</> : "+ Add"}</button>
                </div>
              } />
          );
        })}
      </div>

      {rows.length > 0 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(64px + env(safe-area-inset-bottom))", zIndex: 25, maxWidth: 520, margin: "0 auto",
          padding: "10px 16px", background: "linear-gradient(rgba(246,247,246,0), var(--bg) 30%)" }}>
          <button type="button" className="pz-btn pz-btn--ai pz-btn--block" onClick={create} disabled={busy || !count}>
            <Sparkles size={18} /> {busy ? "Making the list…" : `Send curated list · ${count} home${count === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

      {preview && (
        <DemoListPreview lead={lead} onClose={() => setPreview(false)}
          homes={all.map((m) => m.listing).filter((l) => picked?.has(l.property_id))} />
      )}
      {sent && (
        <Sheet title="Curated list ready" onClose={() => setSent(null)}>
          <div className="pz-pad">
            <p style={{ margin: "0 0 14px", fontSize: 15, lineHeight: 1.55 }}>
              {lead.name.split(" ")[0]} swipes through your {sent.count} pick{sent.count === 1 ? "" : "s"} on their phone. You’ll get a notification the moment they like one.
            </p>
            <ShareOptions url={curatedUrl(sent.token)} phone={lead.phone}
              waLabel={`WhatsApp ${lead.no_name ? "client" : lead.name.split(" ")[0]}`}
              message={curatedMessage(sent.token, { leadName: lead.no_name ? "" : lead.name, count: sent.count, brokerName: me?.partner?.name })}
              post={`${sent.count} verified rental homes picked for you — swipe and tap ♥ on the ones you like.`} />
            <Link className="pz-btn pz-btn--block" style={{ marginTop: 12 }} to={pp(`/curated/${sent.id}`)}>Track opens, likes & skips</Link>
          </div>
        </Sheet>
      )}

      {sheet && (
        <FilterSheet value={filters} rows={all.map((m) => m.listing)} onClose={() => setSheet(false)}
          onApply={(f) => { setFilters(f); setSheet(false); }} />
      )}
    </>
  );
}
