/**
 * Pay MovEazy by UPI: the QR (or "Open a UPI app"), the UPI ID to copy, and
 * the UTR box. Shared by the ₹2,000 lead pack (MoveazyLeads) and Premium
 * plans (PremiumPage), so both look and work the same.
 */
import { Copy } from "lucide-react";
import { toast } from "./partnerUi";
import { QrImage } from "../../components/QrPosterBlock";
import { inr } from "../../lib/partners";
import { isUtr, upiLink } from "../../lib/partnerLeads";

export default function UpiPay({ upi, amount, note, utr, setUtr, busy, onSubmit, onBack, submitLabel = "I've paid — submit", children }) {
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
      {onBack && <button type="button" className="pz-btn pz-btn--ghost pz-btn--block" onClick={onBack} style={{ marginTop: 6 }}>Back</button>}
    </>
  );
}
