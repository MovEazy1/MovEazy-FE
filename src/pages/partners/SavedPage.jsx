/** Saved properties — a lightweight favourites list, no collections (PRD 03). */
import { usePartner } from "./PartnerApp";
import { Empty, PropertyCard, TopBar } from "./partnerUi";
import { customerMessage, waLink } from "../../lib/partners";

export default function SavedPage() {
  const { inventory, saved, toggleSave } = usePartner();
  const rows = (inventory ?? []).filter((l) => saved.has(l.property_id));
  return (
    <>
      <TopBar title="Saved properties" back />
      <div className="pz-pad pz-list">
        {rows.length === 0 ? <Empty>Tap the heart on any property to keep it here.</Empty> : rows.map((l) => (
          <PropertyCard key={l.property_id} listing={l} saved onToggleSave={() => toggleSave(l.property_id)}
            onWhatsApp={() => window.open(waLink("", customerMessage(l)), "_blank", "noopener")} />
        ))}
      </div>
    </>
  );
}
