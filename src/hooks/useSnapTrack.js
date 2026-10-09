/**
 * A row of full-width slides that swipe like an Instagram post: CSS scroll
 * snapping does the finger and the trackpad (the photo follows, the next one
 * peeks in, it settles on a whole slide), and this adds the rest —
 *
 *   - which slide is showing (`index`), from the scroll position;
 *   - `goTo(i)` for arrows, thumbnails and keys;
 *   - dragging with a mouse, which scroll snapping ignores. Snapping is lifted
 *     for the drag, then the track glides to the photo it was dragged to;
 *   - no click at the end of a mouse drag, so a drag never opens a photo.
 *
 * Spread `trackProps` on the scrolling element (class "mz-snap", index.css).
 * `disabled` (a zoomed photo in the viewer) leaves mouse drags to the slide.
 */
import { useCallback, useRef, useState } from "react";
import { dragTarget, slideIndex } from "../lib/photoGestures";

export function useSnapTrack({ disabled = false } = {}) {
  const ref = useRef(null);
  const [index, setIndex] = useState(0);
  const drag = useRef(null);
  const dragged = useRef(false);

  const count = () => ref.current?.children.length ?? 0;

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el || drag.current) return;
    setIndex(slideIndex(el.scrollLeft, el.clientWidth, el.children.length));
  }, []);

  const goTo = useCallback((i, smooth = true) => {
    const el = ref.current;
    if (!el) return;
    const n = el.children.length;
    const to = Math.min(Math.max(0, i), Math.max(0, n - 1));
    // Glide to a neighbour; jump straight to anything further (a thumbnail),
    // rather than slide past — and load — every photo in between.
    const near = Math.abs(to - slideIndex(el.scrollLeft, el.clientWidth, n)) <= 1;
    el.scrollTo({ left: to * el.clientWidth, behavior: smooth && near ? "smooth" : "auto" });
    setIndex(to);
  }, []);

  const onPointerDown = (e) => {
    if (disabled || e.pointerType !== "mouse" || e.button !== 0 || !ref.current) return;
    dragged.current = false;
    drag.current = { x: e.clientX, left: ref.current.scrollLeft, id: e.pointerId, from: index };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    if (!dragged.current) {
      if (Math.abs(dx) < 5) return;
      dragged.current = true;
      el.style.scrollSnapType = "none";
      el.style.cursor = "grabbing";
      try { el.setPointerCapture(d.id); } catch { /* the pointer already left */ }
    }
    el.scrollLeft = d.left - dx;
  };
  const endDrag = (e) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el || e.pointerId !== d.id) return;
    drag.current = null;
    if (!dragged.current) return;
    el.style.scrollSnapType = "";
    el.style.cursor = "";
    goTo(dragTarget(d.from, e.clientX - d.x, el.clientWidth, count()));
  };
  const onClickCapture = (e) => {
    if (!dragged.current) return;
    dragged.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return {
    ref,
    index,
    goTo,
    trackProps: {
      ref, onScroll, onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onClickCapture,
    },
  };
}

export default useSnapTrack;
