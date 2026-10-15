/**
 * "Install MovEazy CRM" on the phone's Home: the phone's own install dialog
 * where Chrome offers one (index.html keeps the offer as window.__crmInstall),
 * the Share → "Add to Home Screen" steps on an iPhone, the ⋮ menu otherwise.
 * Hidden once the CRM is opened from the home screen, and for 3 days after
 * it's closed. Registers the CRM's offline page (public/crm-sw.js).
 */
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { C } from "../crmUi";
import { inAppBrowser, installPlatform, isInstalled, recentlyDismissed } from "../../../lib/pwaInstall";

const KEY = "crm-install-dismissed";

function registerCrmWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (/^partners\./i.test(window.location.hostname)) return;
  navigator.serviceWorker.register("/crm-sw.js", { scope: "/crm/" }).catch(() => {});
}

export default function CrmInstallCard() {
  const [, bump] = useState(0);
  const [hidden, setHidden] = useState(() => {
    try { return recentlyDismissed(localStorage.getItem(KEY)); } catch { return false; }
  });
  const [steps, setSteps] = useState(false);

  useEffect(() => {
    registerCrmWorker();
    const f = () => bump((n) => n + 1);
    window.addEventListener("crm-install-ready", f);
    return () => window.removeEventListener("crm-install-ready", f);
  }, []);

  const platform = installPlatform();
  if (hidden || isInstalled() || window.__crmInstalled || platform === "other") return null;

  const close = () => {
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* shows again next time */ }
    setHidden(true);
  };
  const install = async () => {
    const e = window.__crmInstall;
    if (!e) { setSteps(true); return; }
    window.__crmInstall = null;
    try { await e.prompt(); await e.userChoice; } catch { setSteps(true); }
    bump((n) => n + 1);
  };

  const how = platform === "ios"
    ? (inAppBrowser() ? "Open this page in Safari first, then tap Share → \"Add to Home Screen\"." : "Tap Share (the square with an arrow) → \"Add to Home Screen\" → Add.")
    : "Tap ⋮ (top right in Chrome) → \"Install app\" or \"Add to Home screen\".";

  return (
    <div className="crm-ph-card" style={{ flexDirection: "row", alignItems: "center", gap: 12, background: C.accentSoft, borderColor: "#B7D8CF" }}>
      <img src="/crm-icon-192.png" alt="" width="44" height="44" style={{ borderRadius: 11, flex: "none" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontSize: 14 }}>Install MovEazy CRM</b>
        <div className="crm-ph-meta">{steps ? how : "Open the CRM from your home screen, full screen."}</div>
      </div>
      {!steps && (
        <button type="button" className="crm-btn crm-btn--primary" onClick={install} style={{ flex: "none" }}>
          <Download size={15} /> Install
        </button>
      )}
      <button type="button" className="crm-ph-icon" onClick={close} aria-label="Close" style={{ width: 32, height: 32 }}><X size={16} /></button>
    </div>
  );
}
