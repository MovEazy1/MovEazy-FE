/**
 * The shortlist our team sent one person (/curated/<token>,
 * src/pages/CuratedProperties.jsx) as plain HTML: the header, "Ravi, we found
 * these for you", Schedule a Visit, the counter, the first home's card and the
 * two buttons — drawn before the app's code arrives, replaced once the app has
 * drawn (CuratedProperties hands over). The card opens on the first home not
 * yet answered, as the deck does. Inline styles copied from the page and
 * SwipeDeck.jsx, so keep them in step.
 */
import { esc } from "./_listing.js";
import { PREPAINT_BASE_CSS, withPrepaint } from "./_adPrepaint.js";
import { postedAgo } from "./property-page.js";

const VIDEO_EXT = /\.(mp4|m4v|webm|ogv|ogg|mov|qt|3gp)(?:[?#]|$)/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp|svg)(?:[?#]|$)/i;
const isVideo = (u) => !IMAGE_EXT.test(u) && (VIDEO_EXT.test(u) || /\/videos?\//i.test(u));

/** Statuses that mean a home has been answered for (CuratedProperties ANSWERED). */
const ANSWERED = new Set(["liked", "disliked", "okay", "visit_scheduled", "visited", "rejected"]);

const svg = (size, paths, extra = "") =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${paths}</svg>`;
const HEART = '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>';
const I = {
  back: svg(21, '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'),
  heart: svg(20, HEART),
  cal: svg(16, '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>', ' stroke-width="2.2"'),
  pin: svg(13, '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>', ' style="flex-shrink:0"'),
  bed: svg(14, '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/>'),
  bath: svg(14, '<path d="M10 4 8 6"/><path d="M17 19v2"/><path d="M2 12h20"/><path d="M7 19v2"/><path d="M9 5 7.621 3.621A2.121 2.121 0 0 0 4 5v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>'),
  layers: svg(14, '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>'),
  check: svg(12, '<path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>', ' style="color:#0E7C68;flex-shrink:0"'),
  shield: svg(12, '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>'),
  x: svg(22, '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', ' stroke-width="2.4"'),
  like: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${HEART}</svg>`,
};

const CSS = `${PREPAINT_BASE_CSS}
.tc{min-height:100dvh;background:#fff;color:#171412;font-family:Manrope,Inter,sans-serif;-webkit-font-smoothing:antialiased}
.tc *{box-sizing:border-box}
.tc-ic{width:38px;height:38px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.tc-st{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:600;color:#5c554e}
.tc-pill{background:rgba(4,33,29,.72);font-size:11px;padding:4px 9px;border-radius:999px}`;

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const list = (v) => (Array.isArray(v) ? v.filter(Boolean).map(String) : []);

/** The rows in the list's order, as the page keeps them (gone ones drop out). */
export function teamListRows(open, rows) {
  const byId = new Map((rows || []).map((r) => [String(r.property_id), r]));
  return (open?.property_ids || []).map((id) => byId.get(String(id))).filter(Boolean);
}

/** Where the deck opens: the first home not yet answered, else the first. */
export function teamListStart(open, rows) {
  const r = open?.reactions || {};
  const i = rows.findIndex((row) => !ANSWERED.has(r[row.property_id]));
  return i < 0 ? 0 : i;
}

/** The card's photo: a still first, as SwipeDeck's cardCover; "" when it has none. */
export function teamCardPhoto(row) {
  return [row?.cover_image_url, ...list(row?.images)].map((u) => String(u || "").trim()).find((u) => u && !isVideo(u)) || "";
}

function card(row, photo, now) {
  const rent = num(row.rent);
  const bedrooms = num(row.bedrooms) || Number(String(row.flat_type || "").match(/\d+/)?.[0]) || 0;
  const bhk = String(row.flat_type || "").trim() || (bedrooms ? `${bedrooms} BHK` : "Home");
  const furnishing = String(row.furnishing || "").trim();
  const address = String(row.full_address || "").trim() || [row.landmark, row.area].filter(Boolean).join(", ") || String(row.area || "").trim();
  const floor = row.floor_number == null ? "" : String(row.floor_number);
  const ago = postedAgo(row.created_at, now);
  const stats = [
    bedrooms ? [I.bed, `${bedrooms} Bed`] : null,
    num(row.bathrooms) ? [I.bath, `${num(row.bathrooms)} Bath`] : null,
    floor ? [I.layers, `Floor ${floor}`] : null,
  ].filter(Boolean);
  const amenities = list(row.amenities).slice(0, 4);
  return `<div style="height:100%;background:#fff;border-radius:22px;overflow:hidden;border:1px solid #e9e3db;box-shadow:0 10px 34px rgba(23,20,18,.14);display:flex;flex-direction:column">`
    + `<div style="position:relative;height:56%;background:#efe7dc;flex-shrink:0">${photo ? `<img src="${esc(photo)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">` : ""}`
    + `<div style="position:absolute;top:10px;left:10px;right:10px;display:flex;align-items:center;gap:8px">`
    + (row.is_verified ? `<span class="tc-pill" style="display:inline-flex;align-items:center;gap:4px;color:#5EEAD4;font-weight:700">${I.shield} Verified</span>` : "")
    + `<span style="flex:1"></span>${ago ? `<span class="tc-pill" style="color:#fff;font-weight:600">${esc(ago)}</span>` : ""}</div></div>`
    + `<div style="flex:1;min-width:0;padding:14px 16px;display:flex;flex-direction:column;gap:5px;overflow:hidden">`
    + `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px"><div style="font-weight:800;font-size:21px;letter-spacing:-.01em;flex-shrink:0">${rent > 0 ? `₹${rent.toLocaleString("en-IN")}` : "Price on request"}</div>`
    + `<div style="font-size:12.5px;font-weight:700;color:#5c554e;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(bhk)}${furnishing ? ` · ${esc(furnishing)}` : ""}</div></div>`
    + `<div style="display:flex;align-items:center;gap:4px;font-size:12.5px;color:#5c554e;overflow:hidden;white-space:nowrap">${I.pin}<span style="overflow:hidden;text-overflow:ellipsis">${esc(address)}</span></div>`
    + (stats.length ? `<div style="display:flex;gap:14px;margin-top:2px">${stats.map(([ic, t]) => `<span class="tc-st">${ic}${esc(t)}</span>`).join("")}</div>` : "")
    + (amenities.length ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;margin-top:6px">${amenities.map((a) => `<span style="display:flex;align-items:center;gap:5px;font-size:11.5px;color:#5c554e;overflow:hidden;white-space:nowrap">${I.check}${esc(a)}</span>`).join("")}</div>` : "")
    + `<span style="margin-top:auto;align-self:flex-start;font-size:12.5px;font-weight:700;color:#ee5b45">View details →</span></div></div>`;
}

/** The page as it opens on the list (`rows` in order, non-empty). `photo` is the top card's image URL. */
export function teamCuratedPrepaint(open, rows, photo, now = Date.now()) {
  const n = rows.length;
  const start = teamListStart(open, rows);
  const first = String(open?.client_name || "").split(/\s+/)[0];
  const agent = String(open?.agent_name || "");
  const behind = rows.slice(start + 1, start + 3).map((_, j) => {
    const i = j + 1;
    return `<div style="position:absolute;inset:0;z-index:${10 - i};transform:translateY(${i * 14}px) scale(${1 - i * 0.04})"><div style="height:100%;background:#fff;border-radius:22px;border:1px solid #e9e3db;box-shadow:0 10px 34px rgba(23,20,18,.14)"></div></div>`;
  }).reverse().join("");
  return `<div class="tc"><div style="display:flex;align-items:center;gap:10px;padding:14px 16px 2px"><span class="tc-ic">${I.back}</span>`
    + `<div style="min-width:0;flex:1;text-align:center"><div style="font-size:13.5px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${n} ${n === 1 ? "home" : "homes"} shortlisted for you</div>`
    + `<div style="font-size:11.5px;color:#948c83;margin-top:1px">${agent ? `Picked by ${esc(agent)} · MovEazy` : "Picked by the MovEazy team"}</div></div><span class="tc-ic">${I.heart}</span></div>`
    + `<div style="max-width:480px;margin:0 auto;padding:8px 16px 60px">`
    + `<h1 style="font-weight:800;font-size:22px;text-align:center;margin:6px 0 4px">${first ? `${esc(first)}, we found these for you` : "Shortlisted for you"}</h1>`
    + `<p style="text-align:center;color:#5c554e;font-size:13px;margin:0 0 14px">Swipe right to shortlist, left to skip. Tap a home to see everything about it.</p>`
    + `<div style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:4px 4px 30px">`
    + `<div style="width:100%;max-width:380px"><div style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 16px;border-radius:12px;background:#04211D;color:#fff;font-size:13.5px;font-weight:700;box-shadow:0 6px 18px rgba(4,33,29,.22)">${I.cal}Schedule a Visit</div></div>`
    + `<div style="display:flex;justify-content:center;width:100%;max-width:380px"><span style="font-size:12px;font-weight:700;color:#948c83">Viewing ${start + 1} out of ${n} shortlisted ${n === 1 ? "property" : "properties"}</span></div>`
    + `<div style="position:relative;width:100%;max-width:380px;height:clamp(330px,54vh,460px)">${behind}<div style="position:absolute;inset:0;z-index:10">${card(rows[start], photo, now)}</div></div>`
    + `<div style="display:flex;gap:20px;margin-top:2px"><span style="width:54px;height:54px;border-radius:50%;border:1px solid #e9e3db;background:#fff;color:#ee5b45;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(23,20,18,.10)">${I.x}</span>`
    + `<span style="width:54px;height:54px;border-radius:50%;background:#0E7C68;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(14,124,104,.32)">${I.like}</span></div>`
    + `</div></div></div>`;
}

/** The shell with the drawn page; its photo asked for at once. */
export function withTeamCuratedPrepaint(html, open, rows, photo) {
  const out = withPrepaint(html, CSS, teamCuratedPrepaint(open, rows, photo), "");
  return photo ? out.replace("</head>", `<link rel="preload" as="image" href="${esc(photo)}" fetchpriority="high"></head>`) : out;
}
