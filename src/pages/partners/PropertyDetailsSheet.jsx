/**
 * "Add more details" for a partner's own listing, any time after it's live:
 * a name, the WhatsApp message as the broker already wrote it (saved as the
 * description, as-is), and the optional extras the quick add skipped.
 */
import { useEffect, useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { Chip, Sheet, toast } from "./partnerUi";
import { FURNISHING_CHIPS } from "../../lib/partnerFilters";
import { normalizeIndianMobile } from "../../lib/mobile";
import { fetchPropertyContacts, friendlyError, saveOwnContacts, updatePartnerListing } from "../../lib/partners";

/** The pasted message, tidied but not rewritten: invisible characters out, blank-line runs collapsed. */
export function cleanPasted(text) {
  return String(text || "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n").map((line) => line.replace(/[ \t]+$/g, "")).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 2000);
}

export default function PropertyDetailsSheet({ listing, onClose, onSaved }) {
  const [f, setF] = useState(() => ({
    title: listing.title || "",
    description: listing.description || "",
    furnishing: listing.furnishing || "",
    deposit: listing.deposit ? String(listing.deposit) : "",
    availableFrom: listing.available_from || "",
    ownerName: "",
    ownerPhone: "",
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));

  useEffect(() => {
    fetchPropertyContacts(listing.property_id).then((cs) => {
      const o = (cs || []).find((c) => c.role === "owner");
      if (o) set({ ownerName: o.name || "", ownerPhone: o.phone || "" });
    }, () => {});
  }, [listing.property_id]);

  const pasteClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) set({ description: cleanPasted(t) });
    } catch {
      toast("Long-press the box and tap Paste.");
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (f.ownerPhone && !normalizeIndianMobile(f.ownerPhone)) { setErr("Owner mobile should be 10 digits."); return; }
    setBusy(true);
    setErr("");
    try {
      await updatePartnerListing(listing.property_id, {
        title: f.title.trim().slice(0, 160) || listing.title,
        description: cleanPasted(f.description),
        furnishing: f.furnishing,
        deposit: Number(f.deposit) || 0,
        available_from: f.availableFrom || null,
      });
      await saveOwnContacts(listing.property_id, [
        { role: "owner", name: f.ownerName, phone: normalizeIndianMobile(f.ownerPhone) || "" },
      ]);
      await onSaved?.();
      toast("Details saved");
      onClose();
    } catch (ex) {
      setErr(friendlyError(ex, "Could not save the details."));
      setBusy(false);
    }
  };

  return (
    <Sheet title="Add more details" onClose={onClose}>
      <form className="pz-pad" onSubmit={save}>
        <div className="pz-field">
          <label className="pz-label" htmlFor="md-name">Name of the property</label>
          <input id="md-name" className="pz-input" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Sunshine Residency 2 BHK, 3rd floor" />
        </div>
        <div className="pz-field">
          <label className="pz-label" htmlFor="md-desc" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            Details from WhatsApp
            <button type="button" className="pz-btn pz-btn--sm" onClick={pasteClipboard}><ClipboardPaste size={15} /> Paste</button>
          </label>
          <textarea id="md-desc" className="pz-textarea" rows={8} value={f.description}
            onChange={(e) => set({ description: e.target.value })} onBlur={() => set({ description: cleanPasted(f.description) })}
            placeholder={"Copy the whole message from WhatsApp and paste it here — rent, deposit, amenities, rules… it's saved as you wrote it."} />
          <span className="pz-hint">{f.description.length}/2000</span>
        </div>
        <div className="pz-field">
          <span className="pz-label">Furnishing <span className="pz-hint">(optional)</span></span>
          <div className="pz-chips">
            {FURNISHING_CHIPS.map((x) => <Chip key={x} on={f.furnishing === x} onClick={() => set({ furnishing: f.furnishing === x ? "" : x })}>{x}</Chip>)}
          </div>
        </div>
        <div className="pz-row" style={{ alignItems: "flex-start" }}>
          <div className="pz-field" style={{ flex: 1 }}>
            <label className="pz-label" htmlFor="md-dep">Deposit (₹)</label>
            <input id="md-dep" className="pz-input" inputMode="numeric" value={f.deposit} onChange={(e) => set({ deposit: e.target.value.replace(/\D/g, "").slice(0, 8) })} />
          </div>
          <div className="pz-field" style={{ flex: 1 }}>
            <label className="pz-label" htmlFor="md-from">Available from</label>
            <input id="md-from" className="pz-input" type="date" value={f.availableFrom} onChange={(e) => set({ availableFrom: e.target.value })} />
          </div>
        </div>
        <span className="pz-label">Owner contact <span className="pz-hint">— only you and MovEazy see this</span></span>
        <div className="pz-row" style={{ alignItems: "flex-start", marginBottom: 12 }}>
          <input className="pz-input" placeholder="Owner name" value={f.ownerName} onChange={(e) => set({ ownerName: e.target.value })} aria-label="Owner name" />
          <input className="pz-input" inputMode="numeric" placeholder="Mobile" value={f.ownerPhone} onChange={(e) => set({ ownerPhone: e.target.value })} aria-label="Owner mobile" />
        </div>
        {err && <div className="pz-err" role="alert">{err}</div>}
        <button type="submit" className="pz-btn pz-btn--primary pz-btn--block" disabled={busy}>{busy ? "Saving…" : "Save details"}</button>
      </form>
    </Sheet>
  );
}
