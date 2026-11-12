/**
 * After `vite build`: the landing pages a first-time visitor opens, as HTML
 * the browser can paint before any JavaScript arrives (src/entry-prerender.jsx).
 *
 *   dist/home.html            www.moveazy.co.in/       (vercel.json rewrite)
 *   dist/partners-home.html   partners.moveazy.co.in/  (vercel.json rewrite)
 *   dist/app.html             every other page and host: the app's shell,
 *                             renamed from index.html so that "/" isn't a
 *                             file and Vercel's host rules decide it.
 *
 * Each is dist/index.html with the page in #prerender, beside the app's empty
 * #root. A script in <head> decides before anything paints: a visitor who is
 * signed in, or arrived with a query, never sees it (the page is as before);
 * anyone else sees it at once, while the app renders invisibly underneath and
 * swaps itself in when drawn (src/lib/prerender.js).
 *
 * Rendered in a simulated browser (jsdom), because some of the app's code
 * reads `window` as it loads. If rendering fails, the build still succeeds:
 * the two files are simply copies of index.html, which works as before.
 */
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Beasties from "beasties";
import { JSDOM } from "jsdom";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const out = join(root, ".prerender");

// Each page's first-screen faces (measured on a phone-sized screen): they
// load with the CSS instead of after it, so the text draws once in its own
// font. The first is the headline's — the page's largest paint — and loads
// first. (Embedding it in the page was measured: the bigger page cost more
// than the request it saved.)
const PAGES = [
  { page: "home", file: "home.html", host: "www.moveazy.co.in",
    fonts: ["sora-latin-800", "manrope-latin-600", "manrope-latin-700", "manrope-latin-800", "inter-latin-700"] },
  { page: "partners", file: "partners-home.html", host: "partners.moveazy.co.in",
    fonts: ["sora-latin-700", "sora-latin-800", "inter-latin-600", "inter-latin-700"] },
  // Signed-out landings of the owner and society apps, at every path of their hosts (vercel.json);
  // each page hands over itself (usePrerenderHandoff). A returning society visitor skips the splash,
  // so isn't shown it (SKIP: a localStorage key that means the page opens elsewhere).
  { page: "owners", file: "owners-home.html", host: "owners.moveazy.co.in", fonts: [], handoff: "page" },
  { page: "society", file: "society-home.html", host: "society.moveazy.co.in", fonts: [], handoff: "page", skip: "mz_society_splash" },
];

// In <head>, so it runs before the first paint: a signed-in visitor
// (Supabase keeps the session in localStorage as sb-<project>-auth-token) or
// one with a query string or a sign-in hash (deep links, Google sign-in
// returns) gets the plain page.
// Otherwise <html> gets mz-pre: the pre-built copy shows, #root renders
// hidden beneath it until the app hands over. The copy shows its animations
// on their last frame, still (an entrance held on its first frame — opacity
// 0 — is invisible); the app's wait to play until it is shown.
const HEAD = `<script>(function(){try{var q=location.search.replace(/[?&](utm_[a-z]+|fbclid|gclid)=[^&]*/g,"").replace(/^[?&]+/,"");for(var i=0;i<localStorage.length;i++){if(/^sb-.*-auth-token$/.test(localStorage.key(i)))return;}if(q||/access_token|error_description|type=recovery/.test(location.hash))return;document.documentElement.classList.add("mz-pre");setTimeout(function(){document.documentElement.classList.remove("mz-pre");var p=document.getElementById("prerender");if(p)p.remove();},15000);}catch(e){}})();</script>
<style>html:not(.mz-pre) #prerender{display:none}html.mz-pre #root{position:absolute;top:0;left:0;right:0;visibility:hidden;pointer-events:none}html.mz-pre #prerender *,html.mz-pre #prerender *::before,html.mz-pre #prerender *::after{animation-delay:-60s!important;animation-play-state:paused!important}html.mz-pre #root *{animation-play-state:paused!important}</style>`;

/**
 * The copy is on screen for a moment, until the app has drawn: below the first
 * screen it costs layout and downloads nobody sees. It keeps only its first
 * screen, and its images after the first two load only when near the screen.
 * (Skipping layout with content-visibility instead stopped margins collapsing:
 * the policies' sections sat 24 px lower than the app draws them.)
 */
function lighter(html) {
  let n = 0;
  const lazy = html.replace(/<img (?![^>]*loading=)/g, (m) => (++n > 2 ? '<img loading="lazy" ' : m));
  // Only the first screen at all: a slow phone still styles a skipped section
  // (measured: home's first layout 328 ms at 4x CPU with ~1,000 nodes; the
  // partners landing's first paint 0.93–1.8 s with its sections, 0.5 s with
  // its hero alone). A page that opens on a hero (<header class="…hero…">)
  // keeps just that; others their first two sections. The app, a moment
  // later, draws the rest.
  try {
    const frag = JSDOM.fragment(lazy);
    const sections = [...frag.querySelectorAll("section")].filter((s) => !s.parentElement?.closest("section"));
    // An entrance rendered at its start (framer-motion's initial: opacity 0,
    // shifted) shows where it ends: the copy never plays it.
    for (const el of frag.querySelectorAll('[style*="opacity:0"]')) {
      if (el.style.opacity !== "0") continue;
      el.style.opacity = "";
      el.style.transform = "";
    }
    const keep = frag.querySelector('header[class*="hero"]') ? 0 : 2;
    if (sections.length > keep) {
      for (const s of sections.slice(keep)) s.remove();
      for (const f of frag.querySelectorAll("footer")) f.remove();
    }
    const box = new JSDOM("").window.document.createElement("div");
    box.append(frag);
    return box.innerHTML;
  } catch {
    return lazy;
  }
}

function browser(host) {
  const dom = new JSDOM("<!doctype html><html><head></head><body><div id=\"root\"></div></body></html>", {
    url: `https://${host}/`,
    pretendToBeVisual: true,
  });
  const w = dom.window;
  for (const key of ["window", "document", "navigator", "location", "localStorage", "sessionStorage", "history",
    "HTMLElement", "Element", "Node", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame",
    "CustomEvent", "Event", "MutationObserver", "IntersectionObserver", "ResizeObserver", "screen", "innerWidth", "innerHeight"]) {
    if (w[key] === undefined) continue;
    Object.defineProperty(globalThis, key, { value: w[key], configurable: true, writable: true });
  }
  if (!w.matchMedia) {
    globalThis.matchMedia = w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  }
  for (const name of ["IntersectionObserver", "ResizeObserver"]) {
    if (!globalThis[name]) globalThis[name] = w[name] = class { observe() {} unobserve() {} disconnect() {} };
  }
  return dom;
}

const assets = readdirSync(join(dist, "assets"));
const fontFile = (name) => assets.find((f) => f.startsWith(`${name}-normal-`) && f.endsWith(".woff2"));
function fontPreloads(names) {
  return names.map((name, i) => {
    const file = fontFile(name);
    return file ? `<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/${file}"${i === 0 ? ' fetchpriority="high"' : ""}>` : "";
  }).join("");
}

// The page shows without JavaScript, so its scripts come after its fonts and
// styles: still fetched at once, at low priority.
const lowPriorityScripts = (html) => html
  .replace(/<link rel="modulepreload"/g, '<link rel="modulepreload" fetchpriority="low"')
  .replace(/<script type="module" crossorigin/g, '<script type="module" fetchpriority="low" crossorigin');

/**
 * The app's code is fetched at once (a modulepreload) but run only after the
 * page's first frame has painted. On a phone's CPU, running ~800 KB of code
 * the moment it lands held up the first paint of a page that was already
 * there in the HTML by over a second (measured: home's first paint 1.9 s with
 * every file in by 0.8 s). A tab opened in the background never paints, so it
 * starts after 300 ms anyway.
 */
function paintFirst(html) {
  return html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/, (_, src) =>
    `<link rel="modulepreload" crossorigin href="${src}">`
    + `<script>(function(){var d=0;function go(){if(d)return;d=1;var s=document.createElement("script");s.type="module";s.crossOrigin="";s.src=${JSON.stringify(src)};document.head.appendChild(s);}`
    + `requestAnimationFrame(function(){setTimeout(go,0)});setTimeout(go,300);})();</script>`);
}

const shell = paintFirst(readFileSync(join(dist, "index.html"), "utf8"));
let rendered = {};
try {
  execSync(`npx vite build --ssr src/entry-prerender.jsx --outDir .prerender --emptyOutDir --logLevel warn`, { cwd: root, stdio: "inherit" });
  browser(PAGES[0].host);
  const mod = await import(pathToFileURL(join(out, "entry-prerender.js")).href);
  // The info pages and sign-in (src/entry-prerender.jsx ROUTES), at
  // www.moveazy.co.in/<path> (vercel.json rewrites each to <path>.html).
  for (const path of Object.keys(mod.ROUTES ?? {})) {
    PAGES.push({ page: path, file: `${path.slice(1)}.html`, host: "www.moveazy.co.in", fonts: [], handoff: mod.SELF_HANDOFF?.has(path) ? "page" : "route" });
  }
  for (const p of PAGES) {
    try {
      rendered[p.page] = await mod.render(p.page);
      console.log(`prerender: ${p.file} ${Math.round(rendered[p.page].length / 1024)} KB`);
    } catch (e) {
      console.warn(`prerender: ${p.page} failed, served as the plain page —`, e?.message || e);
    }
  }
} catch (e) {
  console.warn("prerender: skipped —", e?.message || e);
}

// The CSS the pre-built page uses goes inline; the full stylesheet still
// loads, without holding up the first paint (it is all there before the app
// draws). So are the @font-face rules of the fonts it uses — the preloaded
// files are usable at once. Font preloads stay ours (PAGES above).
const beasties = new Beasties({
  path: dist, publicPath: "/", preload: "swap-high", pruneSource: false, mergeStylesheets: true,
  // The page's own <style>s (its components' CSS) cut to the rules it uses too.
  inlineFonts: true, preloadFonts: false, reduceInlineStyles: true, logLevel: "warn",
});

for (const p of PAGES) {
  const html = rendered[p.page];
  const skip = p.skip
    ? `<script>try{if(localStorage.getItem(${JSON.stringify(p.skip)}))document.documentElement.classList.remove("mz-pre")}catch(e){}</script>`
    : "";
  let page = html
    ? lowPriorityScripts(shell).replace('<div id="root"></div>', `${skip}<div id="prerender"${p.handoff ? ` data-handoff="${p.handoff}"` : ""}>${lighter(html)}</div><div id="root"></div>`)
    : shell;
  if (html) {
    try {
      page = await beasties.process(page);
    } catch (e) {
      console.warn(`prerender: ${p.file} keeps its blocking stylesheet —`, e?.message || e);
    }
    // After Beasties: its rules for html.mz-pre must stay though nothing in the file has the class yet.
    page = page.replace("</head>", `${HEAD}${fontPreloads(p.fonts)}
</head>`);
  }
  writeFileSync(join(dist, p.file), page);
}
// Every other page and host: the shell, its code started after the first paint too.
writeFileSync(join(dist, "app.html"), shell);
rmSync(join(dist, "index.html"));
rmSync(out, { recursive: true, force: true });
// Timers and listeners the app's modules set up would keep Node running.
process.exit(0);
