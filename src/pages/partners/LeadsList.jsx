/**
 * PRD 08 — the lead book. No chat, no pipeline: All / Active / Closed.
 * Every lead has AI matching one tap away. In demo mode sample tenants sit
 * alongside the partner's own, and premium buttons explain themselves.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, ChevronRight, Plus, Search, Sparkles } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Avatar, Empty, TopBar, WhatsAppIcon } from "./partnerUi";
import { DEMO_LEADS, DemoBanner } from "./demoMode";
import { lastContactedLabel, requirementLine } from "./leadBits";
import { patchLead, pp, waLink } from "../../lib/partners";
import { hasRequirement, matchesForLead } from "../../lib/partnerMatch";

const TABS = [["all", "All"], ["active", "Active"], ["closed", "Closed"]];

export default function LeadsList() {
  const { leads: realLeads, setLeads, inventory, demo, explain } = usePartner();
  const leads = useMemo(() => (demo ? [...realLeads, ...DEMO_LEADS] : realLeads), [demo, realLeads]);
  const [tab, setTab] = useState("active");
  const [q, setQ] = useState("");

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
                  <Link to={pp(`/leads/${lead.id}`)} onClick={lead.demo ? (e) => { e.preventDefault(); explain("ai_match"); } : undefined}
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
                    {demo ? (
                      <button type="button" className="pz-btn pz-btn--sm pz-btn--ai" onClick={() => explain("ai_match")}><Sparkles size={14} /> AI matching</button>
                    ) : (
                      <Link to={pp(`/leads/${lead.id}/matches`)} className="pz-btn pz-btn--sm pz-btn--ai"><Sparkles size={14} /> AI matching</Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
