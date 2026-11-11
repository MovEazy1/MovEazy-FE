/**
 * A partner broker's page (/b/<code>, src/pages/Storefront.jsx) as plain HTML
 * — the broker's card, WhatsApp / call, the size chips and the first homes —
 * drawn before the app's code arrives and replaced when the app has drawn
 * (Storefront hands over). Drawn from what anyone may see (the signed-out
 * read); the app still makes its own, which knows the viewer's likes. Same
 * class names as the page; the styles are a copy of the part of its CSS this
 * uses, so keep them in step with Storefront.jsx.
 */
import { esc } from "./_listing.js";
import { ICON, PREPAINT_BASE_CSS, withPrepaint } from "./_adPrepaint.js";

const CSS = `${PREPAINT_BASE_CSS}
.sf{--deep:#0A3A2A;--deep2:#05241A;--gold:#E4B659;--gold2:#F7E9C6;--ink:#13201B;--dim:#56655F;--line:#E6E2D6;--cream:#F7F5EE;min-height:100dvh;background:var(--cream);color:var(--ink);font-family:Manrope,Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.sf *,.sf *::before,.sf *::after{box-sizing:border-box}
.sf-col{width:100%;max-width:760px;margin:0 auto;padding:0 16px}
.sf-hero{background:radial-gradient(120% 100% at 0% 0%,#1B6B4E,var(--deep) 55%,var(--deep2));color:#fff;padding:18px 0 22px}
.sf .sf-logo{height:24px;width:auto;display:block}
.sf-who{display:flex;gap:16px;align-items:center;margin-top:20px}
.sf .sf-photo{width:84px;height:84px;border-radius:99px;object-fit:cover;border:3px solid var(--gold);flex:none;background:var(--gold2)}
.sf-photo--none{display:grid;place-items:center;font-size:30px;font-weight:800;color:#8A6419}
.sf-who h1{margin:0;font-size:25px;line-height:1.15;letter-spacing:-.02em;font-weight:800;color:#fff}
.sf-agency{margin:2px 0 0;font-size:14px;opacity:.75}
.sf-rating{margin:6px 0 0;display:flex;align-items:center;gap:5px;font-size:14px}
.sf-new{opacity:.75}
.sf-badge{display:inline-flex;align-items:center;gap:4px;margin-top:8px;font-size:12px;font-weight:800;color:#1F1605;background:var(--gold);border-radius:99px;padding:3px 9px}
.sf-count{display:flex;align-items:center;gap:6px;margin:16px 0 0;font-size:14px;opacity:.85}
.sf-contact{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.sf-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;border-radius:14px;font-weight:800;font-size:15px;border:1px solid transparent;padding:0 16px}
.sf-btn--wa{background:#22C55E;color:#fff}
.sf-btn--ghost{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.3);color:#fff}
.sf-main{padding-top:16px;padding-bottom:40px}
.sf-chips{display:flex;gap:8px;overflow:hidden;padding-bottom:2px}
.sf-chip{flex:none;border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:99px;padding:8px 14px;font-size:14px;font-weight:700}
.sf-chip.on{background:var(--deep);border-color:var(--deep);color:#fff}
.sf-disclose{display:flex;align-items:center;gap:6px;margin:12px 0 14px;font-size:12.5px;color:var(--dim)}
.sf-grid{display:grid;gap:14px}
@media (min-width:640px){.sf-grid{grid-template-columns:1fr 1fr}}
.sf-card{position:relative;background:#fff;border-radius:18px;overflow:hidden;border:1px solid var(--line)}
.sf-img{display:block;height:210px;overflow:hidden;background:#E5E7EB;position:relative}
.sf-img img{width:100%;height:100%!important;object-fit:cover;display:block}
.sf-heart{position:absolute;top:10px;right:10px;width:42px;height:42px;border-radius:99px;background:#fff;display:grid;place-items:center;box-shadow:0 6px 16px rgba(0,0,0,.18)}
.sf-body{display:block;padding:12px 14px 14px}
.sf-rent{font-size:21px;font-weight:800;letter-spacing:-.01em}
.sf-rent small{font-size:13px;font-weight:600;color:var(--dim)}
.sf-line{font-size:15px;font-weight:700;margin-top:2px}
.sf-meta{font-size:13px;color:var(--dim);margin-top:2px}
.sf-visit{display:flex;width:calc(100% - 28px);margin:0 14px 14px;align-items:center;justify-content:center;gap:8px;min-height:46px;border-radius:12px;background:var(--deep);color:#fff;font-size:15px;font-weight:800}`;

const WA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.04 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.56.94.95-3.47-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.9.99 6.68 2.77a9.37 9.37 0 0 1 2.76 6.68c0 5.21-4.24 9.44-9.44 9.44m8.04-17.48A11.3 11.3 0 0 0 12.04.7C5.77.7.67 5.8.67 12.07c0 2 .52 3.96 1.52 5.68L.57 23.7l6.08-1.6a11.3 11.3 0 0 0 5.4 1.38h.01c6.27 0 11.37-5.1 11.37-11.37 0-3.04-1.18-5.9-3.33-8.05"></path></svg>';
const PHONE = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"></path></svg>';
const STAR = '<svg width="15" height="15" viewBox="0 0 24 24" fill="#E4B659" stroke="#E4B659" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path></svg>';
const HEART = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"></path></svg>';
const HEART13 = '<svg width="13" height="13" viewBox="0 0 24 24" fill="#E11D48" stroke="#E11D48" stroke-width="2" aria-hidden="true"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"></path></svg>';
const CAL17 = ICON.CAL.replace(/width="19" height="19"/, 'width="17" height="17"');
const BADGE13 = ICON.CHECK.replace(/width="16" height="16"/, 'width="13" height="13"');
const PIN14 = ICON.PIN.replace(/width="15" height="15"/, 'width="14" height="14"');

const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "The broker";
const initials = (n) => String(n || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "M";
const mobile = (p) => { const d = String(p || "").replace(/\D/g, "").slice(-10); return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : String(p || ""); };
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/** The broker's page as a signed-out visitor first sees it. `cover(h)`: a home's first photo (480 px copy), or "". */
export function storefrontPrepaint(d, cover) {
  const b = d.broker || {};
  const homes = d.homes ?? [];
  const types = [...new Set(homes.map((h) => h.flat_type).filter(Boolean))].sort();
  const rating = Number(b.rating) > 0
    ? `${STAR} <b>${Number(b.rating).toFixed(1)}</b>${b.from_tenants ? ` · ${Number(b.ratings) || 0} ratings` : ""}`
    : '<span class="sf-new">New on MovEazy</span>';
  const photo = b.photo_url
    ? `<img class="sf-photo" src="${esc(b.photo_url)}" alt="${esc(b.name)}" width="84" height="84">`
    : `<span class="sf-photo sf-photo--none" aria-hidden="true">${esc(initials(b.name))}</span>`;
  const cards = homes.slice(0, 2).map((h, i) => {
    const src = cover(h);
    return `<article class="sf-card"><div class="sf-img">${src && i === 0 ? `<img src="${esc(src)}" alt="">` : ""}</div><span class="sf-heart">${HEART}</span>
<div class="sf-body"><div class="sf-rent">${esc(inr(h.rent))} <small>/ month</small></div><div class="sf-line">${esc([h.flat_type, h.area].filter(Boolean).join(" · "))}</div><div class="sf-meta">${esc([h.furnishing, h.property_type].filter(Boolean).join(" · "))}</div></div>
<div class="sf-visit">${CAL17} Schedule visit</div></article>`;
  }).join("");
  const list = homes.length
    ? `${types.length > 1 ? `<div class="sf-chips"><span class="sf-chip on">All ${homes.length}</span>${types.map((t) => `<span class="sf-chip">${esc(t)}</span>`).join("")}</div>` : ""}
<p class="sf-disclose">${HEART13} Like a home and ${esc(firstName(b.name))} sees your name and number, so they can call you.</p><div class="sf-grid">${cards}</div>`
    : "";
  return `<div class="sf"><header class="sf-hero"><div class="sf-col"><img src="/moveazy-logo-mint-dark.png" alt="MovEazy" height="24" class="sf-logo">
<div class="sf-who">${photo}<div style="min-width:0"><h1>${esc(b.name)}</h1>${b.agency ? `<p class="sf-agency">${esc(b.agency)}</p>` : ""}<p class="sf-rating">${rating}</p><span class="sf-badge">${BADGE13} Verified MovEazy partner</span></div></div>
<p class="sf-count">${PIN14} ${homes.length} home${homes.length === 1 ? "" : "s"} listed</p>
${b.phone ? `<div class="sf-contact"><span class="sf-btn sf-btn--wa">${WA} WhatsApp</span><span class="sf-btn sf-btn--ghost">${PHONE} ${esc(mobile(b.phone))}</span></div>` : ""}
</div></header><main class="sf-col sf-main">${list}</main></div>`;
}

export const withStorefrontPrepaint = (html, d, cover) => withPrepaint(html, CSS, storefrontPrepaint(d, cover), "/moveazy-logo-mint-dark.png");
