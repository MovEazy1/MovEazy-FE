import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import MovEazyLogo from "../branding/MovEazyLogo";
import { HEADER_CTA, HEADER_SECONDARY_CTA, MARKETING_NAV_LINKS, isNavLinkActive } from "../../config/navLinks";

/** Lightweight homepage nav — no framer-motion or auth (keeps first paint small). */
export default function MarketingNavbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const closeAndGo = (path) => {
    setOpen(false);
    navigate(path);
  };

  const navLinkClass = (active) =>
    active
      ? "text-black after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-[#ff3131]"
      : "text-black hover:text-[#ff3131]";

  return (
    <header
      className={`sticky top-0 z-50 bg-white transition-shadow duration-300 mkt-nav-bar ${
        scrolled ? "shadow-md border-b border-stone-200" : "border-b border-stone-100"
      }`}
    >
      <div className="mkt-nav-shell mx-auto flex h-14 w-full max-w-[1360px] items-center px-4 sm:px-6 lg:px-0">
        <button type="button" onClick={() => closeAndGo("/")} className="mkt-nav-logo-btn shrink-0" aria-label="MovEazy home">
          <MovEazyLogo variant="light" size="nav" />
        </button>

        <nav className="hidden lg:flex flex-1 items-center justify-center gap-8 xl:gap-10 min-w-0" aria-label="Main">
          {MARKETING_NAV_LINKS.map(({ label, path }) => (
            <button
              key={path}
              type="button"
              onClick={() => closeAndGo(path)}
              aria-current={isNavLinkActive(pathname, path) ? "page" : undefined}
              className={`mkt-nav-link relative px-1 transition-colors whitespace-nowrap ${navLinkClass(isNavLinkActive(pathname, path))}`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="mkt-nav-actions flex items-center justify-end gap-2.5 shrink-0 ml-auto lg:ml-0">
          <button type="button" onClick={() => closeAndGo(HEADER_CTA.path)} className="hidden md:inline-flex md:items-center mkt-nav-cta-outline">
            {HEADER_CTA.label}
          </button>
          <button type="button" onClick={() => closeAndGo(HEADER_SECONDARY_CTA.path)} className="hidden md:inline-flex md:items-center mkt-nav-cta-solid">
            {HEADER_SECONDARY_CTA.label}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden mkt-nav-menu-btn rounded-lg border border-stone-300 text-stone-800 bg-white text-base font-bold"
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {open ? (
        <div className="lg:hidden overflow-hidden border-t bg-white border-stone-200">
          <div className="px-4 py-3 grid gap-0.5 text-[15px] font-medium max-h-[70vh] overflow-y-auto text-stone-800">
            {MARKETING_NAV_LINKS.map(({ label, path }) => (
              <button key={path} type="button" onClick={() => closeAndGo(path)} className="text-left rounded-lg py-2 px-2 hover:bg-stone-100">
                {label}
              </button>
            ))}
            <button type="button" onClick={() => closeAndGo(HEADER_CTA.path)} className="mt-2 rounded-lg py-3 px-3 bg-[#ff3131] text-white text-center text-sm font-bold">
              {HEADER_CTA.label}
            </button>
            <button type="button" onClick={() => closeAndGo("/login")} className="text-left rounded-lg py-2 px-2 font-semibold text-[#ff3131]">
              Login
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
