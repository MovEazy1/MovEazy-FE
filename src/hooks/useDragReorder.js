import { useEffect, useId, useRef, useState } from "react";

/**
 * Drag to reorder a grid or strip of photos — with a finger or a mouse.
 *
 *   const sort = useDragReorder((from, to) => setList((cur) => moveByKey(cur, from, to)));
 *   <div {...sort.bind(key)} style={{ ...tileStyle, ...sort.dragStyle(key) }}>
 *
 * Mouse: a few pixels of movement start the drag, so the buttons on a tile
 * (×, make cover) stay plain clicks.
 * Finger: a swipe scrolls — the strip under "Arrange photos", the page past a
 * grid — and a press held for a moment (HOLD_MS) picks the photo up to move.
 * (Dragging on the first touch made every swipe over the photos a reorder, so
 * a strip of photos could not be scrolled with a finger at all.)
 * While a tile is dragged over another, `onMove(fromKey, toKey)` moves it
 * there, so the grid shows the new order as you go.
 */
export const HOLD_MS = 300;
const SLOP = 8;

// Once a finger has picked a photo up, the page must not scroll under it.
// One shared function, so the remove in end() always matches the add in begin().
// (It used to be made fresh on every render: begin() ran from the render that
// started the hold and end() from a later one, so removeEventListener was handed
// a different function and the block stayed on the page for good. Every swipe
// was then cancelled and nothing scrolled, on that page or any page opened
// after it, until a full reload.)
function stopScroll(e) { if (e.cancelable) e.preventDefault(); }

export function useDragReorder(onMove) {
  const group = useId();
  const [dragKey, setDragKey] = useState(null);
  const drag = useRef(null);
  const moveRef = useRef(onMove);
  moveRef.current = onMove;

  // begin/end live for the whole life of the component (not per render), for
  // the same reason as stopScroll: what one adds, the other must remove.
  const api = useRef(null);
  if (!api.current) {
    const end = () => {
      const d = drag.current;
      if (d?.timer) clearTimeout(d.timer);
      document.removeEventListener("touchmove", stopScroll);
      // A finger or button let go anywhere ends the drag, even off the photos:
      // moving a tile in the grid can drop its pointer capture, and then the
      // tile itself never hears the "up".
      document.removeEventListener("pointerup", end, true);
      document.removeEventListener("pointercancel", end, true);
      document.removeEventListener("touchend", end, true);
      document.removeEventListener("touchcancel", end, true);
      drag.current = null;
      setDragKey(null);
    };
    const arm = (d) => {
      drag.current = d;
      document.addEventListener("pointerup", end, true);
      document.addEventListener("pointercancel", end, true);
      if (d.touch) {
        document.addEventListener("touchend", end, true);
        document.addEventListener("touchcancel", end, true);
      }
    };
    const begin = (d) => {
      d.on = true;
      setDragKey(d.key);
      try { d.el.setPointerCapture(d.id); } catch { /* fine without it */ }
      if (d.touch) document.addEventListener("touchmove", stopScroll, { passive: false });
      navigator.vibrate?.(10);
    };
    api.current = { arm, begin, end };
  }
  const { arm, begin, end } = api.current;

  // Leaving the page mid-drag (Back, a save that navigates) must not leave the
  // scroll block behind.
  useEffect(() => () => { if (drag.current) end(); }, [end]);

  const bind = (key) => ({
    "data-sort-group": group,
    "data-sort-key": key,
    onPointerDown: (e) => {
      if (e.button > 0 || e.target.closest("button, a, input, label")) return;
      if (drag.current) end();
      const d = { key, x: e.clientX, y: e.clientY, id: e.pointerId, el: e.currentTarget, on: false, touch: e.pointerType === "touch" };
      if (d.touch) d.timer = setTimeout(() => { if (drag.current === d) begin(d); }, HOLD_MS);
      arm(d);
    },
    onPointerMove: (e) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.id) return;
      if (!d.on) {
        const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
        // A finger that moves before the hold is up is scrolling: let it.
        if (d.touch) { if (moved > SLOP) end(); return; }
        if (moved < 6) return;
        begin(d);
      }
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-sort-key]");
      const to = over?.getAttribute("data-sort-group") === group ? over.getAttribute("data-sort-key") : null;
      if (to && to !== d.key) moveRef.current(d.key, to);
    },
    onPointerUp: end,
    onPointerCancel: end,
    // The browser's own image drag, and a long-press "save image" menu, would steal the gesture.
    onDragStart: (e) => e.preventDefault(),
    onContextMenu: (e) => e.preventDefault(),
  });

  const dragStyle = (key) => ({
    // Swipes scroll (the strip sideways, the page up and down); a held press reorders.
    touchAction: dragKey === key ? "none" : "pan-x pan-y",
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTouchCallout: "none",
    cursor: dragKey === key ? "grabbing" : "grab",
    transition: "transform .15s ease, box-shadow .15s ease",
    ...(dragKey === key ? { transform: "scale(1.07)", boxShadow: "0 10px 24px rgba(0,0,0,.28)", zIndex: 3 } : {}),
  });

  return { dragKey, bind, dragStyle };
}

/** `list` with the item keyed `fromKey` moved to where `toKey` is. */
export function moveByKey(list, fromKey, toKey, keyOf = (x) => x) {
  const from = list.findIndex((x) => keyOf(x) === fromKey);
  const to = list.findIndex((x) => keyOf(x) === toKey);
  if (from < 0 || to < 0 || from === to) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
