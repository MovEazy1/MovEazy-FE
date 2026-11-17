/**
 * Sold out / Delete, right on a flat in a list (Inventory, My flats, a
 * group) — what used to be only in a flat's ⋮ menu.
 *
 *   Their own flat   Mark sold out: off MovEazy for tenants and brokers, waits
 *                    in My flats to be made available again.
 *                    Delete: gone for them, tenants and other brokers; MovEazy
 *                    keeps a copy (status "deleted") and the CRM can restore it.
 *   Someone else's   Mark sold out: flagged "potentially rented" until the
 *                    listing broker confirms (as on the flat's page).
 */
import { useState } from "react";
import { Archive, MoreVertical, Trash2 } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Sheet, toast } from "./partnerUi";
import { friendlyError, setListingStatus } from "../../lib/partners";
import { markSoldOut } from "../../lib/partnerCurated";

export default function FlatActions({ listing: l, mine }) {
  const { reloadInventory, demo, explain } = usePartner();
  const [step, setStep] = useState(""); // "" | menu | sold | delete
  const [busy, setBusy] = useState(false);
  const canFlag = !mine && l.status === "published" && l.rent_flag !== "potentially_rented";
  if (!mine && !canFlag) return null;

  const run = async (fn, ok) => {
    if (demo) { setStep(""); explain?.("sold_out"); return; }
    setBusy(true);
    try { await fn(); await reloadInventory?.(); toast(ok); setStep(""); }
    catch (e) { toast(friendlyError(e, "Couldn't do that — try again."), "error"); }
    finally { setBusy(false); }
  };
  const soldOut = () => (mine
    ? run(() => setListingStatus(l.property_id, "rented"), "Marked sold out — it's in My flats if it comes free again")
    : run(() => markSoldOut(l.property_id), "Flagged — MovEazy and the listing broker are told"));
  const remove = () => run(() => setListingStatus(l.property_id, "deleted"), "Flat deleted");

  return (
    <>
      {mine ? (
        <button type="button" className="pz-iconbtn" style={{ flex: "none" }} aria-label="Sold out or delete" disabled={busy}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setStep("menu"); }}>
          <MoreVertical size={20} />
        </button>
      ) : (
        <button type="button" className="pz-btn pz-btn--sm" style={{ flex: "none" }} disabled={busy}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setStep("sold"); }}>
          <Archive size={15} /> Mark sold out
        </button>
      )}

      {step === "menu" && (
        <Sheet title="This flat" onClose={() => setStep("")}>
          {l.status !== "rented" && (
            <button type="button" className="pz-menurow" onClick={() => setStep("sold")}>
              <Archive size={18} /> <span>Mark sold out</span>
            </button>
          )}
          <button type="button" className="pz-menurow" style={{ color: "#B91C1C" }} onClick={() => setStep("delete")}>
            <Trash2 size={18} /> <span>Delete flat</span>
          </button>
        </Sheet>
      )}

      {step === "sold" && (
        <Sheet title="Mark sold out?" onClose={() => setStep("")}>
          <div className="pz-pad">
            <p style={{ margin: "0 0 16px", fontSize: 15, lineHeight: 1.55 }}>
              {mine
                ? "It comes off MovEazy for tenants and other brokers and stops being matched. It waits in My flats — one tap makes it available again."
                : "It shows as “potentially rented” for everyone until the listing broker confirms. MovEazy and the listing broker are told."}
            </p>
            <button type="button" className="pz-btn pz-btn--primary pz-btn--block" disabled={busy} onClick={soldOut}>
              {busy ? "Saving…" : "Yes, it’s sold out"}
            </button>
            <button type="button" className="pz-btn pz-btn--ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => setStep("")}>Cancel</button>
          </div>
        </Sheet>
      )}

      {step === "delete" && (
        <Sheet title="Delete this flat?" onClose={() => setStep("")}>
          <div className="pz-pad">
            <p style={{ margin: "0 0 16px", fontSize: 15, lineHeight: 1.55 }}>
              It disappears from your inventory, from tenants and from other brokers. If you only rented it out, mark it sold out instead —
              then you can bring it back. Deleted by mistake? Ask MovEazy and we can restore it.
            </p>
            <button type="button" className="pz-btn pz-btn--block" style={{ background: "#B91C1C", borderColor: "#B91C1C", color: "#fff" }} disabled={busy} onClick={remove}>
              {busy ? "Deleting…" : "Delete flat"}
            </button>
            <button type="button" className="pz-btn pz-btn--ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => setStep("")}>Keep it</button>
          </div>
        </Sheet>
      )}
    </>
  );
}
