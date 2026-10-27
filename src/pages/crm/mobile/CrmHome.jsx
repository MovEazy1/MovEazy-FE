/**
 * CRM → Home, on a phone: what's waiting on the team, today's numbers and how
 * partners are doing — each one opens its list — then every CRM section as a
 * button. Read on open and every hour (CrmShell holds crm_mobile_summary()).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Plus, RefreshCw } from "lucide-react";
import { useCrm } from "../CrmShell";
import { C, Empty } from "../crmUi";
import { GROUPS, PHONE_ONLY, RAIL } from "../crmSections";
import { Metric, PhSection, updatedAt } from "./phoneUi";
import CrmInstallCard from "./CrmInstallCard";
import { fetchTrackedBuildings } from "../../../lib/crmPropertyInternal";

function greeting(now = new Date()) {
  const h = Number(now.toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function CrmHome() {
  const { summary, summaryBusy, loadSummary, access, user } = useCrm();
  const t = summary?.today ?? {};
  const p = summary?.partners ?? {};
  const w = summary?.waiting ?? {};
  const first = String(user?.name || "").split(" ")[0];
  // Buildings whose tenants the team tracks (BR Homes): a bar each, to add and follow them up.
  const [tracked, setTracked] = useState([]);
  useEffect(() => { fetchTrackedBuildings().then(setTracked, () => setTracked([])); }, []);
  const sections = [...PHONE_ONLY.filter((s) => s.to !== "/crm/home"), ...RAIL].filter((s) => !s.scope || access.has(s.scope));

  return (
    <div className="crm-ph-page">
      {tracked.map((b) => (
        <Link key={b.id} to={`/crm/buildings/${b.id}/tenants`}
          style={{ display: "flex", alignItems: "center", gap: 10, background: C.accent, color: "#fff", borderRadius: 12, padding: "12px 14px",
            textDecoration: "none", fontWeight: 800, fontSize: 14.5 }}>
          <Plus size={18} />
          <span style={{ flex: 1, minWidth: 0 }}>
            {b.name} · Add tenant
            <span style={{ display: "block", fontSize: 12, fontWeight: 600, opacity: 0.9 }}>
              {b.tenants} tenant{b.tenants === 1 ? "" : "s"}{b.due ? ` · ${b.due} follow-up${b.due === 1 ? "" : "s"} due` : ""}
            </span>
          </span>
          <ChevronRight size={18} />
        </Link>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 800 }}>{greeting()}{first ? `, ${first}` : ""}</div>
          <div className="crm-ph-note">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            {summary?.at ? ` · ${updatedAt(summary.at)}` : ""}
          </div>
        </div>
        <button type="button" className="crm-btn" onClick={loadSummary} disabled={summaryBusy}>
          <RefreshCw size={15} className={summaryBusy ? "crm-ph-spin" : ""} /> Refresh
        </button>
      </div>

      <CrmInstallCard />

      {!summary && !summaryBusy && <Empty pad={16}>Couldn't load today's numbers. Tap Refresh.</Empty>}

      <PhSection title="Waiting on us">
        <div className="crm-ph-grid">
          <Metric label="Liked a flat, no visit" value={w.liked_no_visit} sub="Last 30 days" to="/crm/notifications?show=liked"
            tone={w.liked_no_visit ? C.coral : undefined} />
          <Metric label="Leads not called" value={(w.not_called_moveazy ?? 0) + (w.not_called_partner ?? 0)}
            sub={`MovEazy ${w.not_called_moveazy ?? 0} · Partners ${w.not_called_partner ?? 0}`} to="/crm/notifications?show=notcalled"
            tone={w.not_called_moveazy || w.not_called_partner ? C.coral : undefined} />
          <Metric label="Visit slots required" value={w.slots_required} to="/crm/notifications?tab=slots" />
          <Metric label="Payments to check" value={w.payments_to_check} sub="Premium + lead pack UTRs" to="/crm/partner-payments?step=utr"
            tone={w.payments_to_check ? C.gold : undefined} />
          <Metric label="Tapped Pay, didn't pay" value={w.tapped_not_paid} sub="Partners, last 30 days" to="/crm/partner-payments?step=tapped" />
          <Metric label="Lead requests to give" value={w.lead_requests}
            to={access.has(RAIL.find((r) => r.to === "/crm/lead-requests")?.scope) ? "/crm/lead-requests" : undefined} />
          <Metric label="Contact messages" value={w.messages} to="/crm/notifications?tab=messages" />
        </div>
      </PhSection>

      <PhSection title="Today">
        <div className="crm-ph-grid crm-ph-grid--3">
          <Metric label="New leads" value={t.new_leads} to="/crm/clients" />
          <Metric label="MovEazy visits" value={t.visits_moveazy} to="/crm/notifications?show=visits" />
          <Metric label="Partner visits" value={t.visits_partner} to="/crm/notifications?show=visits" />
          <Metric label="QR scans" value={t.qr_scans} to="/crm/qr-scans" />
          <Metric label="New flats" value={t.new_flats} to="/crm/properties" />
        </div>
      </PhSection>

      <PhSection title="Partners">
        <div className="crm-ph-grid crm-ph-grid--3">
          <Metric label="Active today" value={p.active_today} to="/crm/partner-usage" />
          <Metric label="Signed up" value={p.signed_up} sub={p.signed_up_today ? `+${p.signed_up_today} today` : undefined} to="/crm/partner-payments" />
          <Metric label="On trial" value={p.on_trial} to="/crm/partner-payments?step=trial" />
          <Metric label="On Premium" value={p.on_premium} to="/crm/partner-payments?step=premium" />
          <Metric label="Flats today" value={p.flats_today} to="/crm/partner-usage" />
          <Metric label="Milestone leads today" value={p.milestone_leads_today} to="/crm/partner-usage" />
        </div>
      </PhSection>

      {GROUPS.map((g) => {
        const list = sections.filter((s) => s.group === g);
        if (!list.length) return null;
        return (
          <PhSection key={g} title={g}>
            <div className="crm-ph-grid crm-ph-grid--3">
              {list.map((s) => {
                const Icon = s.icon;
                return (
                  <Link key={s.to} to={s.to} className="crm-ph-tile"><Icon size={22} />{s.label}</Link>
                );
              })}
            </div>
          </PhSection>
        );
      })}

      <a href="/" className="crm-ph-note" style={{ textAlign: "center", textDecoration: "underline" }}>Back to moveazy.co.in</a>
    </div>
  );
}
