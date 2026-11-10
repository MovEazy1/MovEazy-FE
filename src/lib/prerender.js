/**
 * The handoff from a pre-built landing page (scripts/prerender.mjs) to the
 * app. While <html> has the class mz-pre, the pre-built copy (#prerender) is
 * what shows and the app renders invisibly in #root underneath it; the page
 * calls usePrerenderHandoff() once it has drawn, and the two swap in the same
 * frame. Pages that weren't pre-built never have the class, and this is a
 * no-op.
 */
import { useLayoutEffect } from "react";

export function dropPrerender() {
  if (typeof document === "undefined") return;
  // A stylesheet that didn't hold up the first paint (api/property-page.js)
  // may still be on its way: swap once it has landed, never to an unstyled app.
  const pending = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) => !l.sheet);
  if (pending && document.documentElement.classList.contains("mz-pre")) {
    const go = () => dropPrerender();
    pending.addEventListener("load", go, { once: true });
    pending.addEventListener("error", go, { once: true });
    return;
  }
  document.documentElement.classList.remove("mz-pre");
  document.getElementById("prerender")?.remove();
}

/** Call at the top of a pre-built page: once it has drawn, its pre-built copy goes. */
export function usePrerenderHandoff() {
  useLayoutEffect(() => { dropPrerender(); }, []);
}
