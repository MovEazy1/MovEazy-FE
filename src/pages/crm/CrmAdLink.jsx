/**
 * CRM → a property's or building's Meta ad page (lib/visitAds.js): the link
 * with Meta's UTMs on it, to paste into the ad, and the page itself to open.
 */
import { useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { Btn, C } from "./crmUi";
import { adPageUrl } from "../../lib/visitAds";

export default function CrmAdLink({ kind, refId, onToast }) {
  const [copied, setCopied] = useState(false);
  if (!refId) return null;
  const meta = adPageUrl(kind, refId, { meta: true });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(meta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onToast?.("Meta ad link copied");
    } catch {
      window.prompt("Copy the Meta ad link", meta);
    }
  };
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <code style={{ fontSize: 11.5, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 9px", wordBreak: "break-all", color: C.textDim }}>
        {meta}
      </code>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Btn sm variant="primary" onClick={copy}><Copy size={13} /> {copied ? "Copied" : "Copy Meta ad link"}</Btn>
        <a className="crm-btn" href={adPageUrl(kind, refId)} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}><ExternalLink size={13} /> Open the page</a>
      </div>
      <span className="crm-mute" style={{ fontSize: 11 }}>
        One button: Schedule a visit. Add ad / ad set names in Meta&apos;s URL parameters (utm_content) — they show on each visit in Visits.
      </span>
    </div>
  );
}
