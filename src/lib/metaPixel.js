/**
 * Meta (Facebook) pixel for ads measurement and optimisation.
 *
 * Only the public, renter- and owner-facing site reports: the partner app, the
 * CRM, admin and marketing dashboards are our own people, and counting their
 * clicks as conversions would teach Meta to find more of us.
 *
 * The pixel ID is public by design (it ships in every page that uses it), so it
 * lives here with an env override for a second pixel on a staging build.
 *
 * Events (standard where Meta has one, so campaigns can optimise for them):
 *   PageView           every route change (it's a single-page app)
 *   ViewContent        a flat's page opened
 *   Lead               a renter gave us their mobile number (AI broker / visit request)
 *   SubmitApplication  a renter finished the AI-broker questionnaire
 *   CompleteRegistration  an account was created
 *   Schedule           a visit was booked or requested
 *   Contact            call / WhatsApp / call-back tapped on a flat
 *   OwnerListing       (custom) an owner added a flat
 *
 * Every call is a no-op without an ID, on another host, during prerender, or
 * when the script is blocked — analytics must never break the app.
 */

const DEFAULT_PIXEL_ID = "1110062495269034";
export const PIXEL_ID = String(import.meta.env?.VITE_META_PIXEL_ID || DEFAULT_PIXEL_ID).trim();

const TRACKED_HOSTS = /^(www\.|tenants?\.|owners\.)?moveazy\.co\.in$/i;
const UNTRACKED_PATHS = /^\/(crm|admin|superadmin|marketing|analytics|dashboard|partners|view-as|preview)(\/|$)/i;

let loaded = false;
let lastPath = null;

function browser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/** Should this page report at all? */
export function pixelEnabled(pathname = browser() ? window.location.pathname : "") {
  if (!PIXEL_ID || !browser()) return false;
  if (!TRACKED_HOSTS.test(window.location.hostname)) return false;
  return !UNTRACKED_PATHS.test(pathname || "/");
}

/** Indian mobile → 91XXXXXXXXXX, which is what Meta's matching expects. Empty if it isn't one. */
export function normalisePhone(phone) {
  const d = String(phone ?? "").replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 12 && d.startsWith("91")) return d;
  if (d.length === 11 && d.startsWith("0")) return `91${d.slice(1)}`;
  return "";
}

function userData({ phone, email } = {}) {
  const out = {};
  const ph = normalisePhone(phone);
  if (ph) out.ph = ph;
  const em = String(email ?? "").trim().toLowerCase();
  if (em.includes("@")) out.em = em;
  return out;
}

/** Meta's standard loader, without the <noscript> image (a React app has script). */
function load() {
  if (loaded) return true;
  try {
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", PIXEL_ID);
    loaded = true;
  } catch {
    /* blocked or unavailable */
  }
  return loaded;
}

function newEventId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Report one event. `custom` uses trackCustom (a name Meta has no standard for).
 * Returns the event id, for de-duplicating against a server-side copy later.
 */
export function trackPixel(event, params = {}, { custom = false, user } = {}) {
  if (!pixelEnabled() || !load()) return null;
  try {
    const ud = userData(user);
    // Re-initialising with what we now know improves matching for this and later events.
    if (Object.keys(ud).length) window.fbq("init", PIXEL_ID, ud);
    const eventID = newEventId();
    window.fbq(custom ? "trackCustom" : "track", event, params, { eventID });
    return eventID;
  } catch {
    return null;
  }
}

/** One PageView per route. Call from the router on every location change. */
export function trackPageView(pathname) {
  if (pathname === lastPath) return;
  lastPath = pathname;
  if (!pixelEnabled(pathname) || !load()) return;
  try {
    window.fbq("track", "PageView");
  } catch {
    /* ignore */
  }
}
