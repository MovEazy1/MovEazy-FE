/**
 * The Meta-ad page (/visit/<flat or building>, src/pages/VisitAdPage.jsx) as
 * plain HTML, drawn before any of the app's code has arrived — photo, title,
 * rent, Schedule a visit — then replaced by the app when it has drawn the same
 * thing (lib/prerender.js; VisitAdPage hands over). Same class names as the
 * page; the styles below are a copy of the part of its CSS this uses, so keep
 * them in step with VisitAdPage.jsx's CSS.
 */
import { esc } from "./_listing.js";

const ICON = {
  PIN: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg>',
  BED: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"></path><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"></path><path d="M12 4v6"></path><path d="M2 18h20"></path></svg>',
  BATH: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 4 8 6"></path><path d="M17 19v2"></path><path d="M2 12h20"></path><path d="M7 19v2"></path><path d="M9 5 7.621 3.621A2.121 2.121 0 0 0 4 5v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"></path></svg>',
  RULER: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"></path><path d="m14.5 12.5 2-2"></path><path d="m11.5 9.5 2-2"></path><path d="m8.5 6.5 2-2"></path><path d="m17.5 15.5 2-2"></path></svg>',
  SOFA: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"></path><path d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"></path><path d="M4 18v2"></path><path d="M20 18v2"></path><path d="M12 4v9"></path></svg>',
  BLDG: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 12h4"></path><path d="M10 8h4"></path><path d="M14 21v-3a2 2 0 0 0-4 0v3"></path><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"></path><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"></path></svg>',
  CHECK: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"></path><path d="m9 12 2 2 4-4"></path></svg>',
  CAL: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path><path d="m9 16 2 2 4-4"></path></svg>',
};

const CSS = `html:not(.mz-pre) #prerender{display:none}html.mz-pre #root{position:absolute;top:0;left:0;right:0;visibility:hidden;pointer-events:none}html.mz-pre #root *{animation-play-state:paused!important}body{margin:0}
.va{--deep:#063B2D;--em:#0A6B4E;--cream:#F7F4EC;--ink:#17211D;--dim:#5E6B66;--line:#E6E1D4;--line2:#EFEBE0;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--cream);min-height:100dvh}
.va *,.va *::before,.va *::after{box-sizing:border-box}
.va-top{position:sticky;top:0;z-index:20;height:56px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 16px;background:rgba(247,244,236,.92);border-bottom:1px solid var(--line2)}
.va-top img{height:26px!important;width:auto;display:block}
.va-explore{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--em);background:#fff;color:var(--em);border-radius:99px;padding:6px 11px;font-size:12.5px;font-weight:700;white-space:nowrap}
.va-col{max-width:560px;margin:0 auto;padding:0 0 110px}
.va-gwrap{position:relative}
.va-gallery{display:flex;overflow:hidden;aspect-ratio:4/3;background:#E9E4D6}
.va-gallery>div{flex:0 0 100%;height:100%}
.va-gallery img{width:100%;height:100%!important;object-fit:cover;display:block}
.va-gallery--none{display:grid;place-items:center;color:#94A09B}
.va-gcount{position:absolute;right:12px;top:12px;background:rgba(0,0,0,.55);color:#fff;font-size:12px;font-weight:600;border-radius:99px;padding:4px 10px}
.va-dots{position:absolute;left:0;right:0;bottom:30px;display:flex;gap:5px;justify-content:center}
.va-dots i{width:6px;height:6px;border-radius:99px;background:rgba(255,255,255,.55)}
.va-dots i.on{width:18px;background:#fff}
.va-head{background:#fff;margin:-18px 12px 0;position:relative;border-radius:20px;padding:18px 16px 16px;border:1px solid var(--line2);box-shadow:0 8px 24px rgba(6,59,45,.08)}
.va-head h1{font-size:22px;line-height:1.2;margin:0;letter-spacing:-.01em}
.va-where{display:flex;align-items:center;gap:5px;color:var(--dim);font-size:14px;margin-top:6px}
.va-rent{margin-top:12px;font-size:14px;color:var(--dim)}
.va-rent b{font-size:26px;color:var(--deep);letter-spacing:-.02em}
.va-money{display:flex;gap:8px;margin-top:10px}
.va-money span{flex:1;display:flex;flex-direction:column;gap:2px;background:var(--cream);border-radius:12px;padding:9px 11px}
.va-money small{font-size:11.5px;color:var(--dim);font-weight:600}
.va-money b{font-size:16px}
.va-facts{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.va-facts span{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);border-radius:99px;padding:6px 10px;font-size:13px;color:var(--ink)}
.va-facts svg{color:var(--em)}
.va-trust{display:flex;align-items:center;gap:6px;margin-top:12px;font-size:12.5px;color:var(--em);font-weight:700}
.va-cta{position:fixed;left:0;right:0;bottom:0;z-index:30;padding:10px 16px 10px;background:linear-gradient(180deg,rgba(247,244,236,0),var(--cream) 30%)}
.va-cta .va-btn{max-width:528px;margin:0 auto}
.va-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;border:0;border-radius:14px;padding:15px 16px;font-size:16px;font-weight:800;color:#fff;background:var(--em);box-shadow:0 8px 20px rgba(10,107,78,.28)}`;

const HEAD_SCRIPT = `<script>(function(){try{document.documentElement.classList.add("mz-pre");setTimeout(function(){document.documentElement.classList.remove("mz-pre");var p=document.getElementById("prerender");if(p)p.remove();},15000);}catch(e){}})();</script>`;

// VisitAdPage's own formatting.
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const short = (n) => {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(v % 100000 ? 1 : 0)}L`;
  if (v >= 1000) return `₹${Math.round(v / 1000)}k`;
  return inr(v);
};

/** The top of the ad page for `kind` ("flat" | "building"), its photos already ordered (`photos`). */
export function adPrepaint(kind, d, photos, lead) {
  const building = kind === "building";
  const title = building ? d.name : [d.flat_type, d.furnishing].filter(Boolean).join(" · ") || d.title || "Flat for rent";
  const where = [d.area, d.landmark].filter(Boolean).join(" · ");
  const rent = building
    ? (d.rent_from ? `From <b>${esc(inr(d.rent_from))}</b><small> / month</small>` : "<b>Rent on request</b>")
    : (d.rent ? `<b>${esc(inr(d.rent))}</b><small> / month</small>` : "<b>Rent on request</b>");
  const money = !building && (Number(d.deposit) > 0 || Number(d.maintenance) > 0)
    ? `<div class="va-money">${Number(d.deposit) > 0 ? `<span><small>Deposit</small><b>${esc(short(d.deposit))}</b></span>` : ""}${Number(d.maintenance) > 0 ? `<span><small>Maintenance</small><b>${esc(inr(d.maintenance))}</b></span>` : ""}</div>`
    : "";
  const facts = (building
    ? [d.flat_types?.length ? [ICON.BED, d.flat_types.join(", ")] : null, d.total_floors ? [ICON.BLDG, `${d.total_floors} floors`] : null]
    : [d.bedrooms ? [ICON.BED, `${d.bedrooms} bed`] : null, d.bathrooms ? [ICON.BATH, `${d.bathrooms} bath`] : null,
      d.area_sqft ? [ICON.RULER, `${d.area_sqft} sq ft`] : null, d.furnishing ? [ICON.SOFA, d.furnishing] : null]).filter(Boolean);
  const n = photos.length;
  const gallery = n
    ? `<div class="va-gwrap"><div class="va-gallery"><div>${lead ? `<img src="${esc(lead)}" alt="${esc(title)}">` : ""}</div></div>${n > 1 ? `<div class="va-gcount">1 / ${n}</div><div class="va-dots">${Array.from({ length: Math.min(n, 8) }, (_, i) => `<i${i === 0 ? ' class="on"' : ""}></i>`).join("")}</div>` : ""}</div>`
    : `<div class="va-gallery va-gallery--none"></div>`;
  return `<div class="va"><header class="va-top"><img src="/moveazy-logo-mint-light.png" alt="MovEazy" width="112" height="26"><span class="va-explore"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"></path><circle cx="12" cy="12" r="10"></circle></svg> Explore more</span></header>
<main class="va-col">${gallery}<section class="va-head"><h1>${esc(title)}</h1>${where ? `<div class="va-where">${ICON.PIN} ${esc(where)}</div>` : ""}
<div class="va-rent">${rent}</div>${money}${facts.length ? `<div class="va-facts">${facts.map(([i, t]) => `<span>${i} ${esc(t)}</span>`).join("")}</div>` : ""}
<div class="va-trust">${ICON.CHECK} Verified by MovEazy · free visit</div></section>
<div class="va-cta"><div class="va-btn">${ICON.CAL} Schedule a visit</div></div></main></div>`;
}

/** The shell with the drawn ad page; the app's stylesheet stops holding up the first paint (the copy has its own). */
export function withAdPrepaint(html, kind, d, photos, lead) {
  return withPrepaint(html, CSS, adPrepaint(kind, d, photos, lead));
}

/** Any drawn page: its styles and markup in, the app's stylesheet no longer holding up the first paint. */
export function withPrepaint(html, css, body, logo = "/moveazy-logo-mint-light.png") {
  return html
    .replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/, (_, href) =>
      `<link rel="preload" as="style" crossorigin href="${href}"><link rel="stylesheet" crossorigin href="${href}" media="print" onload="this.media='all'">`)
    .replace("</head>", `<link rel="preload" as="image" href="${logo}">${HEAD_SCRIPT}<style>${css}</style></head>`)
    .replace('<div id="root"></div>', `<div id="prerender">${body}</div><div id="root"></div>`);
}

/** The hand-over rules every drawn page needs, ahead of its own styles. */
export const PREPAINT_BASE_CSS = "html:not(.mz-pre) #prerender{display:none}html.mz-pre #root{position:absolute;top:0;left:0;right:0;visibility:hidden;pointer-events:none}html.mz-pre #root *{animation-play-state:paused!important}body{margin:0}";
export { ICON };
