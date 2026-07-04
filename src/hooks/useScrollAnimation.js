// ─────────────────────────────────────────────────────────────────────────────
// src/hooks/useScrollAnimation.js
//
// Lightweight hook to trigger fade-up animations as sections scroll into view.
// Uses the IntersectionObserver API (via react-intersection-observer package).
//
// Usage:
//   const { ref, inView } = useScrollAnimation();
//   <div ref={ref} className={inView ? "scroll-visible" : "scroll-hidden"}>
//
// Or with Framer Motion variants:
//   <motion.div ref={ref} variants={myVariants} animate={inView ? "visible" : "hidden"}>
// ─────────────────────────────────────────────────────────────────────────────

import { useInView } from "react-intersection-observer";

/**
 * @param {object}  options
 * @param {number}  options.threshold  – 0–1, how much of element must be visible. Default: 0.15
 * @param {boolean} options.triggerOnce – animate once, don't reverse on scroll-out. Default: true
 */
export function useScrollAnimation({ threshold = 0.15, triggerOnce = true } = {}) {
  const { ref, inView } = useInView({ threshold, triggerOnce });
  return { ref, inView };
}

export default useScrollAnimation;
