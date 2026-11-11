/**
 * A building's page (/building/<code>, src/pages/BuildingPage.jsx) as plain
 * HTML — its photo, name, area, the available / rent / floors boxes and the
 * amenities — drawn before the app's code arrives, then replaced by the app
 * when it has drawn the same thing (BuildingPage hands over). Same class names
 * as the page; the styles are a copy of the part of its CSS this uses, so keep
 * them in step with BuildingPage.jsx. The button at the bottom differs by
 * building (call the caretaker / schedule a visit) and comes with the app.
 */
import { esc } from "./_listing.js";
import { ICON, PREPAINT_BASE_CSS, withPrepaint } from "./_adPrepaint.js";

const CSS = `${PREPAINT_BASE_CSS}
.bp{--deep:#063B2D;--em:#0A6B4E;--emt:#E7F2EC;--champ2:#F4EBD8;--champ3:#8A6A2F;--cream:#F7F4EC;--ink:#17211D;--dim:#5E6B66;--mute:#94A09B;--line2:#EFEBE0;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--cream);min-height:100dvh}
.bp *,.bp *::before,.bp *::after{box-sizing:border-box}
.bp-top{position:sticky;top:0;z-index:20;height:56px;display:flex;align-items:center;justify-content:center;background:rgba(247,244,236,.92);border-bottom:1px solid var(--line2)}
.bp-top img{height:26px!important;width:auto;display:block}
.bp-col{max-width:560px;margin:0 auto;padding:0 0 110px}
.bp-gwrap{position:relative}
.bp-gallery{display:flex;overflow:hidden;aspect-ratio:4/3;background:#E9E4D6}
.bp-gallery>div{flex:0 0 100%;height:100%}
.bp-gallery img{width:100%;height:100%!important;object-fit:cover;display:block}
.bp-gallery--none{display:grid;place-items:center;color:var(--mute)}
.bp-gcount{position:absolute;right:12px;top:12px;background:rgba(0,0,0,.55);color:#fff;font-size:12px;font-weight:600;border-radius:99px;padding:4px 10px}
.bp-dots{position:absolute;left:0;right:0;bottom:30px;display:flex;gap:5px;justify-content:center}
.bp-dots i{width:6px;height:6px;border-radius:99px;background:rgba(255,255,255,.55)}
.bp-dots i.on{width:18px;background:#fff}
.bp-head{background:#fff;margin:-18px 12px 0;position:relative;border-radius:20px;padding:18px 16px 16px;box-shadow:0 10px 30px rgba(6,59,45,.10);border:1px solid var(--line2)}
.bp-verified{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:var(--em);background:var(--emt);border-radius:99px;padding:4px 10px}
.bp-head h1{font-size:24px;line-height:1.2;margin:10px 0 4px;letter-spacing:-.02em}
.bp-where{display:flex;align-items:center;gap:5px;color:var(--dim);font-size:14px}
.bp-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
.bp-facts>div{background:var(--cream);border-radius:14px;padding:10px;min-width:0}
.bp-facts b{display:block;font-size:17px;font-weight:800;color:var(--deep);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bp-facts span{font-size:11.5px;color:var(--dim)}
.bp-amen{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.bp-amen span{display:inline-flex;align-items:center;gap:4px;font-size:12.5px;color:var(--deep);background:var(--champ2);border-radius:99px;padding:5px 10px;font-weight:600}
.bp-amen svg{color:var(--champ3)}
.bp-desc{color:var(--dim);font-size:14px;line-height:1.55;margin:12px 0 0;white-space:pre-line}`;

const TICK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>';
const CHECK15 = ICON.CHECK.replace(/width="16" height="16"/, 'width="15" height="15"');

// src/lib/buildings.js shortInr.
const shortInr = (n) => {
  const v = Number(n) || 0;
  if (!v) return "";
  if (v >= 100000) return `₹${(v / 100000).toFixed(v % 100000 ? 1 : 0)}L`;
  return `₹${Math.round(v / 1000)}k`;
};

/** The top of the building's page; `photos` as the page orders them, `lead` the first one's thumbnail. */
export function buildingPrepaint(b, photos, lead) {
  const flats = b.flats ?? [];
  const available = flats.filter((f) => f.available);
  const total = Math.max(Number(b.total_flats) || 0, flats.length);
  const rents = available.map((f) => Number(f.rent) || 0).filter(Boolean);
  const facts = [`<div><b>${available.length}</b><span>of ${total} flat${total === 1 ? "" : "s"} available</span></div>`];
  if (rents.length) {
    const lo = Math.min(...rents);
    facts.push(`<div><b>${esc(shortInr(lo))}${rents.length > 1 && Math.max(...rents) !== lo ? "+" : ""}</b><span>${rents.length > 1 ? "rent from" : "rent"} / month</span></div>`);
  }
  if (b.total_floors != null) facts.push(`<div><b>${b.total_floors === 0 ? "G" : `G+${esc(b.total_floors)}`}</b><span>floors</span></div>`);
  const n = photos.length;
  const gallery = n
    ? `<div class="bp-gwrap"><div class="bp-gallery"><div>${lead ? `<img src="${esc(lead)}" alt="${esc(b.name)}">` : ""}</div></div>${n > 1 ? `<div class="bp-gcount">1 / ${n}</div><div class="bp-dots">${Array.from({ length: Math.min(n, 10) }, (_, i) => `<i${i === 0 ? ' class="on"' : ""}></i>`).join("")}</div>` : ""}</div>`
    : `<div class="bp-gallery bp-gallery--none"></div>`;
  const amen = (b.amenities ?? []).length ? `<div class="bp-amen">${b.amenities.map((a) => `<span>${TICK} ${esc(a)}</span>`).join("")}</div>` : "";
  return `<div class="bp"><header class="bp-top"><img src="/moveazy-logo-mint-light.png" alt="MovEazy" width="112" height="26"></header>
<main class="bp-col">${gallery}<section class="bp-head"><div class="bp-verified">${CHECK15} Listed with MovEazy</div>
<h1>${esc(b.name)}</h1><div class="bp-where">${ICON.PIN} ${esc([b.area, b.landmark].filter(Boolean).join(" · ") || "Bengaluru")}</div>
<div class="bp-facts">${facts.join("")}</div>${amen}${b.description ? `<p class="bp-desc">${esc(b.description)}</p>` : ""}</section></main></div>`;
}

export const withBuildingPrepaint = (html, b, photos, lead) => withPrepaint(html, CSS, buildingPrepaint(b, photos, lead));
