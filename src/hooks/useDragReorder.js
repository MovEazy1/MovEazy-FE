import { useId, useRef, useState } from "react";

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

export function useDragReorder(onMove) {
  const group = useId();
  const [dragKey, setDragKey] = useState(null);
  const drag = useRef(null);
  const moveRef = useRef(onMove);
  moveRef.current = onMove;

  // Once a finger has picked a photo up, the page must not scroll under it.
  const stopScroll = (e) => { if (e.cancelable) e.preventDefault(); };

  const begin = (d) => {
    d.on = true;
    setDragKey(d.key);
    try { d.el.setPointerCapture(d.id); } catch { /* fine without it */ }
    if (d.touch) document.addEventListener("touchmove", stopScroll, { passive: false });
    navigator.vibrate?.(10);
  };

  const end = () => {
    const d = drag.current;
    if (d?.timer) clearTimeout(d.timer);
    if (d?.touch) document.removeEventListener("touchmove", stopScroll);
    drag.current = null;
    setDragKey(null);
  };

  const bind = (key) => ({
    "data-sort-group": group,
    "data-sort-key": key,
    onPointerDown: (e) => {
      if (e.button > 0 || e.target.closest("button, a, input, label")) return;
      const d = { key, x: e.clientX, y: e.clientY, id: e.pointerId, el: e.currentTarget, on: false, touch: e.pointerType === "touch" };
      if (d.touch) d.timer = setTimeout(() => { if (drag.current === d) begin(d); }, HOLD_MS);
      drag.current = d;
    },
    onPointerMove: (e) => {
      const d = drag.current;
      if (!d) return;
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
