/**
 * CRM → a property's or building's Meta ad page (lib/visitAds.js): the link
 * with Meta's UTMs on it, to paste into the ad; the same page as a WhatsApp
 * share (its own UTMs, so visits say they came from WhatsApp); and the page.
 */
import { useState } from "react";
import { Copy, ExternalLink, MessageCircle } from "lucide-react";
import { Btn, C } from "./crmUi";
import { adPageUrl } from "../../lib/visitAds";

export default function CrmAdLink({ kind, refId, onToast }) {
  const [copied, setCopied] = useState("");
  if (!refId) return null;
  const meta = adPageUrl(kind, refId, { meta: true });
  const wa = adPageUrl(kind, refId, { whatsapp: true });
  const copy = async (url, which) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(which);
      setTimeout(() => setCopied(""), 2000);
      onToast?.(which === "wa" ? "WhatsApp link copied" : "Meta ad link copied");
    } catch {
      window.prompt("Copy the link", url);
    }
  };
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <code style={{ fontSize: 11.5, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 9px", wordBreak: "break-all", color: C.textDim }}>
        {meta}
      </code>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Btn sm variant="primary" onClick={() => copy(meta, "meta")}><Copy size={13} /> {copied === "meta" ? "Copied" : "Copy Meta ad link"}</Btn>
        <Btn sm onClick={() => copy(wa, "wa")}><MessageCircle size={13} /> {copied === "wa" ? "Copied" : "Copy WhatsApp link"}</Btn>
        <a className="crm-btn" href={`https://wa.me/?text=${encodeURIComponent(wa)}`} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
          <MessageCircle size={13} /> Share on WhatsApp
        </a>
        <a className="crm-btn" href={adPageUrl(kind, refId)} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}><ExternalLink size={13} /> Open the page</a>
      </div>
      <span className="crm-mute" style={{ fontSize: 11 }}>
        One button: Schedule a visit; a building&apos;s page lists its free flats. After booking, the tenant can call the caretaker from the visit&apos;s
        time. Add ad / ad set names in Meta&apos;s URL parameters (utm_content) — every visit shows Meta ad or WhatsApp in Visits.
      </span>
    </div>
  );
}
