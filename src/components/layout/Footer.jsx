// src/components/layout/Footer.jsx
import MovEazyLogoLight from "../branding/MovEazyLogoLight";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";

const EASE = [0.22, 1, 0.36, 1];

const FOOTER_LINKS = [
  { label: "Terms of Service", route: "/terms" },
  { label: "Privacy Policy", route: "/privacy" },
  { label: "Services", route: "/services" },
  { label: "Contact & Support", route: "/contact" },
];

/**
 * @param {{ variant?: "default" | "marketing" }} props
 * marketing = compact bar (logo + copyright); default = links + logo
 */
export default function Footer({ variant = "default" }) {
  const isMarketing = variant === "marketing";
  const navigate = useNavigate();
  const { ref, inView } = useInView({ threshold: 0.3, triggerOnce: true });

  if (isMarketing) {
    return (
      <footer className="relative border-t border-stone-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col items-start justify-between gap-3 px-6 py-8 sm:flex-row sm:items-center sm:px-10">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex shrink-0 items-center"
            aria-label="MovEazy home"
          >
            <MovEazyLogoLight size="footer" />
          </button>
          <p className="text-[13px] leading-snug text-stone-500 sm:text-right">
            © 2026 MovEazy · Bengaluru, India · moveazy.co.in
          </p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="relative overflow-hidden bg-[#fffaf8]">
      <div className="absolute top-0 left-0 right-0 h-px bg-stone-200" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE }}
          className="flex flex-col gap-8 py-10 sm:py-11"
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="inline-flex w-fit items-center"
                aria-label="MovEazy home"
              >
                <MovEazyLogoLight size="footer" />
              </button>
              <p className="max-w-sm text-[13px] leading-snug text-stone-500">
                © 2026 MovEazy · Bengaluru, India · moveazy.co.in
              </p>
            </div>

            <nav
              aria-label="Footer navigation"
              className="flex flex-wrap gap-x-8 gap-y-3"
            >
              {FOOTER_LINKS.map(({ label, route }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => navigate(route)}
                  className="text-left text-[12px] font-semibold uppercase tracking-wide text-stone-500 transition-colors hover:text-[#ff3131]"
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
