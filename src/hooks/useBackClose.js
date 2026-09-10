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
    // `key` is deliberately NOT a dependency. It is a label, and re-running on
    // a change to it tears the entry down and rebuilds it — the teardown's
    // history.back() then lands, asynchronously, on the listener the rebuild
    // just registered, which closes the thing that was only meant to move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/**
 * The same idea for a multi-step flow, where "how deep am I" replaces "is it
 * open". Used by both posting flows.
 *
 * Exactly one marker entry is kept, no matter how deep the flow goes: back
 * pops it, the step drops by one, and a fresh marker is pushed if there are
 * still steps to unwind. One entry per step would strand someone behind a pile
 * of same-URL entries they'd have to press back through to leave the page.
 *
 * The flow's own Back button needs no special handling — dropping a step
 * changes `depth`, and the marker is maintained from that.
 *
 * @param {number} depth      Steps deep, 0 meaning "the first step".
 * @param {() => void} onBack Move back one step.
 */
/**
 * What the history stack needs doing, given how deep the flow is and whether a
 * marker is already down. Pure, so the invariant that matters — *one* marker,
 * ever, however deep the flow goes — is testable without a browser.
 *
 * @returns {"push" | "pop" | "none"}
 */
export function markerPlan(depth, marked) {
  if (depth > 0 && !marked) return "push";
  if (depth <= 0 && marked) return "pop";
  return "none";
}

export function useHistorySteps(depth, onBack) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const marked = useRef(false);

  // Registered once. Re-registering per step is precisely the bug above.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onPop = () => {
      if (!marked.current) return;
      marked.current = false;
      onBackRef.current?.();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const plan = markerPlan(depth, marked.current);
    if (plan === "push") {
      marked.current = true;
      window.history.pushState({ mzStep: depth }, "", window.location.href);
    } else if (plan === "pop") {
      // Back at the start: drop the marker so leaving takes one press. The
      // popstate this fires is ignored — marked is already false.
      marked.current = false;
      window.history.back();
    }
  }, [depth]);
}

export default useBackClose;
