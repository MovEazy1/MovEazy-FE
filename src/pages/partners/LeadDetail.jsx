/** PRD 10 — a lead is a requirement to map onto inventory, not a conversation. */
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Building2, IndianRupee, MapPin, Phone } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Avatar, Empty, Loading, PropertyCard, TopBar, WhatsAppIcon, formatPhone, toast } from "./partnerUi";
import { budgetLabel, lastContactedLabel } from "./leadBits";
import { customerMessage, friendlyError, patchLead, pp, waLink } from "../../lib/partners";
import { hasRequirement, matchesForLead } from "../../lib/partnerMatch";

export function useSendToLead(lead) {
  const { setLeads } = usePartner();
  return async (listing) => {
    window.open(waLink(lead.phone, listing ? customerMessage(listing, { leadName: lead.name }) : `Hi ${lead.name.split(" ")[0]}, `),
      "_blank", "noopener");
    try {
      const row = await patchLead(lead.id, { last_contacted_at: new Date().toISOString() });
      setLeads((ls) => ls.map((x) => (x.id === row.id ? row : x)));
    } catch { /* timestamp only */ }
  };
}

export default function LeadDetail() {
  const { id } = useParams();
  const { leads, inventory, setLeads, saved, toggleSave } = usePartner();
  const lead = leads.find((l) => l.id === id);
  const matches = useMemo(() => (lead ? matchesForLead(lead, inventory ?? []) : []), [lead, inventory]);
  const send = useSendToLead(lead || { id, name: "", phone: "" });

  if (!lead) return <><TopBar title="Lead" back={pp("/leads")} />{leads.length ? <Empty>Lead not found.</Empty> : <Loading />}</>;

  const toggleStatus = async () => {
    try {
      const row = await patchLead(lead.id, { status: lead.status === "closed" ? "active" : "closed" });
      setLeads((ls) => ls.map((x) => (x.id === row.id ? row : x)));
      toast(row.status === "closed" ? "Marked closed" : "Reopened");
    } catch (e) {
      toast(friendlyError(e), "error");
    }
  };

  return (
    <>
      <TopBar title="Lead" back={pp("/leads")} right={<Link to={pp(`/leads/${id}/edit`)} className="pz-btn pz-btn--ghost">Edit</Link>} />
      <div className="pz-pad">
        <div className="pz-section pz-row">
          <Avatar name={lead.name} size="lg" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: 19 }}>{lead.name}</strong>
            <span className="pz-row" style={{ gap: 6, fontSize: 14 }}><Phone size={14} /> {formatPhone(lead.phone)}</span>
            <span className="pz-hint">{lastContactedLabel(lead.last_contacted_at)}</span>
          </div>
          <button type="button" aria-label={`WhatsApp ${lead.name}`} onClick={() => send(null)}
            className="pz-iconbtn" style={{ background: "#22C55E", color: "#fff", borderRadius: 999, width: 44, height: 44 }}>
            <WhatsAppIcon size={22} />
          </button>
        </div>

        <div className="pz-section">
          <h2>Requirement <Link to={pp(`/leads/${id}/edit`)} className="pz-btn pz-btn--ghost">Edit</Link></h2>
          {hasRequirement(lead) ? (
            <div style={{ display: "grid", gap: 8, fontSize: 15 }}>
              {(lead.flat_types ?? []).length > 0 && <span className="pz-row" style={{ gap: 8 }}><Building2 size={17} color="var(--dim)" /> {lead.flat_types.join(", ")}</span>}
              {budgetLabel(lead) && <span className="pz-row" style={{ gap: 8 }}><IndianRupee size={17} color="var(--dim)" /> {budgetLabel(lead)}</span>}
              {(lead.localities ?? []).length > 0 && <span className="pz-row" style={{ gap: 8 }}><MapPin size={17} color="var(--dim)" /> {lead.localities.join(", ")}</span>}
              {lead.furnishing && <span className="pz-meta">{lead.furnishing}</span>}
              {lead.notes && <span className="pz-meta" style={{ whiteSpace: "pre-wrap" }}>{lead.notes}</span>}
            </div>
          ) : (
            <Link to={pp(`/leads/${id}/edit`)} className="pz-btn pz-btn--soft" style={{ width: "100%" }}>Add BHK, budget and locations</Link>
          )}
        </div>

        <div className="pz-between" style={{ margin: "4px 0 10px" }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Matching Properties{hasRequirement(lead) ? ` (${matches.length})` : ""}</h2>
          {matches.length > 3 && <Link to={pp(`/leads/${id}/matches`)} className="pz-btn pz-btn--ghost">View All</Link>}
        </div>
        <div className="pz-list">
          {!hasRequirement(lead) ? null : matches.length === 0 ? (
            <Empty>No inventory fits yet. Try widening the budget or adding nearby areas.</Empty>
          ) : matches.slice(0, 3).map((m) => (
            <PropertyCard key={m.listing.property_id} listing={m.listing} saved={saved.has(m.listing.property_id)}
              onToggleSave={() => toggleSave(m.listing.property_id)} onWhatsApp={() => send(m.listing)} />
          ))}
        </div>

        <button type="button" className="pz-btn" style={{ width: "100%", marginTop: 16 }} onClick={toggleStatus}>
          {lead.status === "closed" ? "Reopen lead" : "Mark as closed"}
        </button>
      </div>
    </>
  );
}
