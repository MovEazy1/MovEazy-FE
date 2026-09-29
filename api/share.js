/**
 * Link previews for a broker's pages: /b/<code> (their QR storefront) and
 * /c/<token> (a curated list). Facebook groups and WhatsApp read the page's
 * tags without running JavaScript, and the SPA's index.html has one set of
 * tags for every route — so this serves that same index.html with the tags
 * for this page. People get the app exactly as before; nothing redirects.
 *
 * Reads only side-effect-free functions (a preview must not count as an
 * open). Any failure serves the page untouched.
 */
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

export default async function handler(req) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") || "";
  const id = url.searchParams.get("id") || "";
  const page = await fetch(`${url.origin}/index.html`);
  let html = await page.text();
  try {
    const t = await tagsFor(kind, id);
    if (t) html = inject(html, t, `https://www.moveazy.co.in/${kind}/${id}`);
  } catch { /* the page, untouched */ }
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=300" },
  });
}
