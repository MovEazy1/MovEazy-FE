/** PRD 04 — contacts the broker is permitted to see, and nothing else. */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Crown, Info, Phone } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Avatar, Empty, Loading, TopBar, WhatsAppIcon, formatPhone } from "./partnerUi";
import { bhkLabel, fetchPropertyContacts, pp, telLink, waLink } from "../../lib/partners";

const HEADINGS = { broker: "Primary Broker", owner: "Owner", tenant: "Tenant" };

export default function PropertyContacts() {
  const { id } = useParams();
  const { byId, inventory } = usePartner();
  const l = byId.get(id);
  const [contacts, setContacts] = useState(null);

  useEffect(() => {
    if (!l || l.locked) { setContacts([]); return; }
    fetchPropertyContacts(id).then(setContacts, () => setContacts([]));
  }, [id, l]);

  if (!inventory || contacts === null) return <><TopBar title="Contacts" back /><Loading /></>;
  if (!l || l.locked) {
    return (
      <>
        <TopBar title="Contacts" back />
        <Empty action={<Link to={pp("/premium")} className="pz-btn pz-btn--primary"><Crown size={16} /> See Premium</Link>}>
          Contacts for MovEazy inventory unlock with Premium.
        </Empty>
      </>
    );
  }

  const context = `Hi, about the ${bhkLabel(l)} in ${l.area} (${l.property_id}) on MovEazy — `;
  return (
    <>
      <TopBar title="Contacts" back />
      <div className="pz-pad">
        {contacts.length === 0 && <Empty>No contact details on file for this listing.</Empty>}
        {contacts.map((c) => (
          <div key={`${c.role}-${c.phone}`} className="pz-section">
            <h2>{c.role === "owner" && c.label !== "Owner" ? c.label : HEADINGS[c.role] || c.label}</h2>
            <div className="pz-row">
              <Avatar name={c.name || c.label} size="lg" />
              <span style={{ minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: 16 }}>{c.name || "—"}</strong>
                <span className="pz-meta">{c.role === "broker" ? c.label : c.availability || c.label}{c.verified ? " (verified)" : ""}</span>
                {c.phone && <span className="pz-row" style={{ gap: 6, fontSize: 14, marginTop: 2 }}><Phone size={14} /> {formatPhone(c.phone)}</span>}
              </span>
            </div>
            {c.phone ? (
              <div className="pz-actions">
                <a className="pz-btn pz-btn--soft" href={telLink(c.phone)}><Phone size={17} /> Call</a>
                <a className="pz-btn pz-wa" href={waLink(c.phone, `${context}${c.role === "tenant" ? "when can we visit?" : "is it still available?"}`)}
                  target="_blank" rel="noreferrer"><WhatsAppIcon /> WhatsApp</a>
              </div>
            ) : (
              <p className="pz-meta" style={{ margin: "10px 0 0" }}>Available on request</p>
            )}
          </div>
        ))}
        <p className="pz-meta pz-row" style={{ alignItems: "flex-start", gap: 8 }}>
          <Info size={16} style={{ flex: "none", marginTop: 2 }} />
          Contact details are shared by the listing broker. Please use them responsibly.
        </p>
      </div>
    </>
  );
}
