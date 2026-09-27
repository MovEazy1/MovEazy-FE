/** Your own listing: who sees it, the brokerage per audience, rent, and the private contacts. */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePartner } from "./PartnerApp";
import ShareWithForm, { fromSharing, toSharing } from "./ShareWithForm";
import { Empty, Loading, TopBar, toast } from "./partnerUi";
import { supabase } from "../../lib/supabase";
import { normalizeIndianMobile } from "../../lib/mobile";
import { friendlyError, pp, saveOwnContacts, saveSharing, updatePartnerListing } from "../../lib/partners";

export default function EditSharing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { byId, groups, reloadInventory } = usePartner();
  const l = byId.get(id);
  const [share, setShare] = useState(null);
  const [rent, setRent] = useState("");
  const [c, setC] = useState({ ownerName: "", ownerPhone: "", tenantName: "", tenantPhone: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!l || l.source !== "mine") return;
    setRent(String(l.rent || ""));
    (async () => {
      const [{ data: sharing }, { data: contacts }] = await Promise.all([
        supabase.rpc("partner_listing_sharing", { p_property: id }),
        supabase.from("partner_property_contacts").select("role,name,phone").eq("property_id", id),
      ]);
      setShare(fromSharing(sharing));
      const by = Object.fromEntries((contacts ?? []).map((x) => [x.role, x]));
      setC({ ownerName: by.owner?.name || "", ownerPhone: by.owner?.phone || "", tenantName: by.tenant?.name || "", tenantPhone: by.tenant?.phone || "" });
    })();
  }, [id, l]);

  if (!l) return <><TopBar title="Edit listing" back /><Loading /></>;
  if (l.source !== "mine") return <><TopBar title="Edit listing" back /><Empty>Only the broker who added this listing can change it.</Empty></>;
  if (!share) return <><TopBar title="Edit listing" back /><Loading /></>;

  const save = async () => {
    if (!(Number(rent) >= 1000)) return toast("Enter the monthly rent", "error");
    for (const k of ["ownerPhone", "tenantPhone"]) {
      if (c[k] && !normalizeIndianMobile(c[k])) return toast("Contact numbers must be 10-digit mobiles", "error");
    }
    setSaving(true);
    try {
      if (Number(rent) !== Number(l.rent)) await updatePartnerListing(id, { rent: Number(rent) });
      await saveSharing(id, toSharing(share));
      await saveOwnContacts(id, [
        { role: "owner", name: c.ownerName, phone: normalizeIndianMobile(c.ownerPhone) },
        { role: "tenant", name: c.tenantName, phone: normalizeIndianMobile(c.tenantPhone) },
      ]);
      await reloadInventory();
      toast("Saved");
      navigate(pp(`/property/${id}`), { replace: true });
    } catch (e) {
      toast(friendlyError(e, "Could not save."), "error");
      setSaving(false);
    }
  };

  return (
    <>
      <TopBar title="Edit listing" back />
      <div className="pz-pad">
        <div className="pz-section">
          <label className="pz-label" htmlFor="es-rent">Rent (₹ per month)</label>
          <input id="es-rent" className="pz-input" inputMode="numeric" value={rent} onChange={(e) => setRent(e.target.value.replace(/\D/g, ""))} />
        </div>
        <span className="pz-label">Share with</span>
        <ShareWithForm value={share} onChange={setShare} groups={groups} />
        <div className="pz-section" style={{ marginTop: 12 }}>
          <h2>Private contacts <span className="pz-hint">only you and MovEazy</span></h2>
          {[["owner", "Owner"], ["tenant", "Current tenant"]].map(([k, label]) => (
            <div key={k} className="pz-row" style={{ marginBottom: 10 }}>
              <input className="pz-input" placeholder={`${label} name`} value={c[`${k}Name`]} onChange={(e) => setC({ ...c, [`${k}Name`]: e.target.value })} />
              <input className="pz-input" inputMode="numeric" placeholder="Mobile" value={c[`${k}Phone`]} onChange={(e) => setC({ ...c, [`${k}Phone`]: e.target.value })} />
            </div>
          ))}
        </div>
        <button type="button" className="pz-btn pz-btn--primary pz-btn--block" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </>
  );
}
