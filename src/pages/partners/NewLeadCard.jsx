/**
 * Home's new MovEazy Website leads (a tenant's interest in this partner's flat
 * on moveazy.co.in — lib/websiteLeads.js) the partner hasn't acted on yet.
 *
 * A slim floating pill above the tab bar — "Take follow up with tenants · 3
 * new" — so Home stays visible. Tap: a sheet with each tenant and WhatsApp /
 * Call / Schedule visit. Call / WhatsApp marks them contacted, which takes
 * them off the list; Schedule visit opens the tenant to fix one.
 *
 * `raised`: the live-visit bubble is showing, so sit above it.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ChevronUp, Phone, Sparkles } from "lucide-react";
import { useTenants } from "./tenantData";
import { useReach } from "./TenantKit";
import { Sheet, WhatsAppIcon } from "./partnerUi";
import { inr, pp } from "../../lib/partners";
import { KIND_LABEL, fetchMyWebsiteInterest } from "../../lib/websiteLeads";

export default function NewLeadCard({ raised = false }) {
  const { board } = useTenants();
  const reach = useReach();
  const fresh = useMemo(() => (board ?? []).filter((t) => t.pack === "website" && t.stage === "new"), [board]);
  const [interest, setInterest] = useState(() => new Map());
  const [open, setOpen] = useState(false);
  const ids = fresh.map((t) => t.assignment_id).join(",");
  useEffect(() => { if (ids) fetchMyWebsiteInterest().then(setInterest); }, [ids]);
  // The last one followed up: close the sheet with it.
  useEffect(() => { if (!fresh.length) setOpen(false); }, [fresh.length]);
  if (!fresh.length) return null;
  return (
    <>
      {/* Only while the pill shows: room under Home's last card, so the pill never hides it. */}
      <style>{CSS + `.ph { padding-bottom: ${raised ? 100 : 44}px; }`}</style>
      {!open && (
        <button type="button" className={`nl-pill${raised ? " nl-pill--raised" : ""}`} onClick={() => setOpen(true)}
          aria-label={`Take follow up with tenants: ${fresh.length} new`}>
          <Sparkles size={13} />
          <span>Take follow up with tenants</span>
          <b>{fresh.length} new</b>
          <ChevronUp size={14} />
        </button>
      )}
      {open && (
        <Sheet title="Take follow up with tenants" onClose={() => setOpen(false)}>
          <div className="nl-list">
            <p className="pz-hint" style={{ margin: "0 0 4px" }}>New leads from the MovEazy Website. Call or WhatsApp to take them off this list.</p>
            {fresh.map((t) => {
              const flats = interest.get(t.assignment_id) ?? [];
              const f = flats[0];
              const flat = f ? [f.flat_type, f.area].filter(Boolean).join(" in ") : "";
              const first = String(t.name || "").split(" ")[0] || "there";
              return (
                <div key={t.key} className="nl-row">
                  <Link to={pp(`/tenants/${t.slug}`)} className="nl-who">
                    <b>{t.name || "A tenant"}</b>
                    <span>
                      {f ? `${KIND_LABEL[f.kind] || "Interested in"} your ${flat}${Number(f.rent) > 0 ? ` · ${inr(f.rent)}` : ""}` : "Interested in your flat"}
                      {flats.length > 1 ? ` · +${new Set(flats.map((x) => x.property_id)).size - 1} more` : ""}
                    </span>
                  </Link>
                  <div className="nl-acts">
                    <button type="button" className="nl-btn nl-btn--wa" onClick={() => reach(t, "whatsapp",
                      `Hi ${first}, this is your broker from MovEazy — you were looking at my ${flat || "flat"}. When would you like to see it?`)}>
                      <WhatsAppIcon size={15} /> WhatsApp
                    </button>
                    <button type="button" className="nl-btn" onClick={() => reach(t, "call")}><Phone size={15} /> Call</button>
                    <Link to={pp(`/tenants/${t.slug}`)} className="nl-btn"><CalendarClock size={15} /> Visit</Link>
                  </div>
                </div>
              );
            })}
          </div>
        </Sheet>
      )}
    </>
  );
}

const CSS = `
.nl-pill { position: fixed; z-index: 40; left: 50%; transform: translateX(-50%); bottom: calc(84px + env(safe-area-inset-bottom));
  display: inline-flex; align-items: center; gap: 6px; height: 30px; max-width: calc(100vw - 32px); padding: 0 10px 0 11px;
  border: 0; border-radius: 999px; background: linear-gradient(135deg, #0B6E4F, #08503A); color: #fff; box-shadow: 0 6px 16px rgba(8,80,58,.32);
  font: inherit; font-size: 12.5px; font-weight: 700; white-space: nowrap; cursor: pointer; }
.nl-pill > span { overflow: hidden; text-overflow: ellipsis; }
.nl-pill b { flex: none; background: #fff; color: #08503A; border-radius: 99px; padding: 1px 7px; font-size: 11.5px; font-weight: 800; }
.nl-pill svg { flex: none; }
.nl-pill--raised { bottom: calc(142px + env(safe-area-inset-bottom)); }
.nl-list { display: grid; gap: 10px; padding: 4px 14px 18px; }
.nl-row { border: 1px solid var(--line); border-radius: 14px; padding: 12px; }
.nl-who { display: block; color: var(--ink); text-decoration: none; }
.nl-who b { display: block; font-size: 15.5px; font-weight: 800; }
.nl-who span { display: block; font-size: 13px; color: var(--dim); margin-top: 2px; }
.nl-acts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
.nl-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 38px; border-radius: 10px;
  border: 1px solid var(--line); background: #fff; color: #08503A; font: inherit; font-size: 13px; font-weight: 800; text-decoration: none; cursor: pointer; }
.nl-btn--wa { background: #22C55E; border-color: #22C55E; color: #fff; }
`;
