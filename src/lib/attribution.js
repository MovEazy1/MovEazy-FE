/**
 * Which post brought this account in.
 *
 * lib/shareAttribution.js answers "was this page load from a tracked share?" by
 * reading the current URL — right for counting opens, useless at signup, because
 * by then the visitor has clicked through three routes and the UTM parameters
 * are long gone from the address bar. Someone who taps a Facebook post, browses
 * for ten minutes and then creates an account looks organic.
 *
 * So the first touch is captured the moment it arrives and kept, and at signup
 * it is condensed into one short token stamped onto the account. That token is
 * the join key: every user row can be traced back to the surface that produced
 * it, whether that was a Facebook post, a subreddit or an agent's WhatsApp send.
 *
 * First touch wins on purpose. A visitor who arrives from Reddit, leaves, and
 * comes back a week later by typing the address is a Reddit signup — crediting
 * the direct visit would quietly hand every conversion to "direct".
 */

const STORE_KEY = "moveazy_attribution";
const TOKEN_VERSION = "mza1";
const MAX_FIELD = 120;

/**
 * Referrers worth naming. Parameters get stripped in plenty of places — a link
 * pasted from Facebook into a group, a subreddit's own redirect — so when they
 * are missing the referring host is the next best evidence of where a visit came
 * from, and far better than recording nothing.
 */
const REFERRER_SOURCES = [
  [/(^|\.)facebook\.com$|(^|\.)fb\.(com|me)$/i, "facebook"],
  [/(^|\.)reddit\.com$|(^|\.)redd\.it$/i, "reddit"],
  [/(^|\.)instagram\.com$/i, "instagram"],
  [/(^|\.)whatsapp\.com$|(^|\.)wa\.me$/i, "whatsapp"],
  [/(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/i, "linkedin"],
  [/(^|\.)t\.co$|(^|\.)(twitter|x)\.com$/i, "twitter"],
  [/(^|\.)google\./i, "google"],
  [/(^|\.)bing\.com$|(^|\.)duckduckgo\.com$/i, "search"],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/i, "youtube"],
  [/(^|\.)telegram\.(org|me)$|(^|\.)t\.me$/i, "telegram"],
];

const clean = (v) => String(v ?? "").trim().slice(0, MAX_FIELD);

/** Token segments are colon-separated, so a colon inside one would break parsing. */
const seg = (v) => clean(v).replace(/[:\s]+/g, "_") || "-";

function read() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function persist(record) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(record));
  } catch {
    /* private mode — this visit goes unattributed rather than throwing */
  }
}

function referrerSource(referrer) {
  if (!referrer) return "";
  let host = "";
  try {
    host = new URL(referrer).hostname;
  } catch {
    return "";
  }
  // Our own pages are not a referral; only a hop from somewhere else counts.
  if (typeof window !== "undefined" && host === window.location?.hostname) return "";
  for (const [re, name] of REFERRER_SOURCES) if (re.test(host)) return name;
  return host.replace(/^www\./, "").slice(0, MAX_FIELD);
}

/**
 * One line that names a source, readable at a glance in a CRM cell and still
 * machine-parseable:
 *
 *   mza1:facebook:social:property_share:MZ-ABC123:m1k2j3
 *
 * A fixed-shape string rather than JSON because it lands in a single text
 * column, gets pasted into spreadsheets, and has to survive a GROUP BY.
 */
export function buildAttributionToken(a) {
  if (!a || !a.source) return "";
  return [
    TOKEN_VERSION,
    seg(a.source),
    seg(a.medium || "referral"),
    seg(a.campaign || "-"),
    seg(a.content || "-"),
    Number(a.at || Date.now()).toString(36),
  ].join(":");
}

/** The inverse, for anything that reads a stored token back. */
export function parseAttributionToken(token) {
  const parts = String(token || "").split(":");
  if (parts[0] !== TOKEN_VERSION || parts.length < 6) return null;
  const [, source, medium, campaign, content, at] = parts;
  const ms = parseInt(at, 36);
  return {
    source,
    medium,
    campaign: campaign === "-" ? "" : campaign,
    content: content === "-" ? "" : content,
    at: Number.isFinite(ms) ? new Date(ms).toISOString() : "",
  };
}

/**
 * What this page load says about where the visitor came from. Explicit UTM
 * parameters beat a guess from the referrer, which beats nothing at all.
 */
function touchFromUrl() {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const referrer = typeof document !== "undefined" ? clean(document.referrer) : "";

  const utmSource = clean(q.get("utm_source"));
  const source = utmSource || referrerSource(referrer);
  if (!source) return null;

  return {
    source,
    medium: clean(q.get("utm_medium")) || (utmSource ? "" : "referral"),
    campaign: clean(q.get("utm_campaign")),
    content: clean(q.get("utm_content")),
    term: clean(q.get("utm_term")),
    // The CRM's per-share token, when the visit came from an agent's send. It
    // names one client and one property, which no UTM parameter can.
    share_token: clean(q.get("mz_s")),
    referrer,
    landing_path: clean(window.location.pathname + window.location.search).slice(0, 300),
    at: Date.now(),
  };
}

/**
 * Record where this visit came from. Safe to call on every page load: only the
 * first touch is ever written, and a visit with nothing to say leaves the stored
 * record alone rather than overwriting it with blanks.
 */
export function captureAttribution() {
  const touch = touchFromUrl();
  if (!touch) return read();

  const existing = read();
  const record = existing?.first
    ? { ...existing, last: touch, touches: Math.min((existing.touches || 1) + 1, 999) }
    : { first: touch, last: touch, touches: 1 };

  persist(record);
  return record;
}

/** The first touch, or null when the visitor arrived with nothing to go on. */
export function firstTouch() {
  return read()?.first || null;
}

/** The token to stamp on a new account, or "" when there is nothing to credit. */
export function attributionToken() {
  return buildAttributionToken(firstTouch());
}

/**
 * Everything worth keeping about how an account was acquired, shaped for the
 * columns on user_profiles. Returns null for an unattributed visitor, so callers
 * can skip the write rather than storing a row of empty strings.
 */
export function signupAttribution() {
  const record = read();
  const first = record?.first;
  if (!first) return null;

  return {
    attribution_token: buildAttributionToken(first),
    signup_source: first.source,
    signup_attribution: {
      source: first.source,
      medium: first.medium || "referral",
      campaign: first.campaign || "",
      content: first.content || "",
      term: first.term || "",
      share_token: first.share_token || "",
      referrer: first.referrer || "",
      landing_path: first.landing_path || "",
      first_seen_at: new Date(first.at).toISOString(),
      touches: record.touches || 1,
      // Kept alongside the first touch: the two differ when someone finds us on
      // Reddit and converts after an agent's follow-up, and the gap between them
      // is the only place that shows.
      last_source: record.last?.source || first.source,
      last_seen_at: new Date(record.last?.at || first.at).toISOString(),
    },
  };
}

/** Test seam. */
export function clearAttribution() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* nothing to clear */
  }
}
