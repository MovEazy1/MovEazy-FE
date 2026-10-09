/**
 * The arithmetic behind swiping through a flat's photos and zooming into one
 * (hooks/useSnapTrack.js, components/PhotoViewer.jsx). Pure, so it's tested
 * without a browser.
 *
 * Zoom state is { s, x, y }: the picture scaled by `s` about the centre of its
 * box, then moved by (x, y) px. A point `c` of the picture (from its centre,
 * unscaled) shows at x + s·c.
 */

export const MAX_ZOOM = 4;
export const DOUBLE_TAP_ZOOM = 2.5;
export const NO_ZOOM = Object.freeze({ s: 1, x: 0, y: 0 });

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Which slide a snap track shows at this scroll position. */
export function slideIndex(scrollLeft, width, count) {
  if (!count || !width) return 0;
  return clamp(Math.round(scrollLeft / width), 0, count - 1);
}

/**
 * Where a mouse drag across the track lands: a fifth of a slide either way
 * moves one photo, less springs back.
 */
export function dragTarget(index, dx, width, count) {
  const step = Math.abs(dx) > width * 0.2 ? (dx < 0 ? 1 : -1) : 0;
  return clamp(index + step, 0, Math.max(0, count - 1));
}

/** The size a nw×nh picture is drawn at, fitted whole inside a W×H box. */
export function containSize(nw, nh, W, H) {
  if (!nw || !nh || !W || !H) return { w: W || 0, h: H || 0 };
  const r = Math.min(W / nw, H / nh);
  return { w: nw * r, h: nh * r };
}

/** Keep a zoomed picture over its box: never drag an empty edge into view. */
export function clampPan({ s, x, y }, pic, box) {
  const mx = Math.max(0, (pic.w * s - box.w) / 2);
  const my = Math.max(0, (pic.h * s - box.h) / 2);
  return { s, x: clamp(x, -mx, mx) || 0, y: clamp(y, -my, my) || 0 }; // never -0
}

/** Zoom to `s1`, keeping whatever is under `p` (from the box centre) under it. */
export function zoomAround(z, p, s1) {
  const s = clamp(s1, 1, MAX_ZOOM);
  const k = s / z.s;
  return { s, x: p.x - (p.x - z.x) * k, y: p.y - (p.y - z.y) * k };
}

/**
 * Two fingers: the point that was under their midpoint `m0` when they came
 * down stays under the midpoint `m1` now, at `ratio` times the starting zoom.
 */
export function pinchTo(start, m0, m1, ratio) {
  const s = clamp(start.s * ratio, 1, MAX_ZOOM);
  const k = s / start.s;
  return { s, x: m1.x - (m0.x - start.x) * k, y: m1.y - (m0.y - start.y) * k };
}

/** Double tap: in on the spot tapped, or back out if already zoomed. */
export function doubleTapZoom(z, p) {
  return z.s > 1.01 ? NO_ZOOM : zoomAround(z, p, DOUBLE_TAP_ZOOM);
}

/** A downward drag that closes the viewer: far enough, or a quick flick. */
export function swipeDownCloses(dy, ms) {
  return dy > 120 || (dy > 50 && dy / Math.max(1, ms) > 0.5);
}
