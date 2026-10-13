/**
 * Installing the partner app on a phone (pages/partners/InstallApp.jsx).
 *
 * partners.moveazy.co.in links public/partners.webmanifest from index.html,
 * which also catches Chrome's install offer (beforeinstallprompt) into
 * window.__pzInstall before React loads, so the banner can open the phone's
 * own install dialog with one tap.
 *   Android  Chrome / Samsung / Edge: that one-tap dialog; any other browser:
 *            the menu → "Install app" steps.
 *   iPhone   Apple lets no site start an install: the Share → "Add to Home
 *            Screen" steps instead.
 *   In-app   WhatsApp / Instagram / Facebook browsers can't install at all:
 *            Android opens the page in Chrome; iPhone is told to open Safari.
 */

export const DISMISS_KEY = "pz-install-dismissed";
/** Closed banners come back after this long. */
export const DISMISS_DAYS = 3;

const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Snapchat|Line\/|LinkedInApp|Twitter|; wv\)/i;

/** "ios" | "android" | "other" (desktops and the rest never see the banner). */
export function installPlatform(ua = typeof navigator !== "undefined" ? navigator.userAgent : "", touch = typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0) {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touch > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

/** Inside WhatsApp's, Instagram's or another app's own browser, where installing isn't possible. */
export const inAppBrowser = (ua = typeof navigator !== "undefined" ? navigator.userAgent : "") => IN_APP.test(ua);

/** Already opened from the home screen. */
export function isInstalled() {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
  } catch {
    return false;
  }
}

/** Was the banner closed less than DISMISS_DAYS ago? */
export function recentlyDismissed(dismissedAt, now = Date.now()) {
  const t = Number(dismissedAt);
  return t > 0 && now - t < DISMISS_DAYS * 86400000;
}

export function readDismissed() {
  try { return localStorage.getItem(DISMISS_KEY); } catch { return null; }
}
export function markDismissed(now = Date.now()) {
  try { localStorage.setItem(DISMISS_KEY, String(now)); } catch { /* private tab: it shows again next time */ }
}

/** Android: this page in Chrome, from an in-app browser (falls back to the same address). */
export function openInChromeUrl(href = typeof window !== "undefined" ? window.location.href : "") {
  const u = new URL(href);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
}

/** The waiting install offer, if Chrome made one. */
export const pendingPrompt = () => (typeof window !== "undefined" ? window.__pzInstall || null : null);

/** Opens the phone's install dialog. → "accepted" | "dismissed" | "unavailable" */
export async function promptInstall() {
  const e = pendingPrompt();
  if (!e) return "unavailable";
  window.__pzInstall = null; // each offer can be shown once
  try {
    await e.prompt();
    const choice = await e.userChoice;
    return choice?.outcome || "dismissed";
  } catch {
    return "unavailable";
  }
}

/** The offline fallback; on the partner host only. */
export function registerPartnerWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (!/^partners\./i.test(window.location.hostname)) return;
  navigator.serviceWorker.register("/partners-sw.js").catch(() => {});
}
