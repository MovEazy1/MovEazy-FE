import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function useGsapStaggerReveal({
  selector = "[data-gsap-reveal]",
  y = 24,
  duration = 0.7,
  stagger = 0.12,
  ease = "power3.out",
  start = "top 82%",
} = {}) {
  const rootRef = useRef(null);

  useGSAP(
    () => {
      const elements = gsap.utils.toArray(selector);
      if (!elements.length) return;

      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(elements, { opacity: 1, y: 0 });
      });

      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          elements,
          { opacity: 0, y },
          {
            opacity: 1,
            y: 0,
            duration,
            stagger,
            ease,
            scrollTrigger: {
              trigger: rootRef.current,
              start,
              once: true,
            },
          }
        );
      });

      return () => media.revert();
    },
    { scope: rootRef }
  );

  return rootRef;
}

export default useGsapStaggerReveal;
