/**
 * What a page's first read would return, already inside the page.
 *
 * Opened from a link (an ad, a building's QR), the page's HTML comes from the
 * edge (api/share.js), which makes the same database read the page is about to
 * make and puts the answer in window.__MZ_PAGE__ = { key, data }. The page
 * takes it instead of asking again — once, and only for the read it names.
 */
export function takePageData(key) {
  if (typeof window === "undefined") return undefined;
  const p = window.__MZ_PAGE__;
  if (!p || String(p.key).toLowerCase() !== String(key).toLowerCase() || p.data == null) return undefined;
  window.__MZ_PAGE__ = null;
  return p.data;
}
