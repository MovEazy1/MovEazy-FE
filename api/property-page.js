/**
 * /property/:id — a flat's page, drawn the moment it arrives.
 *
 * The page is the app's shell (app.html) like every other route, which on a
 * phone over 4G meant: shell → ~210 KB of code → the flat → its first photo,
 * one after another — about 7 s before the photo showed (PageSpeed, Nov 2026).
 * Here the shell comes with three things added for a published flat:
 *
 *   - its first photo, asked for in <head>, so it downloads beside the code;
 *   - the flat itself (window.__MZ_LISTING__, the same row the app reads), so
 *     the app has nothing to wait for (lib/inventory prefetchListing);
 *   - on a phone, the top of the page — photo, title, rent, Schedule Visit —
 *     as plain HTML in #prerender, shown while the app renders hidden beneath
 *     and swaps in when drawn (lib/prerender.js; PropertyPage hands over).
 *
 * Anything missing (not published, not found, the database slow) and the plain
 * shell goes out instead, exactly as before. Cached at the edge; the app
 * re-checks the flat once drawn.
 */
import { esc, fetchAppListingRow } from "./_listing.js";

export const config = { runtime: "edge" };

const VIDEO_EXT = /\.(mp4|m4v|webm|ogv|ogg|mov|qt|3gp)(?:[?#]|$)/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp|svg)(?:[?#]|$)/i;
const isVideo = (u) => !IMAGE_EXT.test(u) && (VIDEO_EXT.test(u) || /\/videos?\//i.test(u));
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

/** The flat's photos in the order the page shows them (no videos — they can't be drawn here). */
export function photosOf(row) {
  const all = [...new Set((Array.isArray(row?.images) ? row.images : []).map((u) => String(u ?? "").trim()))]
    .filter((u) => u && u !== "undefined" && u !== "null");
  const photos = all.filter((u) => !isVideo(u));
  const cover = String(row?.cover_image_url || "").trim();
  return photos.length ? photos : (cover && !isVideo(cover) ? [cover] : []);
}

const money = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN")}`;

/** The deposit as the page writes it (PropertyModal): "3 months", or rupees. */
export function depositText(row) {
  const n = Number(row?.deposit) || 0;
  if (n > 0 && n <= 15) return `${n} months`;
  return money(n);
}

/** "13 hours ago" (src/lib/formatTime.js formatPostedAgo). */
export function postedAgo(raw, now = Date.now()) {
  if (!raw) return "";
  const ms = now - new Date(raw).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days < 31) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(raw).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

const PIN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>';
const ICON = (paths) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const BED = ICON('<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/>');
const USERS = ICON('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>');
const HOUSE = ICON('<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>');
const DAYS = ICON('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>');
const CAL = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>';

// Measured off the real page on a phone (PropertyModal, 375 px wide).
const CSS = `html:not(.mz-pre) #prerender{display:none}html.mz-pre #root{position:absolute;top:0;left:0;right:0;visibility:hidden;pointer-events:none}html.mz-pre #root *{animation-play-state:paused!important}
.mzp{position:fixed;inset:0;background:#04211D;font-family:Manrope,system-ui,sans-serif;color:#151718;z-index:1}
.mzp-panel{position:absolute;top:20px;left:8px;right:8px;bottom:21px;background:#F7FAF8;border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
.mzp-head{display:flex;align-items:center;justify-content:space-between;background:#04211D;padding:12px 14px;border-bottom:1px solid #0A3A33;height:61px;box-sizing:border-box}
.mzp-head img{height:24px;width:auto;display:block}
.mzp-x{width:36px;height:36px;border-radius:999px;border:1px solid #0A3A33;background:rgba(255,255,255,.05);color:#EDF3F1;font:800 18px/34px Manrope,system-ui,sans-serif;text-align:center}
.mzp-bar{background:#0E7C68;color:#fff;font-weight:700;font-size:14.5px;line-height:21.75px;padding:13px 18px;text-align:center}
.mzp-flag{padding:10px 18px;background:#FFEDD5;color:#9A3412;font-size:13.5px;font-weight:700;text-align:center}
.mzp-scroll{flex:1;overflow:hidden}
.mzp-card{padding:10px 10px 14px;border-bottom:1px solid #DCE8E5}
.mzp-photo{position:relative;height:240px;border-radius:14px;overflow:hidden;background:#04211D;display:flex;align-items:center;justify-content:center}
.mzp-bg{position:absolute;width:115%;height:115%;object-fit:cover;filter:blur(25px) brightness(.85);opacity:.9}
.mzp-fg{position:relative;width:100%;height:100%;object-fit:contain}
.mzp-strip{display:flex;gap:8px;margin-top:10px;padding-bottom:4px;overflow:hidden}
.mzp-strip span{flex:none;width:72px;height:52px;border-radius:10px;background:#E3ECE9;box-sizing:border-box}
.mzp-strip span:first-child{border:2px solid #0E7C68}
.mzp-body{padding:14px}
.mzp-body h1{font:800 22px/1.2 Sora,Manrope,system-ui,sans-serif;color:#12211E;margin:0 0 8px}
.mzp-posted{margin:0 0 8px;font-size:12.5px;color:#7A8F8A;font-weight:600}
.mzp-area{display:flex;align-items:flex-start;gap:7px;font-size:14.5px;color:#4A5B57;margin:0 0 16px;line-height:1.45}
.mzp-area svg{flex-shrink:0;margin-top:2px;color:#7A8F8A}
.mzp-money{display:flex;gap:18px;padding-bottom:18px;border-bottom:1px solid #DCE8E5}
.mzp-money>div{flex:1;min-width:0}
.mzp-money b{display:block;font-size:22px;font-weight:800;color:#12211E;line-height:1.1;white-space:nowrap}
.mzp-money small{display:block;font-size:13px;color:#7A8F8A;margin-top:3px}
.mzp-money i{width:1px;background:#DCE8E5}
.mzp-facts{display:grid;grid-template-columns:1fr 1fr;gap:16px 12px;margin:18px 0 26px}
.mzp-facts>div{display:flex;gap:10px;align-items:flex-start;min-width:0}
.mzp-facts svg{flex-shrink:0;margin-top:2px;color:#12211E}
.mzp-facts b{display:block;font-size:14px;font-weight:700;color:#12211E;line-height:1.25}
.mzp-facts small{display:block;font-size:12.5px;color:#7A8F8A;line-height:1.3}
.mzp-cta{background:#fff;padding:10px 14px}
.mzp-cta div{display:flex;align-items:center;justify-content:center;gap:9px;background:#CC3F28;color:#fff;border-radius:12px;padding:15px;font-weight:700;font-size:16px;line-height:24px}`;

// Before anything paints: on a phone, the drawn copy shows and the app renders
// hidden until PropertyPage hands over (or 15 s pass, whatever happened).
const HEAD_SCRIPT = `<script>(function(){try{if(!matchMedia("(max-width: 767px)").matches)return;document.documentElement.classList.add("mz-pre");setTimeout(function(){document.documentElement.classList.remove("mz-pre");var p=document.getElementById("prerender");if(p)p.remove();},15000);}catch(e){}})();</script>`;

/** The top of the flat's page, as the app draws it on a phone. */
export function prepaint(row, now = Date.now()) {
  const photos = photosOf(row);
  const lead = photos[0] ? thumbUrl(photos[0]) : "";
  const title = String(row.title || "").trim() || `${row.flat_type || "Home"} in ${row.area || "Bengaluru"}`;
  const address = String(row.full_address || "").trim() || [row.landmark, row.area].filter(Boolean).join(", ")
    || String(row.area || "").trim() || "Location not provided";
  const rent = Number(row.rent) > 0 ? money(row.rent) : "—";
  const posted = postedAgo(row.created_at, now);
  const strip = Math.min(Math.max(photos.length, 1), 5);
  // The four facts under the price (PropertyModal), worded the same.
  const occupants = Array.isArray(row.occupants_allowed) && row.occupants_allowed.length ? row.occupants_allowed[0] : "Anyone";
  const from = row.available_from
    ? new Date(row.available_from).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "Immediate";
  const facts = [[BED, String(row.flat_type || "").trim() || "Home", "Apartment"], [USERS, occupants, "welcome"],
    [HOUSE, String(row.furnishing || "").trim() || "Unfurnished", "furnishing"], [DAYS, from, "available from"]]
    .map(([icon, main, sub]) => `<div>${icon}<div><b>${esc(main)}</b><small>${sub}</small></div></div>`).join("");
  return `<div class="mzp"><div class="mzp-panel">
<div class="mzp-head"><img src="/moveazy-logo-mint-dark.png" alt="MovEazy" width="95" height="24"><div class="mzp-x">×</div></div>
${row.rent_flag === "potentially_rented" ? '<div class="mzp-flag">Potentially rented — we’re confirming with the broker.</div>' : ""}<div class="mzp-bar">Get personalised flats →</div>
<div class="mzp-scroll"><div class="mzp-card"><div class="mzp-photo">${lead ? `<img class="mzp-bg" src="${esc(lead)}" alt=""><img class="mzp-fg" src="${esc(lead)}" alt="${esc(title)}">` : ""}</div>
<div class="mzp-strip">${"<span></span>".repeat(photos.length > 1 ? strip : 0)}</div></div>
<div class="mzp-body"><h1>${esc(title)}</h1>${posted ? `<p class="mzp-posted">Posted ${esc(posted)}</p>` : ""}
<p class="mzp-area">${PIN}<span>${esc(address)}</span></p>
<div class="mzp-money"><div><b>${esc(rent)}</b><small>/ month</small></div><i></i><div><b>${esc(depositText(row))}</b><small>deposit</small></div></div>
<div class="mzp-facts">${facts}</div></div></div>
<div class="mzp-cta"><div>${CAL}Schedule Visit</div></div>
</div></div>`;
}

/**
 * The app's stylesheet, no longer holding up a phone's first paint: the drawn
 * copy has its own styles above. Still fetched at once and at high priority
 * (the preload), applied as it lands — well before the app's ~200 KB of code
 * has drawn the page it styles. A wider screen (no drawn copy) waits for it
 * as before.
 */
const phoneStylesheet = (_, href) =>
  `<link rel="preload" as="style" crossorigin href="${href}">`
  + `<link rel="stylesheet" crossorigin href="${href}" media="(min-width: 768px)" onload="this.media='all'">`;

/** The shell with the flat added: photo preload, its data, the drawn copy, and its own title. */
export function withListing(shell, row, now = Date.now()) {
  const photos = photosOf(row);
  const lead = photos[0] ? thumbUrl(photos[0]) : "";
  const title = String(row.title || "").trim() || `${row.flat_type || "Home"} in ${row.area || "Bengaluru"}`;
  const data = JSON.stringify({ id: row.property_id, rows: [row] }).replace(/</g, "\\u003c");
  const head = [
    lead ? `<link rel="preload" as="image" href="${esc(lead)}" fetchpriority="high">` : "",
    `<link rel="preload" as="image" href="/moveazy-logo-mint-dark.png">`,
    HEAD_SCRIPT,
    `<style>${CSS}</style>`,
    `<script>window.__MZ_LISTING__=${data};</script>`,
  ].join("");
  return shell
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(`${title} · MovEazy`)}</title>`)
    // The photo and styles first; the app's code still comes at once, just behind them.
    .replace(/<link rel="modulepreload"/g, '<link rel="modulepreload" fetchpriority="low"')
    .replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/, phoneStylesheet)
    .replace("</head>", `${head}</head>`)
    .replace('<div id="root"></div>', `<div id="prerender">${prepaint(row, now)}</div><div id="root"></div>`);
}

export default async function handler(req) {
  const url = new URL(req.url);
  const id = String(url.searchParams.get("id") || "").trim();
  const [shellRes, row] = await Promise.all([
    fetch(new URL("/app.html", url.origin)),
    // Other hosts (partners., owners., society.) draw their own apps at this path.
    /^(www\.)?moveazy\.co\.in$|\.vercel\.app$/i.test(url.hostname) ? fetchAppListingRow(id) : Promise.resolve(null),
  ]);
  const shell = await shellRes.text();
  let html = shell;
  if (shellRes.ok && row) {
    try { html = withListing(shell, row); } catch { html = shell; }
  }
  return new Response(html, {
    status: shellRes.ok ? 200 : shellRes.status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Browsers always ask again; the edge keeps a copy (10 minutes fresh, then
      // served while it refreshes). The page re-checks the flat as soon as it is
      // drawn (PropertyPage), so a changed rent or a rented flat shows at once anyway.
      "cache-control": "public, max-age=0, must-revalidate",
      "cdn-cache-control": "public, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
