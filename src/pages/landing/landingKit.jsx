/**
 * Shared pieces for the broker and owner landing pages (signed-out visitors
 * only; signing up continues straight into the app).
 *
 * One stylesheet scoped under .lp, themed by .lp--broker / .lp--owner, so the
 * two pages share structure but not colour. Responsive from 360px phones to
 * wide desktops; the page is a marketing page, not the phone-width app shell.
 */
import { useEffect, useState } from "react";
import { ArrowRight, Minus, Play, Plus, X } from "lucide-react";
// The official wordmark, as the main site's nav uses it: the mint pair has a
// transparent ground (the red "dark" file carries a black plate).
import logoOnLight from "../../assets/logo/moveazy-logo-mint-light.png";
import logoOnDark from "../../assets/logo/moveazy-logo-mint-dark.png";
import { useAuth } from "../../context/AuthContext";
import { fetchPublishedInventory } from "../../lib/inventory";
import { isVideoUrl } from "../../lib/listingMedia";

const CSS = `
.lp { --ink:#13201B; --dim:#56655F; --line:#E6E2D6; --white:#fff; font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
  color: var(--ink); background: var(--cream); overflow-x: hidden; -webkit-font-smoothing: antialiased; }
.lp--broker { --deep:#0A3A2A; --deep2:#05241A; --acc:#15803D; --accl:#E7F4EB; --gold:#E4B659; --gold2:#F7E9C6; --gold3:#8A6419; --cream:#F7F5EE; }
.lp--owner { --deep:#063B2D; --deep2:#032419; --acc:#0A6B4E; --accl:#E7F2EC; --gold:#D6B77C; --gold2:#F4EBD8; --gold3:#7E6031; --cream:#F7F4EC; }
.lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
.lp a { color: inherit; }
/* The site's base stylesheet colours every heading; here they follow their section. */
.lp h1, .lp h2, .lp h3 { color: inherit; }
.lp-screen { color: #111827; }
.lp-wrap { max-width: 1160px; margin: 0 auto; padding: 0 20px; }
.lp-nav { position: sticky; top: 0; z-index: 50; transition: background .2s ease, box-shadow .2s ease, border-color .2s ease;
  background: rgba(255,255,255,.72); backdrop-filter: saturate(1.6) blur(14px); -webkit-backdrop-filter: saturate(1.6) blur(14px);
  border-bottom: 1px solid transparent; }
.lp-nav.is-scrolled { background: rgba(255,255,255,.94); border-bottom-color: var(--line); box-shadow: 0 6px 24px rgba(10,40,30,.06); }
.lp-nav--dark { background: #072C20; color: #fff; }
.lp-nav--dark.is-scrolled { background: rgba(5,30,22,.94); border-bottom-color: rgba(255,255,255,.08); box-shadow: 0 6px 24px rgba(0,0,0,.25); }
.lp-nav .lp-wrap { display: flex; align-items: center; gap: 28px; height: 72px; }
.lp-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; flex: none; }
.lp-logo-img { display: block; height: 30px; width: auto; }
.lp-footer .lp-logo-img { height: 32px; }
.lp-product { font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; padding: 5px 9px; border-radius: 999px;
  background: var(--accl); color: var(--acc); }
.lp-nav--dark .lp-product { background: rgba(228,182,89,.14); color: var(--gold); }
.lp-links { display: flex; gap: 4px; font-size: 14.5px; font-weight: 600; }
.lp-links a { text-decoration: none; padding: 8px 12px; border-radius: 10px; opacity: .78; transition: opacity .15s, background .15s; }
.lp-links a:hover { opacity: 1; background: rgba(10,58,42,.06); }
.lp-nav--dark .lp-links a:hover { background: rgba(255,255,255,.08); }
.lp-signin { background: none; border: 0; font: inherit; font-size: 14.5px; font-weight: 600; color: inherit; cursor: pointer; padding: 8px 6px; opacity: .85; }
.lp-signin:hover { opacity: 1; }
.lp-navcta { display: flex; align-items: center; gap: 14px; }
.lp-spacer { flex: 1; }
.lp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: 14px; cursor: pointer;
  font: inherit; font-weight: 700; font-size: 16px; padding: 0 24px; min-height: 54px; text-decoration: none; transition: transform .12s ease, box-shadow .12s ease; }
.lp-btn:active { transform: translateY(1px); }
.lp-btn:disabled { opacity: .6; cursor: default; }
.lp-btn--gold { background: linear-gradient(180deg, #F2CD7A, var(--gold)); color: #1F1605; box-shadow: 0 10px 24px rgba(228,182,89,.35); }
.lp-btn--acc { background: var(--acc); color: #fff; box-shadow: 0 10px 24px rgba(10,107,78,.28); }
.lp-btn--ghost { background: transparent; border: 1.5px solid currentColor; }
.lp-btn--sm { min-height: 40px; font-size: 14px; padding: 0 16px; border-radius: 11px; box-shadow: none; }
.lp-hero { position: relative; overflow: hidden; }
.lp-hero--dark { background: radial-gradient(120% 90% at 85% 10%, #145C43 0%, var(--deep) 45%, var(--deep2) 100%); color: #fff; }
.lp-hero--light { background: radial-gradient(90% 80% at 90% 0%, #FFFFFF 0%, var(--cream) 60%); }
.lp-hero .lp-wrap { display: grid; grid-template-columns: 1.08fr .92fr; gap: 40px; align-items: center; padding-top: 56px; padding-bottom: 64px; }
.lp-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  padding: 7px 12px; border-radius: 999px; border: 1px solid currentColor; opacity: .92; }
.lp-hero--dark .lp-eyebrow { color: var(--gold); }
.lp-hero--light .lp-eyebrow { color: var(--acc); }
.lp-h1 { font-size: clamp(38px, 6.2vw, 68px); line-height: 1.02; letter-spacing: -0.035em; font-weight: 800; margin: 18px 0 18px; }
.lp-h1 .hl { color: var(--gold); }
.lp-hero--light .lp-h1 .hl { color: var(--acc); }
.lp-lead { font-size: clamp(16px, 1.6vw, 19px); line-height: 1.55; opacity: .88; max-width: 560px; margin: 0 0 22px; }
.lp-checks { display: flex; flex-wrap: wrap; gap: 10px 18px; margin: 0 0 26px; padding: 0; list-style: none; font-size: 14.5px; font-weight: 600; }
.lp-checks li { display: flex; align-items: center; gap: 7px; }
.lp-checks li::before { content: "✓"; width: 20px; height: 20px; border-radius: 999px; display: grid; place-items: center; font-size: 12px;
  background: var(--acc); color: #fff; }
.lp-hero--dark .lp-checks li::before { background: var(--gold); color: #1F1605; }
.lp-ctas { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.lp-price { margin-top: 14px; font-size: 14px; opacity: .9; }
.lp-price s { opacity: .6; margin: 0 4px; }
.lp-price b { font-size: 15px; }
.lp-phone-stage { position: relative; display: flex; justify-content: center; }
.lp-phone { width: 330px; max-width: 86vw; height: 660px; border-radius: 46px; background: #0C0F0E; padding: 11px; position: relative;
  box-shadow: 0 40px 80px rgba(0,0,0,.35), inset 0 0 0 2px #2A2F2D; }
.lp-phone::before { content: ""; position: absolute; top: 18px; left: 50%; transform: translateX(-50%); width: 92px; height: 24px; border-radius: 99px; background: #0C0F0E; z-index: 3; }
.lp-screen { width: 100%; height: 100%; border-radius: 36px; overflow: hidden; background: #F6F7F6; position: relative; pointer-events: none; }
.lp-screen-inner { position: absolute; inset: 0; overflow: hidden; }
.lp-chip { position: absolute; z-index: 4; background: rgba(255,255,255,.96); color: var(--ink); border-radius: 16px; padding: 12px 14px;
  box-shadow: 0 16px 40px rgba(0,0,0,.18); font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 10px; }
.lp-chip b { display: block; font-size: 18px; letter-spacing: -0.01em; }
.lp-chip .ic { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background: var(--gold2); color: var(--gold3); flex: none; }
.lp-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; background: #fff; border-radius: 20px; border: 1px solid var(--line);
  margin-top: -34px; position: relative; z-index: 5; box-shadow: 0 20px 40px rgba(10,40,30,.08); }
.lp-stat { padding: 20px 22px; text-align: center; }
.lp-stat + .lp-stat { border-left: 1px solid var(--line); }
.lp-stat b { display: block; font-size: clamp(24px, 3vw, 32px); letter-spacing: -0.02em; }
.lp-stat span { font-size: 13px; color: var(--dim); }
.lp-sec { padding: 84px 0; }
.lp-sec--white { background: #fff; }
.lp-sec--dark { background: radial-gradient(100% 120% at 0% 0%, #145C43, var(--deep) 50%, var(--deep2)); color: #fff; }
.lp-kicker { font-size: 12.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--acc); margin: 0 0 12px; }
.lp-sec--dark .lp-kicker { color: var(--gold); }
.lp-h2 { font-size: clamp(30px, 4.2vw, 48px); line-height: 1.08; letter-spacing: -0.03em; font-weight: 800; margin: 0 0 14px; max-width: 760px; }
.lp-h2 .hl { color: var(--acc); }
.lp-sec--dark .lp-h2 .hl { color: var(--gold); }
.lp-sub { font-size: 17px; line-height: 1.6; color: var(--dim); max-width: 640px; margin: 0 0 36px; }
.lp-sec--dark .lp-sub { color: rgba(255,255,255,.8); }
.lp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; }
.lp-card { background: #fff; border: 1px solid var(--line); border-radius: 20px; padding: 22px; position: relative; }
.lp-sec--white .lp-card { background: var(--cream); border-color: transparent; }
.lp-card h3 { margin: 14px 0 6px; font-size: 18px; letter-spacing: -0.01em; }
.lp-card p { margin: 0; color: var(--dim); font-size: 14.5px; line-height: 1.55; }
.lp-ic { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; background: var(--accl); color: var(--acc); }
.lp-tag { position: absolute; top: 16px; right: 16px; font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase;
  background: var(--gold2); color: var(--gold3); padding: 4px 8px; border-radius: 999px; }
.lp-split { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; }
.lp-calc { display: grid; grid-template-columns: 1.1fr .9fr; gap: 18px; align-items: stretch; }
.lp-inputs { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; align-content: start; }
.lp-field { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 16px; }
.lp-field label { display: block; font-size: 14px; font-weight: 700; margin-bottom: 10px; }
.lp-field small { display: block; color: var(--dim); font-size: 12.5px; margin-top: 9px; line-height: 1.45; }
.lp-stepper { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.lp-stepper button { height: 46px; border: 0; background: #F4F2EB; cursor: pointer; display: grid; place-items: center; color: var(--ink); }
.lp-stepper button:disabled { opacity: .35; cursor: default; }
.lp-stepper input { border: 0; text-align: center; font: inherit; font-size: 20px; font-weight: 800; width: 100%; height: 46px; outline: none; background: #fff; }
.lp-result { background: radial-gradient(120% 120% at 100% 0%, #16664A, var(--deep) 55%, var(--deep2)); color: #fff; border-radius: 22px; padding: 24px;
  display: flex; flex-direction: column; box-shadow: 0 24px 50px rgba(6,40,28,.25); }
.lp-result h3 { margin: 0 0 16px; font-size: 16px; font-weight: 700; color: var(--gold); letter-spacing: .01em; }
.lp-rline { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,.12); font-size: 14.5px; }
.lp-rline span:first-child { opacity: .85; }
.lp-rline small { display: block; opacity: .6; font-size: 12px; margin-top: 2px; }
.lp-rline b { white-space: nowrap; }
.lp-total { margin-top: auto; padding-top: 18px; }
.lp-total span { font-size: 14px; opacity: .85; }
.lp-total b { display: block; font-size: clamp(34px, 4vw, 46px); letter-spacing: -0.03em; color: var(--gold); line-height: 1.1; margin-top: 4px; }
.lp-badge { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; background: rgba(228,182,89,.16); color: var(--gold);
  border-radius: 999px; padding: 6px 12px; font-size: 13px; font-weight: 700; }
.lp-guarantee { display: flex; gap: 14px; align-items: flex-start; background: #FFF8E8; border: 1px solid #F1DCA7; border-radius: 18px; padding: 16px 18px; margin-top: 18px; }
.lp-guarantee b { display: block; margin-bottom: 3px; }
.lp-guarantee p { margin: 0; font-size: 14px; color: #5F4A1C; line-height: 1.5; }
.lp-vs { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.lp-vs > div { border-radius: 20px; padding: 22px; }
.lp-vs h3 { margin: 0 0 12px; font-size: 17px; display: flex; align-items: center; gap: 8px; }
.lp-vs ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 11px; font-size: 15px; }
.lp-vs li { display: flex; gap: 9px; align-items: flex-start; line-height: 1.4; }
.lp-steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; counter-reset: s; }
.lp-step { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 18px; }
.lp-step::before { counter-increment: s; content: counter(s); width: 30px; height: 30px; border-radius: 999px; background: var(--acc); color: #fff;
  display: grid; place-items: center; font-weight: 800; font-size: 14px; margin-bottom: 12px; }
.lp-step b { display: block; margin-bottom: 4px; }
.lp-step span { font-size: 14px; color: var(--dim); line-height: 1.5; }
.lp-faq { max-width: 820px; }
.lp-faq details { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 0 18px; }
.lp-faq details + details { margin-top: 10px; }
.lp-faq summary { cursor: pointer; list-style: none; padding: 18px 0; font-weight: 700; font-size: 16px; display: flex; justify-content: space-between; gap: 12px; }
.lp-faq summary::-webkit-details-marker { display: none; }
.lp-faq summary::after { content: "+"; font-size: 22px; line-height: 1; color: var(--acc); }
.lp-faq details[open] summary::after { content: "−"; }
.lp-faq p { margin: 0 0 18px; color: var(--dim); line-height: 1.6; font-size: 15px; }
.lp-final { text-align: center; }
.lp-final .lp-h2, .lp-final .lp-sub { margin-left: auto; margin-right: auto; }
.lp-footer { background: var(--deep2); color: rgba(255,255,255,.72); font-size: 14px; border-top: 1px solid rgba(255,255,255,.08); }
.lp-footer .lp-wrap { padding-top: 56px; padding-bottom: 28px; }
.lp-footer-top { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 32px; padding-bottom: 36px; border-bottom: 1px solid rgba(255,255,255,.1); }
.lp-footer .lp-brand { color: #fff; }
.lp-footer p { margin: 14px 0 0; max-width: 300px; line-height: 1.6; }
.lp-footer h4 { margin: 0 0 14px; color: #fff; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; }
.lp-footer ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.lp-footer a { text-decoration: none; }
.lp-footer a:hover { color: #fff; }
.lp-footer-bottom { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 22px; font-size: 13px; color: rgba(255,255,255,.5); }
.lp-sticky { display: none; }
.lp-video { display: inline-flex; align-items: center; gap: 10px; background: transparent; border: 0; color: inherit; font: inherit; font-weight: 600;
  cursor: pointer; padding: 6px 4px; }
.lp-video span.play { width: 42px; height: 42px; border-radius: 999px; border: 1.5px solid currentColor; display: grid; place-items: center; }
.lp-modal { position: fixed; inset: 0; background: rgba(0,0,0,.75); z-index: 100; display: grid; place-items: center; padding: 20px; }
.lp-modal > div { width: min(900px, 100%); aspect-ratio: 16/9; background: #000; border-radius: 16px; overflow: hidden; position: relative; }
.lp-modal iframe, .lp-modal video { width: 100%; height: 100%; border: 0; display: block; }
.lp-modal button { position: absolute; top: 10px; right: 10px; z-index: 2; border: 0; border-radius: 999px; width: 38px; height: 38px; background: rgba(255,255,255,.9); cursor: pointer; }
.lp-err { color: #B42318; font-size: 13px; margin-top: 8px; }
/* Screens: the real app, scaled down into small phones. The inner screen is
   laid out at a true 375px phone width, then scaled, so it reads like a screenshot. */
.lp-shots { display: grid; grid-template-columns: repeat(4, 1fr); gap: 22px; justify-items: center; }
.lp-shot { margin: 0; text-align: center; width: 100%; max-width: 250px; }
.lp-mphone { width: 250px; height: 520px; border-radius: 38px; background: #0C0F0E; padding: 8px; position: relative; margin: 0 auto;
  box-shadow: 0 26px 50px rgba(10,40,30,.22), inset 0 0 0 2px #2A2F2D; }
.lp-mphone::before { content: ""; position: absolute; top: 14px; left: 50%; transform: translateX(-50%); width: 64px; height: 17px; border-radius: 99px; background: #0C0F0E; z-index: 3; }
.lp-mscreen { width: 234px; height: 504px; border-radius: 31px; overflow: hidden; position: relative; background: #F6F7F6; color: #111827; pointer-events: none; }
.lp-mscreen-in { position: absolute; top: 0; left: 0; width: 375px; max-width: none; height: 808px; text-align: left; transform: scale(.624); transform-origin: 0 0; overflow: hidden; }
.lp-cover { overflow: hidden; background: #E5E7EB; }
.lp-cover img, .lp-cover video { width: 100%; height: 100%; object-fit: cover; display: block; }
.lp-shot figcaption { margin-top: 16px; }
.lp-shot figcaption b { display: block; font-size: 17px; letter-spacing: -0.01em; }
.lp-shot figcaption span { font-size: 14px; color: var(--dim); }
.lp-sec--dark .lp-shot figcaption span { color: rgba(255,255,255,.7); }
.lp-center { text-align: center; }
.lp-center .lp-h2, .lp-center .lp-sub { margin-left: auto; margin-right: auto; }
.lp-pricebar { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px 14px; margin-top: 18px; font-size: 14.5px; }
.lp-pricebar a { font-weight: 700; }
@media (max-width: 1100px) { .lp-shots { grid-template-columns: repeat(2, 1fr); row-gap: 40px; } }
@media (max-width: 900px) {
  .lp-links, .lp-signin { display: none; }
  .lp-nav .lp-wrap { height: 62px; gap: 12px; }
  .lp-product { display: none; }
  .lp-footer-top { grid-template-columns: 1fr 1fr; }
  .lp-footer-top > :first-child { grid-column: 1 / -1; }
  .lp-footer .lp-wrap { padding-bottom: 110px; }
  .lp-hero .lp-wrap { grid-template-columns: 1fr; padding-top: 34px; gap: 34px; }
  .lp-split, .lp-calc, .lp-vs { grid-template-columns: 1fr; }
  .lp-sec { padding: 60px 0; }
  .lp-chip { display: none; }
  .lp-chip.keep { display: flex; }
  .lp-sticky { display: flex; position: fixed; left: 12px; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom)); z-index: 60;
    padding: 10px 10px 10px 16px; border-radius: 18px; gap: 12px; align-items: center;
    background: rgba(255,255,255,.96); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    border: 1px solid var(--line); box-shadow: 0 18px 40px rgba(10,40,30,.18);
    transform: translateY(140%); opacity: 0; transition: transform .28s ease, opacity .28s ease; }
  .lp-sticky.is-on { transform: none; opacity: 1; }
  .lp-sticky-txt { flex: 1; min-width: 0; font-size: 12.5px; line-height: 1.35; color: var(--dim); }
  .lp-sticky-txt b { display: block; font-size: 14.5px; color: var(--ink); }
  .lp-sticky .lp-btn { min-height: 46px; padding: 0 18px; font-size: 15px; border-radius: 12px; box-shadow: none; }
}
@media (max-width: 520px) {
  .lp-stats { grid-template-columns: repeat(3, 1fr); }
  .lp-stat { padding: 14px 8px; }
  .lp-stat span { font-size: 11.5px; }
  .lp-phone { height: 600px; }
  .lp-shots { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 16px; margin: 0 -20px; padding: 4px 20px 16px; justify-items: initial; }
  .lp-shot { flex: none; width: 250px; scroll-snap-align: center; }
}
`;

export function LandingStyles() {
  return <style>{CSS}</style>;
}

/**
 * The one call to action on both pages: Google sign-in, which returns to this
 * same URL, where the app's gate takes over (phone number, then the app).
 */
export function SignupButton({ children = "Join free", className = "lp-btn lp-btn--gold", icon = true }) {
  const { loginWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    setBusy(true);
    setErr("");
    try { sessionStorage.setItem("mz_signup_source", window.location.pathname); } catch { /* ignore */ }
    const res = await loginWithGoogle();
    if (!res?.success) {
      setErr(res?.error || "Google sign-in failed. Please try again.");
      setBusy(false);
    }
  };
  return (
    <span style={{ display: "inline-flex", flexDirection: "column" }}>
      <button type="button" className={className} onClick={go} disabled={busy}>
        {icon && (
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden style={{ background: "#fff", borderRadius: 999, padding: 1 }}>
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
        )}
        {busy ? "Opening Google…" : children}
      </button>
      {err && <span className="lp-err" role="alert">{err}</span>}
    </span>
  );
}

export function Stepper({ label, value, onChange, min = 0, max = 99, step = 1, hint, prefix = "", format }) {
  const clamp = (v) => Math.min(max, Math.max(min, v));
  const shown = format ? format(value) : `${prefix}${value}`;
  const [draft, setDraft] = useState(null);
  return (
    <div className="lp-field">
      <label>{label}</label>
      <div className="lp-stepper">
        <button type="button" aria-label={`Less ${label}`} disabled={value <= min} onClick={() => onChange(clamp(value - step))}><Minus size={18} /></button>
        <input inputMode="numeric" aria-label={label} value={draft ?? shown}
          onFocus={() => setDraft(String(value))}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={() => { if (draft !== null && draft !== "") onChange(clamp(Number(draft))); setDraft(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
        <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(clamp(value + step))}><Plus size={18} /></button>
      </div>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function PhoneFrame({ children }) {
  return (
    <div className="lp-phone" aria-hidden>
      <div className="lp-screen"><div className="lp-screen-inner">{children}</div></div>
    </div>
  );
}

/** True once the page has scrolled past `y` pixels. */
function useScrolledPast(y) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const on = () => setPast(window.scrollY > y);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [y]);
  return past;
}

export function Brand({ product, dark }) {
  return (
    <a href="#top" className="lp-brand" aria-label={`MovEazy ${product || ""}`.trim()}>
      <img className="lp-logo-img" src={dark ? logoOnDark : logoOnLight} alt="MovEazy" width="169" height="40" draggable={false} />
      {product && <span className="lp-product">{product}</span>}
    </a>
  );
}

/** The wordmark alone, sized for an app header inside a phone mockup. */
export function AppLogo({ height = 26 }) {
  return <img src={logoOnLight} alt="MovEazy" style={{ height, width: "auto", display: "block" }} draggable={false} />;
}

/** The header: brand, section links, sign in and the one call to action. Solidifies on scroll. */
export function LandingNav({ product, links, dark, ctaClass }) {
  const scrolled = useScrolledPast(8);
  return (
    <nav className={`lp-nav${dark ? " lp-nav--dark" : ""}${scrolled ? " is-scrolled" : ""}`}>
      <div className="lp-wrap">
        <Brand product={product} dark={dark} />
        <div className="lp-links">{links.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</div>
        <span className="lp-spacer" />
        <div className="lp-navcta">
          <SignupButton className="lp-signin" icon={false}>Sign in</SignupButton>
          <SignupButton className={`${ctaClass} lp-btn--sm`} icon={false}>Join free <ArrowRight size={16} /></SignupButton>
        </div>
      </div>
    </nav>
  );
}

/** Phones only: a floating sign-up bar that appears once the hero's own button has scrolled away. */
export function StickyCta({ title, sub, ctaClass }) {
  const on = useScrolledPast(560);
  return (
    <div className={`lp-sticky${on ? " is-on" : ""}`} aria-hidden={!on}>
      <div className="lp-sticky-txt"><b>{title}</b>{sub}</div>
      <SignupButton className={ctaClass}>Join free</SignupButton>
    </div>
  );
}

export function LandingFooter({ product, blurb, links, other }) {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-footer-top">
          <div><Brand product={product} dark /><p>{blurb}</p></div>
          <div><h4>{product}</h4><ul>{links.map(([href, label]) => <li key={href}><a href={href}>{label}</a></li>)}</ul></div>
          <div><h4>MovEazy</h4><ul>
            <li><a href="https://www.moveazy.co.in/">Find a home</a></li>
            <li><a href={other[0]}>{other[1]}</a></li>
            <li><a href="https://www.moveazy.co.in/about">About us</a></li>
          </ul></div>
          <div><h4>Legal</h4><ul>
            <li><a href="https://www.moveazy.co.in/terms">Terms</a></li>
            <li><a href="https://www.moveazy.co.in/privacy">Privacy</a></li>
            <li><a href="https://www.moveazy.co.in/terms#refunds">Refunds</a></li>
          </ul></div>
        </div>
        <div className="lp-footer-bottom"><span>© {new Date().getFullYear()} MovEazy. All rights reserved.</span><span>Made in Bengaluru</span></div>
      </div>
    </footer>
  );
}

/** A small phone showing one app screen, with a two-line caption. */
export function Shot({ title, sub, children }) {
  return (
    <figure className="lp-shot">
      <div className="lp-mphone" aria-hidden>
        <div className="lp-mscreen"><div className="lp-mscreen-in">{children}</div></div>
      </div>
      <figcaption><b>{title}</b>{sub && <span>{sub}</span>}</figcaption>
    </figure>
  );
}

/** MovEazy's published inventory (public columns only). */
export function useInventory(limit = 500) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchPublishedInventory({ limit }).then((r) => { if (alive) setRows(r); }, () => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [limit]);
  return rows;
}

const photoOf = (l) => [l.cover_image_url, ...(l.images ?? [])].find((u) => u && !isVideoUrl(u));
const loads = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = src; });

/**
 * The best-presented listings whose cover photo actually loads (some stored
 * photos are gone), each narrowed to that one photo. Flats with the most
 * photos first — they tend to be the best listings.
 */
export function useListingsWithPhotos(rows, count = 1) {
  const [picks, setPicks] = useState([]);
  useEffect(() => {
    if (!rows?.length) return undefined;
    let alive = true;
    const candidates = rows.filter((l) => l.flat_type && l.rent && photoOf(l))
      .sort((x, y) => (y.images ?? []).length - (x.images ?? []).length).slice(0, count * 4);
    (async () => {
      // Check a batch at a time: fast, without downloading every candidate's photo.
      const out = [];
      for (let i = 0; i < candidates.length && out.length < count; i += count) {
        const batch = candidates.slice(i, i + count);
        const ok = await Promise.all(batch.map((l) => loads(photoOf(l))));
        if (!alive) return;
        batch.forEach((l, j) => { if (ok[j] && out.length < count) out.push({ ...l, images: [photoOf(l)], cover_image_url: photoOf(l) }); });
      }
      setPicks(out);
    })();
    return () => { alive = false; };
  }, [rows, count]);
  return picks;
}

export function Faq({ items }) {
  return (
    <div className="lp-faq">
      {items.map(([q, a]) => (
        <details key={q}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}

/** "Watch how it works" — renders nothing until a video link is set in the CRM. */
export function VideoButton({ url, label = "Watch how it works", sub = "1 min" }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  if (!url) return null;
  const yt = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/.exec(url);
  return (
    <>
      <button type="button" className="lp-video" onClick={() => setOpen(true)}>
        <span className="play"><Play size={18} /></span>
        <span style={{ textAlign: "left" }}>{label}<br /><small style={{ opacity: 0.7 }}>({sub})</small></span>
      </button>
      {open && (
        <div className="lp-modal" onClick={() => setOpen(false)} role="dialog" aria-label={label}>
          <div onClick={(e) => e.stopPropagation()}>
            <button type="button" aria-label="Close video" onClick={() => setOpen(false)}><X size={18} /></button>
            {yt
              ? <iframe src={`https://www.youtube.com/embed/${yt[1]}?autoplay=1`} title={label} allow="autoplay; encrypted-media" allowFullScreen />
              : <video src={url} controls autoPlay playsInline />}
          </div>
        </div>
      )}
    </>
  );
}
