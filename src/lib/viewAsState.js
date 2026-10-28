/**
 * Is the super admin viewing the site as someone else right now? (The
 * portal: pages/SuperAdminViewAs.jsx; the database side: view_as.sql.)
 *
 * Tiny on purpose — the Supabase client checks it on every request, so it
 * imports nothing. The state lives in localStorage so every tab of the site
 * agrees, and so Exit works from any of them:
 *
 *   { session, key, mode: "view" | "act", target: { id, email, name, roles },
 *     admin: { access_token, refresh_token }, startedAt, lastActive }
 */
export const VIEW_AS_KEY = "mz_view_as";
export const VIEW_AS_EVENT = "mz-view-as";
/** The portal's address: never linked from anywhere. */
export const VIEW_AS_PATH = "/unique-login-link-master-data-super-admin";

let cache;
let cacheRaw;

export function viewAsState() {
  if (typeof window === "undefined") return null;
  let raw = null;
  try { raw = window.localStorage.getItem(VIEW_AS_KEY); } catch { return null; }
  if (raw === cacheRaw) return cache;
  cacheRaw = raw;
  try { cache = raw ? JSON.parse(raw) : null; } catch { cache = null; }
  if (cache && !cache.session) cache = null;
  return cache;
}

export const isViewingAs = () => Boolean(viewAsState());

export function saveViewAsState(next) {
  try {
    if (next) window.localStorage.setItem(VIEW_AS_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(VIEW_AS_KEY);
  } catch { /* private mode: nothing to keep */ }
  window.dispatchEvent(new CustomEvent(VIEW_AS_EVENT));
}

/** Something the banner should say ("view-only", "payments") — see ViewAsBanner. */
export function viewAsNotice(kind) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(`${VIEW_AS_EVENT}-notice`, { detail: kind }));
}

// Activity counters and "seen" markers: never sent while viewing as someone,
// so the user's numbers stay theirs.
const QUIET_RPCS = new Set([
  "app_track", "flat_view", "building_view", "increment_listing_view", "partner_storefront_view",
  "partner_storefront_visit", "flat_claim_views", "owner_scans_claim", "partner_matcher_seen", "partner_congrats_seen",
  "partner_tenant_seen", "partner_trial_seen", "flat_view_engage", "tenant_visitor_link",
]);
// Money: never, even with actions allowed — a payment can't be reverted.
const PAYMENT_RPCS = new Set(["partner_payment_start", "partner_plan_pay_upi", "partner_lead_request"]);

const blocked = (message, status = 403) =>
  new Response(JSON.stringify({ message, error: message, code: "VIEW_AS" }), { status, headers: { "content-type": "application/json" } });

/**
 * Wraps a fetch to Supabase while viewing as someone: marks the request so
 * the database knows (x-mz-view-as), keeps counters and payments from going
 * out, blocks uploads and account changes in view-only mode, and notices when
 * the database dropped a write (203). `send(input, init)` does the request.
 */
export async function viewAsFetch(input, init, send, onUpload) {
  const st = viewAsState();
  if (!st) return send(input, init);
  const url = String(input?.url ?? input);
  const method = String(init?.method || input?.method || "GET").toUpperCase();

  const rpc = url.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/i)?.[1];
  if (rpc && QUIET_RPCS.has(rpc)) return new Response("null", { status: 200, headers: { "content-type": "application/json" } });
  if (rpc && PAYMENT_RPCS.has(rpc)) {
    viewAsNotice("payments");
    return blocked("Payments are off while viewing as a user.");
  }
  if (/\/rest\/v1\/(user_sessions|app_events)\b/.test(url) && method !== "GET") {
    return new Response(method === "POST" ? "{}" : "", { status: method === "POST" ? 201 : 204, headers: { "content-type": "application/json" } });
  }
  if (/\/auth\/v1\/user\b/.test(url) && method === "PUT") {
    viewAsNotice("view-only");
    return blocked("Account settings can't be changed while viewing as a user.");
  }
  const upload = url.match(/\/storage\/v1\/object\/(?!sign\/|public\/|list\/|info\/)([^/?]+)\/([^?]+)/);
  const isUpload = upload && (method === "POST" || method === "PUT");
  if (isUpload && st.mode !== "act") {
    viewAsNotice("view-only");
    return blocked("View-only — nothing is uploaded while you view as this user.");
  }

  const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
  headers.set("x-mz-view-as", st.session);
  const res = await send(input, { ...init, headers });

  if (res.status === 203) viewAsNotice("view-only");
  else if (st.mode !== "act" && method !== "GET" && /\/rest\/v1\/(?!rpc\/)/.test(url) && res.status >= 400) viewAsNotice("view-only");
  if (isUpload && res.ok && onUpload) onUpload(decodeURIComponent(upload[1]), decodeURIComponent(upload[2]));
  return res;
}

/** The site's own payment endpoints, outside Supabase: never while viewing as someone. */
export function blockPaymentsWhileViewingAs() {
  if (typeof window === "undefined" || window.__mzViewAsFetch) return;
  const original = window.fetch.bind(window);
  window.__mzViewAsFetch = true;
  window.fetch = (input, init) => {
    const url = String(input?.url ?? input);
    const method = String(init?.method || input?.method || "GET").toUpperCase();
    if (viewAsState() && method === "POST" && /\/api\/(lead-pay|partner-pay)\b/.test(url)) {
      viewAsNotice("payments");
      return Promise.resolve(blocked("Payments are off while viewing as a user."));
    }
    return original(input, init);
  };
}
