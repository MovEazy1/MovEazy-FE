/**
 * A partner's shortlist (/c/<token>, src/pages/CuratedSwipe.jsx) as plain HTML
 * for a first visit: the partner's header and "Your homes are ready" — drawn
 * before the app's code arrives and replaced when the app has drawn
 * (CuratedSwipe hands over). The form is drawn, not live: nothing typed into
 * the copy could be carried over, so its fields only look like fields until
 * the app's are there. A visitor who has given their number before (or a
 * MovEazy tenant's list) goes straight to the homes, so isn't drawn this way.
 * Same class names as the page; the styles are a copy of the part of its CSS
 * this uses, so keep them in step with CuratedSwipe.jsx.
 */
import { esc } from "./_listing.js";
import { PREPAINT_BASE_CSS, withPrepaint } from "./_adPrepaint.js";

const CSS = `${PREPAINT_BASE_CSS}
.cs{min-height:100dvh;background:#F7F5EE;color:#13201B;font-family:Manrope,Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.cs *,.cs *::before,.cs *::after{box-sizing:border-box}
.cs-col{max-width:480px;margin:0 auto;padding:0 16px 28px}
.cs-head{background:radial-gradient(120% 100% at 0% 0%,#1B6B4E,#0A3A2A 55%,#05241A);color:#fff;padding:16px 16px 18px}
.cs .cs-logo{height:22px;width:auto;display:block}
.cs-broker{display:flex;align-items:center;gap:12px;margin-top:14px;max-width:480px}
.cs .cs-photo{width:46px;height:46px;border-radius:99px;object-fit:cover;border:2px solid #E4B659;flex:none}
.cs-photo--none{display:grid;place-items:center;background:#F7E9C6;color:#8A6419;font-weight:800}
.cs-broker b{display:block;font-size:17px}
.cs-broker span{font-size:13.5px;opacity:.8}
.cs-gate h1{font-size:26px;letter-spacing:-.02em;margin:22px 0 6px}
.cs-gate p{color:#56655F;margin:0 0 18px;line-height:1.5}
.cs-gate .lbl{display:block;font-size:13px;font-weight:700;margin:12px 0 6px}
.cs-gate .lbl small{font-weight:500;color:#56655F}
.cs-field{display:flex;align-items:center;gap:10px;background:#fff;border:2px solid #E6E2D6;border-radius:14px;padding:0 14px;min-height:54px}
.cs-field span{font-weight:800}
.cs-field i{font-style:normal;font-size:18px;font-weight:700;color:#9AA5A0}
.cs-input{width:100%;min-height:50px;border:2px solid #E6E2D6;border-radius:14px;padding:0 14px;font-size:16px;background:#fff;display:flex;align-items:center;color:#9AA5A0}
.cs-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:54px;margin-top:18px;border-radius:14px;font-size:16px;font-weight:800}
.cs-btn--gold{background:linear-gradient(180deg,#F2CD7A,#E4B659);color:#1F1605}
.cs-fine{font-size:12px;text-align:center;margin-top:12px!important;color:#56655F}
.cs-fine b{color:#0A3A2A;font-weight:700}`;

const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";
const initials = (n) => String(n || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "M";

/** The shortlist as a first-time visitor sees it (the number form). */
export function curatedPrepaint(d) {
  const b = d.broker || {};
  const n = (d.homes ?? []).length;
  const Partner = firstName(b.name) || "Your partner";
  const photo = b.photo_url
    ? `<img src="${esc(b.photo_url)}" alt="" width="46" height="46" class="cs-photo">`
    : `<span class="cs-photo cs-photo--none">${esc(initials(b.name))}</span>`;
  return `<div class="cs"><header class="cs-head"><img src="/moveazy-logo-mint-dark.png" alt="MovEazy" height="22" class="cs-logo">
<div class="cs-broker">${photo}<div><b>${esc(b.name || "Your partner")}</b><span>picked ${n} home${n === 1 ? "" : "s"} for you${d.lead_name ? `, ${esc(firstName(d.lead_name))}` : ""}</span></div></div></header>
<div class="cs-col cs-gate"><h1>Your homes are ready</h1><p>Enter your mobile number to start. ${esc(Partner)} sees the homes you like and sets up the visits.</p>
<span class="lbl">Mobile number</span><div class="cs-field"><span>+91</span><i>98765 43210</i></div>
<span class="lbl">Name <small>(optional)</small></span><div class="cs-input">Your name</div>
<div class="cs-btn cs-btn--gold">See my homes</div><p class="cs-fine">Shared only with ${esc(b.name || "your partner")}. <b>Terms</b></p></div></div>`;
}

/**
 * The shortlist page with its copy, unless this browser has given its number
 * for this list before (the app then opens on the homes, not the form).
 */
export function withCuratedPrepaint(html, token, d) {
  const out = withPrepaint(html, CSS, curatedPrepaint(d), "/moveazy-logo-mint-dark.png");
  const seen = `<script>try{if(localStorage.getItem(${JSON.stringify(`mz_curated_${token}`)})==="1"){document.documentElement.classList.remove("mz-pre");}}catch(e){}</script>`;
  return out.replace('<div id="prerender">', `${seen}<div id="prerender">`);
}
