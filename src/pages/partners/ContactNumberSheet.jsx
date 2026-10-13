/**
 * A partner's second mobile number (partner_contact_phone.sql): add, change or
 * remove it, and — when there are two — pick which one is the primary contact
 * (on their To-Let poster and public page). Their sign-in number never changes.
 * Opened from the poster page ("Want to change your mobile number?") and
 * from Profile.
 */
import { useState } from "react";
import { Sheet, formatPhone, toast } from "./partnerUi";
import { normalizeIndianMobile } from "../../lib/mobile";
import { friendlyError, setContactNumber } from "../../lib/partners";

export default function ContactNumberSheet({ partner, onClose, onSaved }) {
  const main = normalizeIndianMobile(partner?.phone || "") || "";
  const [phone, setPhone] = useState(partner?.alt_phone || "");
  const [primary, setPrimary] = useState(partner?.alt_phone ? partner?.contact_primary || "main" : "alt");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const next = normalizeIndianMobile(phone) || "";
  const two = Boolean(next) && next !== main;

  const save = async (value, pick) => {
    setErr("");
    if (value && !normalizeIndianMobile(value)) { setErr("Enter a 10-digit mobile number."); return; }
    if (value && normalizeIndianMobile(value) === main) { setErr("That's already your main number."); return; }
    setBusy(true);
    try {
      await setContactNumber(value, pick);
      await onSaved?.();
      toast(value ? (pick === "alt" ? "Saved — your poster now shows the new number" : "Saved as your second number") : "Second number removed");
      onClose();
    } catch (e) {
      setErr(friendlyError(e, "Couldn't save that number."));
      setBusy(false);
    }
  };

  return (
    <Sheet title="Your mobile number" onClose={onClose}>
      <form className="pz-pad" onSubmit={(e) => { e.preventDefault(); save(phone.trim(), two ? primary : "main"); }}>
        <p className="pz-hint" style={{ marginTop: 0 }}>
          You sign in with <b style={{ color: "var(--ink)" }}>{formatPhone(partner?.phone) || "your main number"}</b> — that never changes.
          Add another number for tenants to call; you choose which one goes on your poster.
        </p>
        <div className="pz-field">
          <label className="pz-label" htmlFor="cn-phone">New mobile number</label>
          <input id="cn-phone" className="pz-input" inputMode="tel" autoComplete="tel" placeholder="10-digit mobile" value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, "").slice(0, 16))} autoFocus />
        </div>
        {two && (
          <fieldset className="pz-field" style={{ border: 0, padding: 0, margin: "4px 0 12px" }}>
            <legend className="pz-label">Which is your primary contact number?</legend>
            {[["alt", next, "The new number"], ["main", main, "Your sign-in number"]].map(([k, num, label]) => (
              <label key={k} className="pz-menurow" style={{ border: "1px solid var(--line)", borderRadius: 12, marginTop: 6, cursor: "pointer",
                borderColor: primary === k ? "var(--gold)" : "var(--line)", background: primary === k ? "#FEF7E6" : "var(--card)" }}>
                <input type="radio" name="cn-primary" value={k} checked={primary === k} onChange={() => setPrimary(k)} />
                <span style={{ flex: 1 }}><b>{formatPhone(num)}</b><span className="pz-sub">{label}{k === primary ? " · on your poster and public page" : " · kept as secondary"}</span></span>
              </label>
            ))}
          </fieldset>
        )}
        {err && <div className="pz-err">{err}</div>}
        <button type="submit" className="pz-btn pz-btn--gold pz-btn--block" disabled={busy || !next}>{busy ? "Saving…" : "Save"}</button>
        {partner?.alt_phone && (
          <button type="button" className="pz-btn pz-btn--ghost pz-btn--block" style={{ marginTop: 6, color: "var(--red)" }} disabled={busy}
            onClick={() => save("", "main")}>Remove {formatPhone(partner.alt_phone)}</button>
        )}
      </form>
    </Sheet>
  );
}
