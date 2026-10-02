import { useId, useRef, useState } from "react";

/**
 * Drag to reorder a grid of photos — with a finger or a mouse.
 *
 *   const sort = useDragReorder((from, to) => setList((cur) => moveByKey(cur, from, to)));
 *   <div {...sort.bind(key)} style={{ ...tileStyle, ...sort.dragStyle(key) }}>
 *
 * A few pixels of movement start the drag, so the buttons on a tile (×, make
 * cover) stay plain taps. While a tile is dragged over another, `onMove(fromKey,
 * toKey)` moves it there, so the grid shows the new order as you go.
 */
export function useDragReorder(onMove) {
  const group = useId();
  const [dragKey, setDragKey] = useState(null);
  const drag = useRef(null);
  const moveRef = useRef(onMove);
  moveRef.current = onMove;

  const end = () => {
    drag.current = null;
    setDragKey(null);
  };

  const bind = (key) => ({
    "data-sort-group": group,
    "data-sort-key": key,
    onPointerDown: (e) => {
      if (e.button > 0 || e.target.closest("button, a, input, label")) return;
      drag.current = { key, x: e.clientX, y: e.clientY, id: e.pointerId, el: e.currentTarget, on: false };
    },
    onPointerMove: (e) => {
      const d = drag.current;
      if (!d) return;
      if (!d.on) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
        d.on = true;
        setDragKey(d.key);
        try { d.el.setPointerCapture(d.id); } catch { /* fine without it */ }
        navigator.vibrate?.(10);
      }
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-sort-key]");
      const to = over?.getAttribute("data-sort-group") === group ? over.getAttribute("data-sort-key") : null;
      if (to && to !== d.key) moveRef.current(d.key, to);
    },
    onPointerUp: end,
    onPointerCancel: end,
    // The browser's own image drag would steal the gesture.
    onDragStart: (e) => e.preventDefault(),
  });

  const dragStyle = (key) => ({
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
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
