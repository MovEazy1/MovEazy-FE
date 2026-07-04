import { useAuth } from "../../context/AuthContext";
import { useLoginModal } from "../../context/LoginModalContext";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MovEAZYLogo from "../branding/MovEAZYLogo";
import MovEazyLogo from "../branding/MovEazyLogo";
import {
  HEADER_CTA,
  HEADER_SECONDARY_CTA,
  PRIMARY_NAV_LINKS,
  SERVICE_NAV_ITEMS,
  isNavLinkActive,
  isServiceNavActive,
} from "../../config/navLinks";
import { getAccountMenuItems, getUserFirstName, getUserInitials } from "../../lib/accountNav";

/**
 * @param {{ variant?: "solid" | "marketing" }} props
 * marketing = light bar (Figma home); solid = black bar (rest of site)
 */
export default function Navbar({ variant = "solid" }) {
  const isMarketing = variant === "marketing";
  const { user, logout, loading } = useAuth();
  const { openLogin } = useLoginModal();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const servicesRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const onDoc = (e) => {
      if (servicesRef.current && !servicesRef.current.contains(e.target)) {
        setServicesOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const headerClass = isMarketing
    ? `sticky top-0 z-50 bg-white/90 backdrop-blur-xl transition-all duration-300 ${
        scrolled ? "shadow-[0_16px_36px_rgba(17,24,39,0.12)] border-b border-stone-300/75" : "border-b border-stone-200/65"
      }`
    : `sticky top-0 z-50 transition-[border-color,box-shadow,background] duration-300 bg-[#0d1014]/95 backdrop-blur-xl ${
        scrolled
          ? "border-b border-white/[0.12] shadow-[0_14px_38px_rgba(0,0,0,0.48)]"
          : "border-b border-white/[0.08]"
      }`;

  const closeAndGo = (path) => {
    setOpen(false);
    setServicesOpen(false);
    navigate(path);
  };

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate("/login");
  };

  const navLinkClass = (active) =>
    isMarketing
      ? active
        ? "text-black after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-[#ff3131]"
        : "text-black hover:text-[#ff3131]"
      : active
        ? "text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-red-500"
        : "text-zinc-200 hover:text-white";

  return (
    <header className={`${headerClass} mkt-nav-bar`}>
      <div className="mkt-nav-shell mx-auto flex h-14 w-full max-w-[1360px] items-center px-4 sm:px-6 lg:px-0">
        {/* Logo */}
        <button
          type="button"
          onClick={() => closeAndGo("/")}
          className="mkt-nav-logo-btn shrink-0"
          aria-label="MovEazy home"
        >
          {isMarketing ? <MovEazyLogo variant="light" size="nav" /> : <MovEAZYLogo variant="dark" size="nav" />}
        </button>

        {/* Center nav — desktop */}
        <nav className="hidden lg:flex flex-1 items-center justify-center gap-8 xl:gap-10 min-w-0" aria-label="Main">
          <div className="relative" ref={servicesRef}>
            <button
              type="button"
              onClick={() => setServicesOpen((v) => !v)}
              aria-expanded={servicesOpen}
              className={`mkt-nav-link relative px-1 transition-colors whitespace-nowrap ${navLinkClass(
                isServiceNavActive(pathname)
              )}`}
            >
              Services <span className="ml-0.5 text-[11px] opacity-50 leading-none">▾</span>
            </button>
            <AnimatePresence>
              {servicesOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="absolute left-0 top-full mt-1 min-w-[210px] rounded-xl border border-stone-200 bg-white py-1 shadow-xl z-50"
                >
                  {SERVICE_NAV_ITEMS.map(({ label, path }) => (
                    <button
                      key={path}
                      type="button"
                      onClick={() => closeAndGo(path)}
                      className={`block w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-stone-50 ${
                        isNavLinkActive(pathname, path) ? "text-[#ff3131]" : "text-stone-800"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {PRIMARY_NAV_LINKS.map(({ label, path }) => (
            <button
              key={path}
              type="button"
              onClick={() => closeAndGo(path)}
              aria-current={isNavLinkActive(pathname, path) ? "page" : undefined}
              className={`mkt-nav-link relative px-1 transition-colors whitespace-nowrap ${navLinkClass(
                isNavLinkActive(pathname, path)
              )}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Right actions */}
        <div className="mkt-nav-actions flex items-center justify-end gap-2.5 shrink-0 ml-auto lg:ml-0">
          <button
            type="button"
            onClick={() => closeAndGo(HEADER_CTA.path)}
            className={
              isMarketing
                ? "hidden md:inline-flex md:items-center mkt-nav-cta-outline"
                : "hidden md:inline-flex items-center h-9 px-5 text-sm font-semibold rounded-full border border-white/30 text-white hover:bg-white/10 transition-colors"
            }
          >
            {HEADER_CTA.label}
          </button>

          {loading ? (
            <div className="hidden lg:block w-9 h-9 rounded-full bg-stone-200/80 animate-pulse shrink-0" aria-hidden />
          ) : user ? (
            <div className="hidden lg:flex items-center gap-2 relative">
              <button
                type="button"
                onClick={() => setProfileOpen(v => !v)}
                className="flex items-center gap-2 h-9 pl-1 pr-3 rounded-full border border-stone-200 bg-white hover:bg-stone-50 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1"
              >
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)" }}
                >
                  {getUserInitials(user)}
                </span>
                <span className={`text-sm font-semibold max-w-[120px] truncate ${isMarketing ? "text-stone-900" : "text-white"}`}>
                  {getUserFirstName(user)}
                </span>
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="fixed top-14 right-4 z-50 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-[13px] font-bold text-gray-900 truncate">{user.name || getUserFirstName(user)}</p>
                        <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                      </div>
                      <div className="py-1">
                        {getAccountMenuItems(user).map((item) => (
                          <button
                            key={item.to}
                            type="button"
                            onClick={() => { setProfileOpen(false); closeAndGo(item.to); }}
                            className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                      <div className="border-t border-gray-100 py-1">
                        <button type="button" onClick={() => { setProfileOpen(false); handleLogout(); }}
                          className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-red-600 hover:bg-red-50">
                          Sign out
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ) : !loading ? (
            <button
              type="button"
              onClick={() => { setOpen(false); openLogin(); }}
              className={
                isMarketing
                  ? "hidden md:inline-flex md:items-center mkt-nav-cta-solid"
                    : "hidden md:inline-flex items-center h-9 px-5 text-sm font-semibold rounded-full bg-[#ff3131] text-white hover:bg-[#e52c2c] shadow-[0_10px_24px_rgba(255,49,49,0.28)] transition-colors"
              }
            >
              {HEADER_SECONDARY_CTA.label}
            </button>
          ) : (
            <div className="hidden md:block w-20 h-9 rounded-full bg-stone-200/80 animate-pulse shrink-0" aria-hidden />
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`lg:hidden mkt-nav-menu-btn rounded-lg border text-base font-bold ${
              isMarketing
                ? "border-stone-300 text-stone-800 bg-white hover:bg-stone-100"
                : "border-white/20 bg-white/[0.08] text-zinc-100 hover:bg-white/[0.14]"
            }`}
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`lg:hidden overflow-hidden border-t ${isMarketing ? "bg-white border-stone-200" : "bg-black border-white/[0.08]"}`}
          >
            <div className={`px-4 py-3 grid gap-0.5 text-[15px] font-medium max-h-[70vh] overflow-y-auto ${isMarketing ? "text-stone-800" : "text-zinc-100"}`}>
              <button
                type="button"
                onClick={() => setServicesOpen((v) => !v)}
                className={`flex items-center justify-between rounded-lg px-2 py-2 text-left ${
                  isMarketing ? "hover:bg-stone-100" : "hover:bg-white/[0.08]"
                }`}
              >
                <span className="text-xs font-bold uppercase tracking-wide">Services</span>
                <span className="text-[11px] opacity-50">{servicesOpen ? "▴" : "▾"}</span>
              </button>
              {servicesOpen &&
                SERVICE_NAV_ITEMS.map(({ label, path }) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => closeAndGo(path)}
                    className={`ml-2 text-left rounded-lg py-2 px-2 ${isMarketing ? "hover:bg-stone-100" : "hover:bg-white/[0.08]"}`}
                  >
                    {label}
                  </button>
                ))}
              {PRIMARY_NAV_LINKS.map(({ label, path }) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => closeAndGo(path)}
                  className={`text-left rounded-lg py-2 px-2 ${isMarketing ? "hover:bg-stone-100" : "hover:bg-white/[0.08]"}`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => closeAndGo(HEADER_CTA.path)}
                className="mt-2 rounded-lg py-3 px-3 bg-[#ff3131] text-white text-center text-sm font-bold shadow-[0_10px_20px_rgba(255,49,49,0.24)]"
              >
                {HEADER_CTA.label}
              </button>
              {!loading && !user && (
                <button
                  type="button"
                  onClick={() => { setOpen(false); openLogin(); }}
                  className={`text-left rounded-lg py-2 px-2 font-semibold ${isMarketing ? "text-[#ff3131]" : "text-red-300"}`}
                >
                  Login
                </button>
              )}
              {user && (
                <>
                  <div className={`mt-2 pt-2 border-t ${isMarketing ? "border-stone-200" : "border-white/10"}`}>
                    <div className={`px-2 pb-2 text-xs font-bold uppercase tracking-wide ${isMarketing ? "text-stone-500" : "text-zinc-400"}`}>
                      {getUserFirstName(user)}
                    </div>
                    {getAccountMenuItems(user).map((item) => (
                      <button
                        key={item.to}
                        type="button"
                        onClick={() => closeAndGo(item.to)}
                        className={`w-full text-left rounded-lg py-2 px-2 ${isMarketing ? "hover:bg-stone-100" : "hover:bg-white/[0.08]"}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={handleLogout} className="text-left rounded-lg py-2 px-2 text-red-500 font-semibold">
                    Sign out
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
