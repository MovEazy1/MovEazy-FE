import { useNavigate } from "react-router-dom";
import MovEazyLogoLight from "../branding/MovEazyLogoLight";

/** Minimal footer for /plan — matches moveazy-plan-page.html finale + footer design */
export default function PlanPageSiteFooter() {
  const navigate = useNavigate();

  return (
    <footer className="relative z-20 border-t border-stone-200 bg-white">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col items-start justify-between gap-3 px-6 py-8 sm:flex-row sm:items-center sm:gap-4 sm:px-10 lg:px-10">
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
