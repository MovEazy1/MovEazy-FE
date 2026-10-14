/**
 * Home's "New lead" card: MovEazy Website leads (a tenant's interest in this
 * partner's flat on moveazy.co.in — lib/websiteLeads.js) the partner hasn't
 * acted on yet. Call / WhatsApp marks them contacted, which takes the card
 * away; Schedule visit opens the tenant to fix one.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Phone, Sparkles } from "lucide-react";
import { useTenants } from "./tenantData";
import { useReach } from "./TenantKit";
import { WhatsAppIcon } from "./partnerUi";
import { inr, pp } from "../../lib/partners";
import { KIND_LABEL, fetchMyWebsiteInterest } from "../../lib/websiteLeads";

export default function NewLeadCard() {
  const { board } = useTenants();
  const reach = useReach();
  const fresh = useMemo(() => (board ?? []).filter((t) => t.pack === "website" && t.stage === "new").slice(0, 3), [board]);
  const [interest, setInterest] = useState(() => new Map());
  const ids = fresh.map((t) => t.assignment_id).join(",");
  useEffect(() => { if (ids) fetchMyWebsiteInterest().then(setInterest); }, [ids]);
  if (!fresh.length) return null;
  return (
    <section className="nl" aria-label="New leads">
      <style>{CSS}</style>
      {fresh.map((t) => {
        const flats = interest.get(t.assignment_id) ?? [];
        const f = flats[0];
        const flat = f ? [f.flat_type, f.area].filter(Boolean).join(" in ") : "";
        const first = String(t.name || "").split(" ")[0] || "there";
        return (
          <div key={t.key} className="nl-card">
            <span className="nl-tag"><Sparkles size={13} /> New lead · MovEazy Website</span>
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
              <Link to={pp(`/tenants/${t.slug}`)} className="nl-btn"><CalendarClock size={15} /> Schedule visit</Link>
            </div>
          </div>
        );
      })}
    </section>
  );
}

const CSS = `
.nl { display: grid; gap: 10px; margin-bottom: 14px; }
.nl-card { border-radius: 18px; padding: 14px; background: linear-gradient(135deg, #0B6E4F, #08503A); color: #fff; box-shadow: 0 10px 24px rgba(8,80,58,.25); }
.nl-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 800; letter-spacing: .02em; background: rgba(255,255,255,.16);
  border-radius: 99px; padding: 3px 9px; }
.nl-who { display: block; margin-top: 8px; color: #fff; text-decoration: none; }
.nl-who b { display: block; font-size: 18px; font-weight: 800; }
.nl-who span { display: block; font-size: 13.5px; color: rgba(255,255,255,.85); margin-top: 2px; }
.nl-acts { display: grid; grid-template-columns: 1fr 1fr 1.3fr; gap: 8px; margin-top: 12px; }
.nl-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 40px; border-radius: 12px; border: 0;
  background: #fff; color: #08503A; font: inherit; font-size: 13.5px; font-weight: 800; text-decoration: none; cursor: pointer; }
.nl-btn--wa { background: #22C55E; color: #fff; }
`;
