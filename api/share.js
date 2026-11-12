/**
 * Link previews for the QR pages: /b/<code> (a broker's storefront),
 * /c/<token> (a broker's curated list) and /building/<code> (an owner's
 * building, owner_buildings.sql) — and the ad / WhatsApp pages, /visit/b/<code>
 * and /visit/<property id> (visit_ad_pages.sql). Facebook groups and WhatsApp read the page's
 * tags without running JavaScript, and the SPA's index.html has one set of
 * tags for every route — so this serves that same index.html with the tags
 * for this page. People get the app exactly as before; nothing redirects.
 *
 * Reads only side-effect-free functions (a preview must not count as an
 * open). Any failure serves the page untouched.
 *
 * People also get the page's first read inside it, and most pages drawn before
 * the app's code arrives — /curated/<token> (our team's list for one person)
 * among them, its open made here once for the person.
 */
import { isPreviewRobot } from "./_bots.js";
import { withAdPrepaint } from "./_adPrepaint.js";
import { withBuildingPrepaint } from "./_buildingPrepaint.js";
import { withStorefrontPrepaint } from "./_storefrontPrepaint.js";
import { withCuratedPrepaint } from "./_curatedPrepaint.js";
import { teamCardPhoto, teamListRows, teamListStart, withTeamCuratedPrepaint } from "./_teamCuratedPrepaint.js";
import { APP_LISTING_COLS } from "./_listing.js";

export const config = { runtime: "edge" };

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || "").trim();
const SUPABASE_KEY = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
const FALLBACK_IMAGE = "https://www.moveazy.co.in/og-share.jpg";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function rpc(fn, args) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  return r.ok ? r.json() : null;
}

async function tagsFor(kind, id) {
  if (kind === "b" && /^[A-Za-z0-9]{6}$/.test(id)) {
    const d = await rpc("partner_storefront", { p_code: id });
    if (!d) return null;
    const n = (d.homes || []).length;
    const first = (d.homes || []).find((h) => h.cover_image_url || (h.images || [])[0]);
    const areas = [...new Set((d.homes || []).map((h) => h.area).filter(Boolean))].slice(0, 3).join(", ");
    return {
      title: `${d.broker?.name || "A MovEazy partner"} — ${n} rental home${n === 1 ? "" : "s"}${areas ? ` in ${areas}` : ""}`,
      description: "Verified rental homes on MovEazy. See photos and rent, tap ♥ on the ones you like — the broker calls you back.",
      image: first?.cover_image_url || first?.images?.[0] || d.broker?.photo_url || FALLBACK_IMAGE,
    };
  }
  if (kind === "c" && /^[0-9a-f]{32}$/.test(id)) {
    const d = await rpc("partner_curated_preview", { p_token: id });
    if (!d) return null;
    return {
      title: `${d.broker || "Your broker"} picked ${d.count} home${d.count === 1 ? "" : "s"} for you`,
      description: "Swipe through them on MovEazy and tap ♥ on the ones you like.",
      image: d.cover || FALLBACK_IMAGE,
    };
  }
  if (kind === "building" && /^[A-Za-z0-9]{6}$/.test(id)) {
    const d = await rpc("building_page", { p_code: id });
    if (!d) return null;
    const flats = d.flats || [];
    const free = flats.filter((f) => f.available);
    const rents = free.map((f) => Number(f.rent) || 0).filter(Boolean);
    const first = flats.find((f) => f.cover_image_url || (f.images || [])[0]);
    return {
      title: `${d.name}${d.area ? `, ${d.area}` : ""} — ${free.length} flat${free.length === 1 ? "" : "s"} for rent`,
      description: `${rents.length ? `From ₹${Math.min(...rents).toLocaleString("en-IN")} a month. ` : ""}See every flat floor by floor and book a visit at your time.`,
      image: (d.photos || [])[0] || first?.cover_image_url || first?.images?.[0] || FALLBACK_IMAGE,
    };
  }
  // The ad / WhatsApp pages: /visit/<building code> is a building too.
  if ((kind === "visit-b" || kind === "visit") && /^[A-HJ-NP-Z2-9]{6}$/i.test(id)) {
    const d = await rpc("visit_ad_page", { p_kind: "building", p_ref: id });
    if (!d) return null;
    const free = d.available || [];
    const rents = free.map((f) => Number(f.rent) || 0).filter(Boolean);
    const first = free.find((f) => f.cover_image_url || (f.images || [])[0]);
    return {
      title: `${d.name}${d.area ? `, ${d.area}` : ""}${free.length ? ` — ${free.length} flat${free.length === 1 ? "" : "s"} available` : ""}`,
      description: `${rents.length ? `From ₹${Math.min(...rents).toLocaleString("en-IN")} a month. ` : ""}Verified by MovEazy. See the flats and schedule a free visit.`,
      image: (d.photos || [])[0] || first?.cover_image_url || first?.images?.[0] || FALLBACK_IMAGE,
    };
  }
  if (kind === "visit" && /^MZ-[A-Z0-9]{4,12}$/i.test(id)) {
    const d = await rpc("visit_ad_page", { p_kind: "flat", p_ref: id });
    if (!d) return null;
    const what = [d.flat_type, d.furnishing].filter(Boolean).join(", ") || "Flat for rent";
    return {
      title: `${what}${d.area ? ` in ${d.area}` : ""}${d.rent ? ` — ₹${Number(d.rent).toLocaleString("en-IN")}/month` : ""}`,
      description: "Verified by MovEazy. See the photos and schedule a free visit.",
      image: d.cover_image_url || (d.images || [])[0] || FALLBACK_IMAGE,
    };
  }
  return null;
}

function inject(html, t, pageUrl) {
  const set = (re, tag) => (re.test(html) ? (html = html.replace(re, tag)) : null);
  set(/<title>[^<]*<\/title>/, `<title>${esc(t.title)} | MovEazy</title>`);
  set(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(t.description)}" />`);
  set(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(t.title)}" />`);
  set(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(t.description)}" />`);
  set(/<meta property="og:image" [^>]*>/, `<meta property="og:image" content="${esc(t.image)}" />`);
  set(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(pageUrl)}" />`);
  set(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(t.title)}" />`);
  set(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(t.description)}" />`);
  set(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${esc(t.image)}" />`);
  // The site image's size no longer applies.
  html = html.replace(/\s*<meta property="og:image:(width|height|alt)"[^>]*>/g, "");
  return html;
}

/* ── For people: the page's data and first photo, inside the page ─────────── */

const VIDEO_EXT = /\.(mp4|m4v|webm|ogv|ogg|mov|qt|3gp)(?:[?#]|$)/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp|svg)(?:[?#]|$)/i;
const isVideo = (u) => !IMAGE_EXT.test(u) && (VIDEO_EXT.test(u) || /\/videos?\//i.test(u));
const isMadeCover = (u) => /\/cover-\d+\.jpe?g(\?|$)/i.test(String(u || ""));
const MARKER = "/storage/v1/object/public/listings/";

/** The 480 px copy of a listing photo (src/lib/imageShrink.js thumbUrl). */
export function thumbUrl(src) {
  const s = String(src || "");
  const i = s.indexOf(MARKER);
  if (i < 0) return s;
  const rest = s.slice(i + MARKER.length);
  if (rest.startsWith("thumbs/") || !/\.(jpe?g|png|webp|heic|heif)(\?|$)/i.test(rest)) return s;
  return `${s.slice(0, i + MARKER.length)}thumbs/${rest}`;
}

/** A flat's gallery, first photo first (partnerMedia listingMedia: a typed cover leads, a made one is skipped). */
function flatMedia(f) {
  const list = (f?.images ?? []).filter(Boolean);
  const cover = f?.cover_image_url;
  return [...new Set(!cover || isMadeCover(cover) ? list : [cover, ...list])];
}
const firstPhoto = (urls) => (urls || []).find((u) => u && !isVideo(u)) || "";

/** Which database read draws this page (the same one the app makes), and the photo at its top. */
export const PAGE_READS = {
  // A partner's shortlist: this read is the open itself (counted, the partner told on the first) —
  // made here once for the person opening it, and the app takes it instead of making it again.
  c: { fn: "partner_curated_open", args: (id) => ({ p_token: id }), ok: (id) => /^[0-9a-f]{32}$/.test(id),
    key: (id) => `partner_curated_open:${id}`, lead: () => "" },
  building: { fn: "building_page", args: (id) => ({ p_code: id }), ok: (id) => /^[A-Za-z0-9]{6}$/.test(id),
    key: (id) => `building_page:${id}`,
    // BuildingPage: its own photos, else its flats' — none when a video leads.
    lead: (d) => (d.cover_video ? "" : firstPhoto((d.photos ?? []).filter(Boolean).length ? d.photos : (d.flats ?? []).flatMap(flatMedia))) },
  "visit-b": { fn: "visit_ad_page", args: (id) => ({ p_kind: "building", p_ref: id }), ok: (id) => /^[A-HJ-NP-Z2-9]{6}$/i.test(id),
    key: (id) => `visit_ad_page:building:${id}`, lead: (d) => firstPhoto(d.photos) },
  visit: { fn: "visit_ad_page", args: (id) => ({ p_kind: "flat", p_ref: id }), ok: (id) => /^MZ-[A-Z0-9]{4,12}$/i.test(id),
    key: (id) => `visit_ad_page:flat:${id}`, lead: (d) => firstPhoto(flatMedia(d)) },
};

/** The shell with the page's data (window.__MZ_PAGE__) and its first photo asked for at once. */
export function withPageData(html, key, data, lead) {
  const json = JSON.stringify({ key, data }).replace(/</g, "\\u003c");
  const head = `${lead ? `<link rel="preload" as="image" href="${esc(thumbUrl(lead))}" fetchpriority="high">` : ""}<script>window.__MZ_PAGE__=${json};</script>`;
  return html
    .replace(/<link rel="modulepreload"/g, '<link rel="modulepreload" fetchpriority="low"')
    .replace("</head>", `${head}</head>`);
}

/** Never longer than `ms`: a slow read must not hold the page up — the app asks for itself. */
const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

/** A list our team sent (/curated/<token>, src/lib/crmSettings.js generateShareToken). */
export const TEAM_LIST_TOKEN = /^mz[0-9a-f]{24}$/;

/**
 * The team list's two reads, as CuratedProperties makes them: the open
 * (counted — made here once, for the person) and then its homes. The page
 * takes both (`rows` null: it fetches the homes itself). Null when the open
 * didn't answer in time — the app then opens it.
 */
export async function teamListRead(token) {
  const open = await within(rpc("curated_share_open", { token }).catch(() => null), 700);
  if (!open) return null;
  const ids = open.ok ? (open.property_ids || []).map(String) : [];
  if (!ids.length) return { open, rows: [] };
  const rows = await within(fetch(
    `${SUPABASE_URL}/rest/v1/inventory?select=${encodeURIComponent(APP_LISTING_COLS)}&property_id=in.(${encodeURIComponent(ids.map((id) => `"${id.replace(/"/g, "")}"`).join(","))})`,
    { headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` } },
  ).then((r) => (r.ok ? r.json() : null)).catch(() => null), 500);
  return { open, rows: Array.isArray(rows) ? rows : null };
}

export default async function handler(req) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") || "";
  const id = url.searchParams.get("id") || "";
  // A person (a QR scan, a tap on a shared link) gets the app at once, with
  // what the page will ask for first already in it.
  const robot = isPreviewRobot(req.headers.get("user-agent"));
  // /visit/<code> is a building too (6 letters), as the app reads it.
  const read = kind === "visit" && !/^MZ-/i.test(id) ? PAGE_READS["visit-b"] : PAGE_READS[kind];
  // A broker's page is drawn from what anyone may see; the app makes its own
  // read (it knows the viewer's likes), so this one isn't handed over.
  const storefront = !robot && kind === "b" && /^[A-Za-z0-9]{6}$/.test(id);
  if (kind === "curated") {
    // A robot gets the shell as it is, and never opens the list.
    const [page, data] = await Promise.all([
      fetch(`${url.origin}/app.html`),
      !robot && TEAM_LIST_TOKEN.test(id) ? teamListRead(id) : null,
    ]);
    let html = await page.text();
    if (data && page.ok) {
      try {
        html = withPageData(html, `curated_share_open:${id}`, data, "");
        const rows = data.rows ? teamListRows(data.open, data.rows) : [];
        if (rows.length) {
          const photo = teamCardPhoto(rows[teamListStart(data.open, rows)]);
          html = withTeamCuratedPrepaint(html, data.open, rows, photo ? thumbUrl(photo) : "");
        }
      } catch { /* the plain shell */ }
    }
    return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" } });
  }
  const [page, data] = await Promise.all([
    // The app's shell (dist/app.html; "/" itself may be a pre-built landing page).
    fetch(`${url.origin}/app.html`),
    !robot && read?.ok(id) ? within(rpc(read.fn, read.args(id)).catch(() => null), 700)
      : storefront ? within(rpc("partner_storefront", { p_code: id }).catch(() => null), 700) : null,
  ]);
  let html = await page.text();
  if (storefront) {
    if (data?.broker && page.ok) {
      try {
        const cover = (h) => { const u = firstPhoto(isMadeCover(h.cover_image_url) ? [h.cover_image_url] : flatMedia(h)); return u ? thumbUrl(u) : ""; };
        const first = data.homes?.[0] ? cover(data.homes[0]) : "";
        html = withStorefrontPrepaint(html, data, cover);
        if (first) html = html.replace("</head>", `<link rel="preload" as="image" href="${esc(first)}" fetchpriority="high"></head>`);
      } catch { /* the plain shell */ }
    }
    return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" } });
  }
  if (!robot) {
    if (data && page.ok) {
      try {
        html = withPageData(html, read.key(id), data, read.lead(data));
        // The ad page is drawn before its code arrives (api/_adPrepaint.js).
        if (read.fn === "visit_ad_page") {
          const building = read === PAGE_READS["visit-b"];
          const media = building ? (data.photos ?? []).filter(Boolean) : flatMedia(data);
          const lead = read.lead(data);
          html = withAdPrepaint(html, building ? "building" : "flat", data, media, lead ? thumbUrl(lead) : "");
        } else if (read === PAGE_READS.c && !data.known) {
          // First visit to a shortlist: the number form, drawn (api/_curatedPrepaint.js).
          html = withCuratedPrepaint(html, id, data);
        } else if (read === PAGE_READS.building && !data.cover_video) {
          // A building's own page, drawn too (api/_buildingPrepaint.js): its photos, else its flats'.
          const own = (data.photos ?? []).filter(Boolean);
          const media = own.length ? own : (data.flats ?? []).flatMap(flatMedia).slice(0, 8);
          const lead = read.lead(data);
          html = withBuildingPrepaint(html, data, media, lead ? thumbUrl(lead) : "");
        }
      } catch { /* the plain shell */ }
    }
    return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" } });
  }
  try {
    const t = await tagsFor(kind, id);
    const path = kind === "visit-b" ? `visit/b/${id}` : `${kind}/${id}`;
    if (t) html = inject(html, t, `https://www.moveazy.co.in/${path}`);
  } catch { /* the page, untouched */ }
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=300" },
  });
}
