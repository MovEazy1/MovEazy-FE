/**
 * Make an overlay a real step in browser history.
 *
 * A modal, sheet, filter panel or wizard step is a place the user went, but
 * none of them are routes, so the browser knew nothing about them. Pressing
 * back — or swiping right on a phone, which is the same thing — skipped every
 * one of them and popped the whole page. Someone reading a flat sent over
 * WhatsApp landed back in WhatsApp; someone who opened a flat from the map
 * landed on the homepage. Both are the same missing history entry.
 *
 * Opening an overlay pushes a marker entry. Back pops it and closes the
 * overlay instead of leaving the page. Closing by tapping the X removes the
 * marker again, so back doesn't then need pressing twice to get anywhere.
 *
 * The URL is deliberately untouched: the marker carries only state, so React
 * Router stays on the same route and nothing re-renders underneath. Where an
 * overlay *should* be linkable — the property view — drive it from a query
 * parameter instead and let routing do this job.
 *
 * @param {boolean} open      Whether the overlay is showing.
 * @param {() => void} onClose Called when back is pressed while it is.
 * @param {string} key        A name for the entry, for debugging in devtools.
 */
import { useEffect, useRef } from "react";

export function useBackClose(open, onClose, key = "overlay") {
  // Kept in a ref so a caller passing an inline arrow doesn't tear the entry
  // down and rebuild it on every render — that would spam history.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open || typeof window === "undefined") return undefined;

    // Same URL, extra entry: back has somewhere to land that isn't the page
    // the user is reading.
    let ours = true;
    window.history.pushState({ mzOverlay: key }, "", window.location.href);

    const onPop = () => {
      // Our entry is already gone by the time this fires — don't try to
      // remove it again in the cleanup below.
      ours = false;
      closeRef.current?.();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed from the UI rather than by going back. The marker is still on
      // the stack, and leaving it there costs the user a wasted back press.
      if (ours) window.history.back();
    };
  }, [open, key]);
}

export default useBackClose;
