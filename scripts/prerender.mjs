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
import { readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const out = join(root, ".prerender");

// Each page's first-screen faces (measured on a phone-sized screen): they
// load with the CSS instead of after it, so the text draws once in its own
// font. The first is the headline's — the page's largest paint.
const PAGES = [
  { page: "home", file: "home.html", host: "www.moveazy.co.in",
    fonts: ["sora-latin-800", "manrope-latin-600", "manrope-latin-700", "manrope-latin-800", "inter-latin-700"] },
  { page: "partners", file: "partners-home.html", host: "partners.moveazy.co.in",
    fonts: ["sora-latin-700", "sora-latin-800", "inter-latin-600", "inter-latin-700"] },
];

// In <head>, so it runs before the first paint: a signed-in visitor
// (Supabase keeps the session in localStorage as sb-<project>-auth-token) or
// one with a query string or a sign-in hash (deep links, Google sign-in
// returns) gets the plain page.
// Otherwise <html> gets mz-pre: the pre-built copy shows, #root renders
// hidden beneath it until the app hands over.
const HEAD = `<script>(function(){try{var q=location.search.replace(/[?&](utm_[a-z]+|fbclid|gclid)=[^&]*/g,"").replace(/^[?&]+/,"");for(var i=0;i<localStorage.length;i++){if(/^sb-.*-auth-token$/.test(localStorage.key(i)))return;}if(q||/access_token|error_description|type=recovery/.test(location.hash))return;document.documentElement.classList.add("mz-pre");setTimeout(function(){document.documentElement.classList.remove("mz-pre");var p=document.getElementById("prerender");if(p)p.remove();},15000);}catch(e){}})();</script>
<style>html:not(.mz-pre) #prerender{display:none}html.mz-pre #root{position:absolute;top:0;left:0;right:0;visibility:hidden;pointer-events:none}html.mz-pre #prerender *,html.mz-pre #root *{animation-play-state:paused!important}</style>`;

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
function fontPreloads(names) {
  return names.map((name, i) => {
    const file = assets.find((f) => f.startsWith(`${name}-normal-`) && f.endsWith(".woff2"));
    return file ? `<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/${file}"${i === 0 ? ' fetchpriority="high"' : ""}>` : "";
  }).join("");
}

// The page shows without JavaScript, so its scripts come after its fonts and
// styles: still fetched at once, at low priority.
const lowPriorityScripts = (html) => html
  .replace(/<link rel="modulepreload"/g, '<link rel="modulepreload" fetchpriority="low"')
  .replace(/<script type="module" crossorigin/g, '<script type="module" fetchpriority="low" crossorigin');

const shell = readFileSync(join(dist, "index.html"), "utf8");
let rendered = {};
try {
  execSync(`npx vite build --ssr src/entry-prerender.jsx --outDir .prerender --emptyOutDir --logLevel warn`, { cwd: root, stdio: "inherit" });
  browser(PAGES[0].host);
  const mod = await import(pathToFileURL(join(out, "entry-prerender.js")).href);
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

for (const p of PAGES) {
  const html = rendered[p.page];
  const page = html
    ? lowPriorityScripts(shell).replace("</head>", `${HEAD}${fontPreloads(p.fonts)}
</head>`).replace('<div id="root"></div>', `<div id="prerender">${html}</div><div id="root"></div>`)
    : shell;
  writeFileSync(join(dist, p.file), page);
}
renameSync(join(dist, "index.html"), join(dist, "app.html"));
rmSync(out, { recursive: true, force: true });
// Timers and listeners the app's modules set up would keep Node running.
process.exit(0);
