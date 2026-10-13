/**
 * "Get the MovEazy Partners app" — the install banner on Home (after sign-in),
 * the menu's "Install the app", and the how-to sheet (lib/pwaInstall.js).
 *
 *   Android, Chrome's offer waiting  Install → the phone's own install dialog.
 *   Android, in WhatsApp etc.        Open in Chrome (installing works there).
 *   Android, other browsers          the ⋮ → "Install app" steps.
 *   iPhone                           the Share → "Add to Home Screen" steps
 *                                    (Apple lets no site start it); in an app's
 *                                    browser, first open the page in Safari.
 *
 * Hidden once opened from the home screen, on computers, and for 3 days after
 * the banner is closed (the menu item stays).
 */
import { useEffect, useState } from "react";
import { Download, MoreVertical, Share, SquarePlus, X } from "lucide-react";
import { Sheet, toast } from "./partnerUi";
import { isPartnerHost } from "../../lib/partners";
import {
  inAppBrowser, installPlatform, isInstalled, markDismissed, openInChromeUrl, pendingPrompt, promptInstall,
  readDismissed, recentlyDismissed, registerPartnerWorker,
} from "../../lib/pwaInstall";

const OPEN_EVENT = "pz-install-open";
/** Opens the how-to sheet (or the install dialog) from anywhere, e.g. the menu. */
export const openInstall = () => window.dispatchEvent(new Event(OPEN_EVENT));

export function useInstall() {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    window.addEventListener("pz-install-ready", f);
    return () => window.removeEventListener("pz-install-ready", f);
  }, []);
  const platform = installPlatform();
  const installed = isInstalled() || Boolean(window.__pzInstalled);
  // Only the partner host has the manifest; locally too, to work on it.
  const here = isPartnerHost() || import.meta.env.DEV;
  return {
    platform,
    inApp: inAppBrowser(),
    canPrompt: Boolean(pendingPrompt()),
    available: here && platform !== "other" && !installed,
  };
}

/** What the main button does on this phone. */
async function installNow({ platform, inApp, canPrompt }, showSteps) {
  if (platform === "android" && inApp) { window.location.href = openInChromeUrl(); return; }
  if (platform === "android" && canPrompt) {
    const r = await promptInstall();
    if (r === "accepted") {
      window.__pzInstalled = true; // the banner and menu item go now, not when Chrome finishes
      window.dispatchEvent(new Event("pz-install-ready"));
      toast("Installing — find MovEazy Partners on your home screen");
    }
    else if (r === "unavailable") showSteps();
    return;
  }
  showSteps();
}

const buttonLabel = ({ platform, inApp, canPrompt }) =>
  platform === "android" && inApp ? "Open in Chrome" : platform === "android" && canPrompt ? "Install" : "How to install";

/** The card on Home. */
export function InstallBanner() {
  const inst = useInstall();
  const [closed, setClosed] = useState(() => recentlyDismissed(readDismissed()));
  const [steps, setSteps] = useState(false);
  useEffect(() => { registerPartnerWorker(); }, []);
  if (!inst.available || closed) return null;
  const close = () => { markDismissed(); setClosed(true); };
  return (
    <>
      <style>{CSS}</style>
      <section className="ia-card" aria-label="Install the app">
        <img src="/partners-icon-192.png" alt="" width="48" height="48" className="ia-icon" />
        <span className="ia-text">
          <b>Get the MovEazy Partners app</b>
          <span>Opens from your home screen, full screen and faster than the browser.</span>
        </span>
        <button type="button" className="ia-x" aria-label="Not now" onClick={close}><X size={18} /></button>
        <button type="button" className="ia-go" onClick={() => installNow(inst, () => setSteps(true))}>
          <Download size={17} /> {buttonLabel(inst)}
        </button>
      </section>
      {steps && <InstallSteps inst={inst} onClose={() => setSteps(false)} />}
    </>
  );
}

/** Mounted once in the app: answers the menu's "Install the app". */
export function InstallHost() {
  const inst = useInstall();
  const [steps, setSteps] = useState(false);
  useEffect(() => {
    const f = () => installNow(inst, () => setSteps(true));
    window.addEventListener(OPEN_EVENT, f);
    return () => window.removeEventListener(OPEN_EVENT, f);
  }, [inst]);
  return steps ? <><style>{CSS}</style><InstallSteps inst={inst} onClose={() => setSteps(false)} /></> : null;
}

function InstallSteps({ inst, onClose }) {
  const ios = inst.platform === "ios";
  const list = ios
    ? [
      ...(inst.inApp ? [<>Tap <b>⋯</b> or the compass at the bottom and choose <b>Open in Safari</b>.</>] : []),
      <>Tap the <b>Share</b> button <Share size={16} className="ia-inl" /> in Safari&apos;s bar. On newer iPhones it&apos;s inside the <b>⋯</b> menu.</>,
      <>Scroll down and tap <b>Add to Home Screen</b> <SquarePlus size={16} className="ia-inl" />.</>,
      <>Tap <b>Add</b>. MovEazy Partners is now on your home screen.</>,
    ]
    : [
      <>Tap the browser menu <MoreVertical size={16} className="ia-inl" /> at the top right.</>,
      <>Tap <b>Install app</b> or <b>Add to Home screen</b>.</>,
      <>Tap <b>Install</b>. MovEazy Partners is now on your home screen.</>,
    ];
  return (
    <Sheet title="Install MovEazy Partners" onClose={onClose}>
      <div className="pz-pad" style={{ paddingTop: 4, paddingBottom: 22 }}>
        <ol className="ia-steps">
          {list.map((s, i) => <li key={i}><span className="ia-n">{i + 1}</span><span>{s}</span></li>)}
        </ol>
        <p className="pz-hint" style={{ margin: "12px 0 0" }}>
          {ios ? "Apple only allows this from Safari's Share menu." : "Use Chrome if your browser has no Install option."}
        </p>
        <button type="button" className="pz-btn pz-btn--block" style={{ marginTop: 14 }} onClick={onClose}>Got it</button>
      </div>
    </Sheet>
  );
}

const CSS = `
.ia-card { position: relative; display: grid; grid-template-columns: 48px 1fr; gap: 4px 12px; align-items: center; margin: 0 0 14px;
  padding: 14px 14px 14px; border-radius: 18px; background: var(--noir); color: #fff; }
.ia-icon { width: 48px; height: 48px; border-radius: 12px; background: #fff; grid-row: span 1; }
.ia-text { min-width: 0; padding-right: 26px; }
.ia-text b { display: block; font-size: 15.5px; font-weight: 800; }
.ia-text span { display: block; font-size: 12.5px; line-height: 1.4; color: rgba(255,255,255,.72); margin-top: 2px; }
.ia-x { position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; border: 0; border-radius: 999px; background: transparent;
  color: rgba(255,255,255,.7); display: grid; place-items: center; cursor: pointer; }
.ia-x:active { background: var(--noir3); }
.ia-go { grid-column: 1 / -1; margin-top: 10px; height: 44px; border: 0; border-radius: 999px; background: var(--goldg); color: #1F1605;
  font: inherit; font-size: 15px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
.ia-steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.ia-steps li { display: flex; gap: 12px; align-items: flex-start; font-size: 15px; line-height: 1.45; color: var(--ink); }
.ia-n { flex: none; width: 26px; height: 26px; border-radius: 999px; background: var(--noir); color: #fff; font-size: 13px; font-weight: 800;
  display: grid; place-items: center; margin-top: 1px; }
.ia-inl { vertical-align: -3px; margin: 0 2px; }
`;
