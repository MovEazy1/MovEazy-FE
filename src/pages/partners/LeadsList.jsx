/**
 * PRD 08 — the lead book, in two: My Leads (the broker's own; no chat, no
 * pipeline: All / Active / Closed) and MovEazy leads (MoveazyLeads.jsx).
 * Every lead has AI matching one tap away. In demo mode sample tenants sit
 * alongside the partner's own, and premium buttons explain themselves.
 */
import { Suspense, lazy, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BarChart3, ChevronRight, Plus, Search, Sparkles } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Avatar, Empty, Loading, TopBar, WhatsAppIcon } from "./partnerUi";
import { DEMO_LEADS, DemoBanner } from "./demoMode";
import { lastContactedLabel, requirementLine } from "./leadBits";
import { patchLead, pp, waLink } from "../../lib/partners";
import { hasRequirement, matchesForLead } from "../../lib/partnerMatch";

const TABS = [["all", "All"], ["active", "Active"], ["closed", "Closed"]];

// Its own file, loaded when the tab is opened.
const MoveazyLeads = lazy(() => import("./MoveazyLeads"));

/** My Leads | MovEazy leads, at the top of the screen. */
function BookSwitch({ book, setBook }) {
  return (
    <div className="pz-pad" style={{ paddingBottom: 0, background: "var(--card)" }}>
      <div role="tablist" style={{ display: "flex", background: "var(--bg)", borderRadius: 12, padding: 4, gap: 4 }}>
        {[["mine", "My Leads"], ["moveazy", "MovEazy leads"]].map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={book === k} onClick={() => setBook(k)}
            style={{ flex: 1, padding: "9px 6px", border: 0, borderRadius: 9, font: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer",
              background: book === k ? "var(--card)" : "transparent", color: book === k ? "var(--ink)" : "var(--dim)",
              boxShadow: book === k ? "0 1px 3px rgba(0,0,0,.12)" : "none" }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LeadsList() {
  const { leads: realLeads, setLeads, inventory, demo, explain } = usePartner();
  const leads = useMemo(() => (demo ? [...realLeads, ...DEMO_LEADS] : realLeads), [demo, realLeads]);
  const [tab, setTab] = useState("active");
  const [q, setQ] = useState("");
  const [params, setParams] = useSearchParams();
  const book = params.get("tab") === "moveazy" ? "moveazy" : "mine";
  const setBook = (b) => setParams(b === "moveazy" ? { tab: "moveazy" } : {}, { replace: true });

  const matchCount = useMemo(() => {
    const m = new Map();
    for (const lead of leads) m.set(lead.id, matchesForLead(lead, inventory ?? []).length);
    return m;
  }, [leads, inventory]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return leads.filter((l) => {
      if (tab !== "all" && l.status !== tab) return false;
      if (!needle) return true;
      return String(l.name || "").toLowerCase().includes(needle) || (digits.length >= 3 && String(l.phone).includes(digits));
    });
  }, [leads, tab, q]);

  const counts = {
    all: leads.length,
    active: leads.filter((l) => l.status === "active").length,
    closed: leads.filter((l) => l.status === "closed").length,
  };

  const whatsapp = async (lead) => {
    if (lead.demo) { explain("lead_whatsapp"); return; }
    window.open(waLink(lead.phone, `Hi ${String(lead.name || "").split(" ")[0] || "there"}, `), "_blank", "noopener");
    try {
      const row = await patchLead(lead.id, { last_contacted_at: new Date().toISOString() });
      setLeads((ls) => ls.map((x) => (x.id === row.id ? row : x)));
    } catch { /* timestamp only */ }
  };

  return (
    <>
      <TopBar title="Leads" right={
        <Link to={pp("/leads/new")} className="pz-iconbtn" aria-label="Add lead" style={{ background: "var(--goldg)", color: "#1F1605", borderRadius: 999 }}>
          <Plus size={20} />
        </Link>
      } />
      <BookSwitch book={book} setBook={setBook} />
      {book === "moveazy" ? (
        <Suspense fallback={<Loading />}><MoveazyLeads /></Suspense>
      ) : (
      <>
      <div className="pz-pad" style={{ paddingBottom: 0, background: "var(--card)" }}>
        <div className="pz-search">
          <Search size={17} />
          <input className="pz-input" type="search" placeholder="Search leads by name or mobile…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="pz-tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`pz-tab${tab === k ? " pz-tab--on" : ""}`}
            onClick={() => setTab(k)}>{label} ({counts[k]})</button>
        ))}
      </div>
      <div className="pz-pad">
        {demo && <DemoBanner>Sample tenants are mixed in with yours.</DemoBanner>}
        <Link to={pp("/insights")} onClick={demo ? (e) => { e.preventDefault(); explain("insights"); } : undefined} className="pz-card pz-row"
          style={{ padding: 14, marginBottom: 12, color: "inherit", textDecoration: "none", background: "var(--noir)", borderColor: "var(--noir)" }}>
          <span className="pz-avatar" style={{ background: "var(--goldg)", color: "#1F1605" }}><BarChart3 size={17} /></span>
          <span style={{ flex: 1, color: "#fff" }}><strong style={{ display: "block" }}>Leads dashboard</strong>
            <span style={{ fontSize: 12.5, color: "#A7A3B3" }}>QR scans by area · what clients like · every like & skip</span></span>
          <ChevronRight size={18} color="#D4A437" />
        </Link>
        {rows.length === 0 ? (
          <Empty action={<Link to={pp("/leads/new")} className="pz-btn pz-btn--primary"><Plus size={16} /> Add lead</Link>}>
            {leads.length ? "No leads match." : "Add your first customer — a name and mobile is enough."}
          </Empty>
        ) : (
          <div className="pz-card">
            {rows.map((lead, i) => {
              const n = matchCount.get(lead.id) ?? 0;
              return (
                <div key={lead.id} className="pz-row" style={{ padding: 14, alignItems: "flex-start", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <Avatar name={lead.name} size="lg" />
                  <Link to={pp(lead.demo ? `/leads/${lead.id}/matches` : `/leads/${lead.id}`)}
                    style={{ flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}>
                    <strong style={{ display: "block", fontSize: 16 }}>{lead.name}{lead.demo && <span className="pz-pill pz-pill--grey" style={{ marginLeft: 6, fontSize: 11 }}>Sample</span>}</strong>
                    {requirementLine(lead) && <span style={{ display: "block", fontSize: 14 }}>{requirementLine(lead)}</span>}
                    {(lead.localities ?? []).length > 0 && <span className="pz-meta" style={{ display: "block" }}>{lead.localities.join(", ")}</span>}
                    <span style={{ display: "block", color: "var(--g)", fontWeight: 600, fontSize: 13.5, marginTop: 2 }}>
                      {hasRequirement(lead) ? `${n} matching propert${n === 1 ? "y" : "ies"}` : "Add a requirement to see matches"}
                    </span>
                    <span className="pz-hint">{lastContactedLabel(lead.last_contacted_at)}</span>
                  </Link>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <button type="button" className="pz-iconbtn" aria-label={`WhatsApp ${lead.name}`} onClick={() => whatsapp(lead)}
                      style={{ background: "var(--goldg)", color: "#1F1605", borderRadius: 999, width: 34, height: 34 }}>
                      <WhatsAppIcon size={18} />
                    </button>
                    <Link to={pp(`/leads/${lead.id}/matches`)} className="pz-btn pz-btn--sm pz-btn--ai"><Sparkles size={14} /> AI matching</Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>
      )}
    </>
  );
}
