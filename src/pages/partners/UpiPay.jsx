/**
 * Pay MovEazy by UPI: the QR (or "Open a UPI app"), the UPI ID to copy, and
 * the UTR box. Shared by the ₹2,000 lead pack (MoveazyLeads) and Premium
 * plans (PremiumPage), so both look and work the same. "Unable to pay?"
 * opens WhatsApp to MovEazy (MOVEAZY_DESK) with what they were paying for.
 */
import { Copy } from "lucide-react";
import { QrImage } from "../../components/QrPosterBlock";
import { inr, waLink } from "../../lib/partners";
import { MOVEAZY_DESK, isUtr, unablePayMessage, upiLink } from "../../lib/partnerLeads";
import { WhatsAppIcon, toast } from "./partnerUi";

/** `payingFor`: what it's for, in words ("the 5 months Premium plan (₹4,999)"); `who`: { name, phone } for the WhatsApp. */
export default function UpiPay({ upi, amount, note, utr, setUtr, busy, onSubmit, onBack, submitLabel = "I've paid — submit", payingFor, who, children }) {
  const link = upiLink({ vpa: upi, amount, note });
  return (
    <>
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: "0 0 10px", fontSize: 15 }}>Scan with any UPI app and pay <strong>{inr(amount)}</strong></p>
        {link ? (
          <div style={{ display: "inline-block", padding: 10, background: "#fff", borderRadius: 14, border: "1px solid var(--line)" }}>
            <QrImage url={link} size={210} title="Pay MovEazy by UPI" />
          </div>
        ) : <p className="pz-err">Payment isn't set up yet — message MovEazy on WhatsApp.</p>}
        {upi && (
          <div className="pz-row" style={{ justifyContent: "center", gap: 8, marginTop: 10 }}>
            <span style={{ fontWeight: 600 }}>{upi}</span>
            <button type="button" className="pz-iconbtn" aria-label="Copy UPI ID"
              onClick={() => navigator.clipboard?.writeText(upi).then(() => toast("UPI ID copied"), () => {})}><Copy size={16} /></button>
          </div>
        )}
        {link && <a className="pz-btn pz-btn--sm" href={link} style={{ marginTop: 8 }}>Open a UPI app</a>}
      </div>
      <div className="pz-field" style={{ marginTop: 18 }}>
        <label className="pz-label" htmlFor="utr">After paying, enter the UTR / reference number</label>
        <input id="utr" className="pz-input" value={utr} placeholder="e.g. 412345678901" autoComplete="off"
          onChange={(e) => setUtr(e.target.value.slice(0, 40))} />
        <span className="pz-hint">It's on the payment's success screen in your UPI app (12 digits).</span>
      </div>
      {children}
      <button type="button" className="pz-btn pz-btn--primary pz-btn--block" onClick={onSubmit} disabled={busy || !isUtr(utr)}>
        {busy ? "Sending…" : submitLabel}
      </button>
      <a className="pz-btn pz-btn--block pz-wa" style={{ marginTop: 8 }} target="_blank" rel="noopener noreferrer"
        href={waLink(MOVEAZY_DESK, unablePayMessage(payingFor || `${note} (${inr(amount)})`, who?.name, who?.phone))}>
        <WhatsAppIcon size={17} /> Unable to pay? Message MovEazy
      </a>
      {onBack && <button type="button" className="pz-btn pz-btn--ghost pz-btn--block" onClick={onBack} style={{ marginTop: 6 }}>Back</button>}
    </>
  );
}
