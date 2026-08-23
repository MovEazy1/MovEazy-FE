/**
 * Fork home — the "/" landing page.
 * Ported 1:1 from the "MoveAzy Home" Claude Design canvas export (dark teal /
 * mint / amber, Manrope + Caveat). Layout, copy, colors and scroll animations
 * are a direct port of that design's markup + vanilla-JS scroll script into
 * React (refs + useEffect in place of document.querySelector + a class
 * component). Only the interactive buttons are re-wired to this app's real
 * auth-gated flows (see the handlers below) instead of the design's same-page
 * anchor links.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useLoginModal } from "../context/LoginModalContext";
import AIBroker from "../components/AIBroker";
import { fetchUserRequirement } from "../lib/userRequirements";
import livingRoomImg from "../assets/images/Cozy_modern_living_room.png";
import keysImg from "../assets/images/guarentee-keyhandover.jpg";
import sofaImg from "../assets/images/services/image1-sofa.png";
import timelineCityImg from "../assets/images/services/timeline1.png";
import timelinePhoneImg from "../assets/images/services/timeline2.png";

const CHOICE_EASE = [0.22, 1, 0.36, 1];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}

/* ── mobile bottom-bar icons ────────────────────────────────────────────── */

// An apartment block — "find my flat".
function FlatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="23" height="23">
      <path d="M3.5 21V4.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1V21" />
      <path d="M14.5 10h5a1 1 0 0 1 1 1v10" />
      <path d="M2 21h20" />
      <path d="M6.5 7.5h1.5M10 7.5h1.5M6.5 11.5h1.5M10 11.5h1.5M6.5 15.5h1.5M10 15.5h1.5" />
      <path d="M17 14h1M17 17.5h1" />
    </svg>
  );
}

// A person inside a house — the owner listing their own place.
function OwnerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="23" height="23">
      <path d="M3.5 10.6 12 4l8.5 6.6" />
      <path d="M5.5 12.4V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-7.6" />
      <circle cx="12" cy="13.4" r="1.9" />
      <path d="M8.9 20a3.1 3.1 0 0 1 6.2 0" />
    </svg>
  );
}

// A person wearing a tie — the broker.
function BrokerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="23" height="23">
      <circle cx="12" cy="5.2" r="3.1" />
      <path d="M6 21v-1.3c0-2.3 1.9-4.1 4.3-4.5" />
      <path d="M18 21v-1.3c0-2.3-1.9-4.1-4.3-4.5" />
      <path d="M10.3 9.3 12 11.1l1.7-1.8" />
      <path d="M12 11.1 10.9 14.6 12 17.6l1.1-3z" />
    </svg>
  );
}

/* ── word-by-word "old way" story copy ─────────────────────────────────── */
const STORY_LINES = [
  { text: "You scroll through 100s of listings across a dozen websites.", size: "n" },
  { text: "You call 10+ agents, hoping someone actually understands what you’re looking for.", size: "n" },
  { text: "And they always say:", size: "n" },
  { text: "“Bhaiya, aap visit karlo… main aur flats dikhaata hoon.”", size: "big" },
  { text: "Renting shouldn’t run like it’s 1990.", size: "n" },
  { text: "We believe tenants should be able to see every available flat that actually matches their preferences — all in one place.", size: "n" },
  { text: "So you only visit the homes you’re most likely to choose, saving hours of scrolling, endless calls, unnecessary visits, and the hassle that comes with finding a home today.", size: "n" },
];

const LINE_WORDS = [
  { text: "movEazy", accent: false },
  { text: "Brings", accent: false },
  { text: "you", accent: false },
  { text: "the", accent: false },
  { text: "New", accent: true },
  { text: "Age", accent: true },
  { text: "of", accent: true },
  { text: "Renting", accent: true },
  { text: "the", accent: true },
  { text: "House", accent: true },
];

export default function ForkHome() {
  const { user, logout } = useAuth();
  const { openLogin } = useLoginModal();
  const navigate = useNavigate();
  const [showChatbot, setShowChatbot] = useState(false);
  const [showChoice, setShowChoice] = useState(false);
  const [checkingPrefs, setCheckingPrefs] = useState(false);
  const [pendingMatchCheck, setPendingMatchCheck] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef(null);

  // Lock page scroll and allow Escape to dismiss while the mobile menu is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  // "List my Flat" — auth-gate, then open the inventory listing form.
  const listMyFlat = () => (user ? navigate("/list-my-flat") : openLogin(() => navigate("/list-my-flat")));

  // Deep link from the post-publish "Find my next flat" pitch → open the agent.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("find") !== "1") return;
    setSearchParams({}, { replace: true });
    if (user) setShowChatbot(true);
    else openLogin(() => setShowChatbot(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user]);

  // "Show me flats" — gate on sign-in first. A returning user who has already set
  // their preferences skips the map-vs-agent choice entirely and goes straight to
  // their best-matched homes; only a first-timer (no saved requirement) sees the
  // choice between browsing the map or talking to the AI broker.
  const goToMatches = async (uid) => {
    setCheckingPrefs(true);
    try {
      const saved = await fetchUserRequirement(uid);
      if (saved) {
        navigate("/recommendations", { state: { prefs: saved } });
      } else {
        setShowChoice(true);
      }
    } finally {
      setCheckingPrefs(false);
    }
  };

  // A callback handed to openLogin() is captured before the login completes, so
  // `user` inside it is still stale (null). Defer via a flag + effect instead,
  // so the check runs once AuthContext has the freshly-signed-in user.
  useEffect(() => {
    if (!pendingMatchCheck || !user) return;
    setPendingMatchCheck(false);
    goToMatches(user.uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMatchCheck, user]);

  const startFlatSearch = () => {
    if (checkingPrefs) return;
    if (user) {
      goToMatches(user.uid);
    } else {
      openLogin(() => setPendingMatchCheck(true));
    }
  };

  const chooseMap = () => {
    setShowChoice(false);
    navigate("/map");
  };

  const chooseAgent = () => {
    setShowChoice(false);
    setShowChatbot(true);
  };

  const registerOwner = () => listMyFlat();

  // Menu-aware wrappers — every sheet action dismisses the sheet first, so the
  // menu never stays open behind a login modal or a route change.
  const closeThen = (fn) => () => { setMenuOpen(false); fn(); };

  /* ── ported scroll-animation script (progress bar, nav fade, hero parallax,
     data-reveal fades, word-by-word story, letter-flip line, timeline zigzag) —
     a direct translation of the design's componentDidMount, scoped to rootRef
     instead of the whole document. ── */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
    const lerp = (a, b, t) => a + (b - a) * t;
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const q = (s) => root.querySelector(s);
    const qa = (s) => Array.from(root.querySelectorAll(s));

    const progress = q("[data-progress]");
    const nav = q("[data-nav]");
    const hero = q("[data-hero]");
    const heroInner = q("[data-hero-inner]");
    const map = q("[data-map]");
    const route = q("[data-route]");
    const polaroid = q("[data-polaroid]");
    const pinA = q("[data-pin-a]");
    const pinB = q("[data-pin-b]");
    const reveals = qa("[data-reveal]");
    reveals.forEach((el) => { el.style.willChange = "opacity, transform"; });

    const storySec = q('[data-scene="story"]');
    let words = qa("[data-word]");
    words.forEach((w) => { w.style.transition = "color .3s ease"; if (!w.style.color) w.style.color = "#D7DEDC"; });

    const lineSec = q('[data-scene="line"]');
    const letters = qa("[data-letter]");
    const SH_LIGHT = "0 1px 0 #b9cfca, 0 2px 0 #8fada7, 0 3px 0 #6c8f89, 0 4px 0 #4d726c, 0 5px 0 #325852, 0 6px 1px rgba(0,0,0,.35), 0 10px 20px rgba(0,0,0,.5)";
    const SH_ACCENT = "0 1px 0 #3fbfaa, 0 2px 0 #2ea192, 0 3px 0 #22857a, 0 4px 0 #186c63, 0 5px 0 #10544d, 0 6px 1px rgba(0,0,0,.35), 0 10px 20px rgba(0,0,0,.5)";
    letters.forEach((l) => {
      l.style.display = "inline-block";
      l.style.color = l.hasAttribute("data-accent") ? "#5EEAD4" : "#F1F6F4";
      l.style.textShadow = l.hasAttribute("data-accent") ? SH_ACCENT : SH_LIGHT;
      l.style.willChange = "transform, opacity";
    });

    const tlSec = q('[data-scene="timeline"]');
    const tlPath = q("[data-tl-path]");
    const steps = qa("[data-step]");

    const intro = [
      ...qa("[data-intro]").map((el, i) => [el, i * 90]),
      ...qa("[data-card]").map((el, i) => [el, 280 + i * 110]),
      [polaroid, 320, "rotate(6deg)"],
      [route && route.parentElement, 520],
    ];
    intro.forEach(([el, delay, base]) => {
      if (!el) return;
      base = base || "";
      el.style.opacity = "0";
      el.style.transition = "opacity .8s cubic-bezier(.16,1,.3,1), transform .9s cubic-bezier(.16,1,.3,1)";
      const origTransform = el.style.transform;
      el.style.transform = `translateY(22px) ${base}`;
      setTimeout(() => { el.style.opacity = "1"; el.style.transform = origTransform || `translateY(0) ${base}`; }, 60 + delay);
    });
    [pinA, pinB].forEach((el, i) => {
      if (!el) return;
      el.style.opacity = "0";
      el.style.transition = "opacity .7s cubic-bezier(.16,1,.3,1)";
      setTimeout(() => { el.style.opacity = "1"; }, 700 + i * 140);
    });
    const introTransitionClear = setTimeout(() => intro.forEach(([el]) => { if (el) el.style.transition = ""; }), 2400);

    // speed-limited word reveal; completes before the section releases
    let storyTarget = 0, storyShown = 0;
    const MAX_STEP = 0.006;
    const READ_END = 0.82;

    const paintStory = (p) => {
      if (!words.length || !words[0].isConnected) words = qa("[data-word]");
      const wp = clamp(p / READ_END);
      const total = words.length;
      const lit = wp * (total + 4) - 2;
      words.forEach((w, i) => {
        const d = lit - i;
        w.style.color = d >= 0 ? "#0B1A17" : d > -2.5 ? "#9DAAA6" : "#D7DEDC";
      });
    };

    const paintTimeline = () => {
      const vh = window.innerHeight;
      let done = 0;
      steps.forEach((st, i) => {
        const r = st.getBoundingClientRect();
        const p = clamp((vh * 0.9 - r.top) / (vh * 0.5));
        const mediaEl = st.querySelector("[data-step-media]");
        const textEl = st.querySelector("[data-step-text]");
        const nodeEl = st.querySelector("[data-step-node]");
        const dir = i % 2 === 0 ? -1 : 1;
        if (mediaEl) { mediaEl.style.opacity = p; mediaEl.style.transform = `translateX(${(1 - ease(p)) * 46 * dir}px) translateY(${(1 - ease(p)) * 18}px)`; }
        if (textEl) { textEl.style.opacity = p; textEl.style.transform = `translateX(${(1 - ease(p)) * 46 * -dir}px) translateY(${(1 - ease(p)) * 18}px)`; }
        if (nodeEl) {
          const on = p > 0.55;
          nodeEl.style.background = on ? "#0E7C68" : "#F4F2ED";
          nodeEl.style.color = on ? "#F4F2ED" : "#0E7C68";
          nodeEl.style.borderColor = on ? "#0E7C68" : "rgba(14,124,104,.3)";
          nodeEl.style.transform = `scale(${lerp(0.7, 1, ease(p))})`;
          nodeEl.style.transition = "background .3s ease,color .3s ease,border-color .3s ease";
        }
        if (p > 0) done = (i + p) / steps.length;
      });
      if (tlPath) tlPath.style.strokeDasharray = `${clamp(done) * 1000} 1000`;
    };

    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      const total = document.documentElement.scrollHeight - vh;
      const sy = window.scrollY;
      if (progress) progress.style.width = (total > 0 ? clamp(sy / total) * 100 : 0) + "%";

      if (nav) {
        const on = sy > 40;
        nav.style.background = on ? "rgba(4,33,29,.86)" : "transparent";
        nav.style.backdropFilter = on ? "blur(14px)" : "none";
        nav.style.webkitBackdropFilter = on ? "blur(14px)" : "none";
        nav.style.borderBottomColor = on ? "rgba(255,255,255,.08)" : "transparent";
        nav.style.paddingTop = on ? "15px" : "24px";
        nav.style.paddingBottom = on ? "15px" : "24px";
      }

      // The hero's fade-and-drift is written for the design's 100vh desktop
      // hero, where the copy sits at the top and has scrolled away by the time
      // it fades. The mobile hero is ~2x taller and packed top-to-bottom
      // (photo → headline → two stacked cards), so the same curve blanks the
      // CTA cards while they're still on screen. Skip it below the breakpoint
      // and let the hero scroll normally.
      const isMobile = window.matchMedia("(max-width: 900px)").matches;
      const hp = hero ? clamp(sy / (hero.offsetHeight || vh)) : 0;
      if (heroInner) {
        heroInner.style.transform = isMobile ? "" : `translateY(${sy * 0.14}px)`;
        heroInner.style.opacity = isMobile ? "" : clamp(1 - hp * 1.35);
      }
      if (map) map.style.transform = `translateY(${sy * 0.06}px) scale(${1 + hp * 0.08})`;
      if (route && route.parentElement) route.parentElement.style.transform = `translateY(${sy * -0.05}px)`;
      // Keep the tilt on mobile, drop the parallax drift (it's in normal flow there).
      if (polaroid) polaroid.style.transform = isMobile ? "rotate(6deg)" : `translateY(${sy * -0.11}px) rotate(${6 - hp * 5}deg)`;

      reveals.forEach((el) => {
        const r = el.getBoundingClientRect();
        const p = clamp((vh - r.top) / (vh * 0.42));
        el.style.opacity = clamp(p * 1.1);
        el.style.transform = `translateY(${(1 - ease(p)) * 44}px)`;
      });

      if (storySec) {
        const r = storySec.getBoundingClientRect();
        storyTarget = clamp(-r.top / (r.height - vh));
      }

      if (lineSec && letters.length) {
        const r = lineSec.getBoundingClientRect();
        const p = clamp(-r.top / (r.height - vh));
        const wp = clamp(p / 0.72);
        const lit = wp * (letters.length + 8) - 4;
        letters.forEach((l, i) => {
          const t = ease(clamp(lit - i));
          l.style.opacity = t;
          l.style.transform = `translateY(${(1 - t) * 46}px) rotateX(${(1 - t) * -72}deg) scale(${lerp(0.86, 1, t)})`;
        });
      }

      if (tlSec) {
        const r = tlSec.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) paintTimeline();
      }
    };

    let raf;
    let repaint = true;
    const loop = () => {
      const d = storyTarget - storyShown;
      if (Math.abs(d) > 0.0002 || repaint) {
        repaint = false;
        storyShown += Math.sign(d) * Math.min(Math.abs(d) * 0.16 + 0.0008, MAX_STEP);
        paintStory(clamp(storyShown));
      }
      raf = requestAnimationFrame(loop);
    };

    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    requestAnimationFrame(update);
    const updateTimer = setTimeout(update, 300);
    paintStory(0);
    loop();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
      clearTimeout(introTransitionClear);
      clearTimeout(updateTimer);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="mzn-root"
      style={{ background: "#04211D", color: "#F1F6F4", fontFamily: "'Manrope', sans-serif", WebkitFontSmoothing: "antialiased", overflowX: "clip" }}
    >
      <style>{`
        .mzn-root, .mzn-root *, .mzn-root *::before, .mzn-root *::after { margin: 0; padding: 0; box-sizing: border-box; }
        .mzn-root a { color: #5EEAD4; text-decoration: none; }
        .mzn-root a:hover { color: #8ff3e4; }
        .mzn-root ::selection { background: #5EEAD4; color: #04211D; }
        @keyframes mznDashmove { to { stroke-dashoffset: -320; } }
        @keyframes mznPinpulse { 0%, 100% { transform: scale(1); opacity: .9; } 50% { transform: scale(1.35); opacity: .25; } }
        .mzn-badge-new { background: linear-gradient(135deg,#FFE1A6,#E8A33D 45%,#B9782A); box-shadow: 0 0 0 1px rgba(255,255,255,.35) inset, 0 1px 4px rgba(232,163,61,.5); color: #1B1204; font-size: 8px; font-weight: 800; letter-spacing: .02em; padding: 1.5px 6px; border-radius: 100px; line-height: 1.6; align-self: flex-start; margin-top: -4px; }
        .mzn-root button { font-family: inherit; cursor: pointer; }
        .mzn-root a[href^="#"]:focus-visible, .mzn-root button:focus-visible, .mzn-root a:focus-visible { outline: 2px solid #5EEAD4; outline-offset: 3px; border-radius: 4px; }

        /* Mobile chrome — hidden entirely on desktop, which keeps the design's
           original pill nav untouched. */
        .mzn-burger { display: none; align-items: center; justify-content: center; width: 44px; height: 44px; border: none; background: rgba(255,255,255,.08); border-radius: 50%; color: #F1F6F4; flex: none; }
        .mzn-burger svg { display: block; }
        .mzn-sheet, .mzn-backdrop, .mzn-bottombar { display: none; }

        /* The design has no responsive handling of its own — everything below is
           added on top so the hero's absolutely-positioned map/route/pins/polaroid
           (sized as percentages of the whole hero box) stop overlapping the
           headline and cards once mobile text height pushes the hero well past
           100vh, and the 3-column timeline grid stops squeezing into slivers. */
        @media (max-width: 900px) {
          .mzn-nav { padding: 12px 14px !important; gap: 10px !important; }
          /* The horizontally-scrolling pill can't fit on a phone — it collapses
             into the hamburger sheet instead. */
          .mzn-nav-links, .mzn-nav-cta { display: none !important; }
          .mzn-burger { display: inline-flex; margin-left: auto; }

          .mzn-backdrop {
            display: block; position: fixed; inset: 0; z-index: 170;
            background: rgba(2,16,14,.5); opacity: 0; pointer-events: none;
            transition: opacity .25s ease;
          }
          .mzn-backdrop.is-open { opacity: 1; pointer-events: auto; }
          .mzn-sheet {
            display: flex; flex-direction: column; gap: 4px;
            position: absolute; top: calc(100% + 6px); left: 14px; right: 14px; z-index: 185;
            background: #062D27; border: 1px solid rgba(255,255,255,.10);
            border-radius: 20px; padding: 10px;
            box-shadow: 0 24px 60px rgba(0,0,0,.55);
            transform: translateY(-10px) scale(.98); opacity: 0; pointer-events: none;
            transform-origin: top center;
            transition: transform .26s cubic-bezier(.22,1,.36,1), opacity .22s ease;
          }
          .mzn-sheet.is-open { transform: translateY(0) scale(1); opacity: 1; pointer-events: auto; }
          /* Scoped with .mzn-root so these beat the page-wide mint anchor
             colour — otherwise the Link rows and button rows in the same
             list render in two different colours. */
          .mzn-root .mzn-sheet-link {
            display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 16px;
            border-radius: 12px; font-size: 15px; font-weight: 600; color: #CBD9D5;
            background: none; border: none; width: 100%; text-align: left;
          }
          .mzn-root .mzn-sheet-link.is-active { background: #5EEAD4; color: #04211D; font-weight: 700; }
          .mzn-root .mzn-sheet-link:active { background: rgba(255,255,255,.07); }
          .mzn-root .mzn-sheet-link.is-active:active { background: #5EEAD4; }
          /* The badge is top-aligned against the tiny desktop pill labels; in
             the roomier sheet rows it should sit inline with the text. */
          .mzn-sheet-link .mzn-badge-new { align-self: center; margin-top: 0; }
          .mzn-sheet-cta {
            display: flex; align-items: center; justify-content: center; gap: 6px;
            min-height: 48px; margin-top: 2px; border: none; border-radius: 100px;
            background: #5EEAD4; color: #04211D; font-size: 15px; font-weight: 700;
          }
          .mzn-sheet-divider { height: 1px; background: rgba(255,255,255,.10); margin: 6px 4px; }
          .mzn-sheet-signin {
            display: flex; align-items: center; justify-content: center; gap: 7px;
            min-height: 48px; border-radius: 100px; border: 1px solid rgba(255,255,255,.22);
            background: transparent; color: #F1F6F4; font-size: 15px; font-weight: 600;
          }

          /* Fixed bottom action bar. env(safe-area-inset-bottom) keeps it clear
             of the iOS home indicator. */
          .mzn-bottombar {
            display: grid; grid-template-columns: repeat(3, 1fr);
            position: fixed; left: 0; right: 0; bottom: 0; z-index: 190;
            background: rgba(4,33,29,.95);
            -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
            border-top: 1px solid rgba(255,255,255,.10);
            padding: 8px 4px calc(8px + env(safe-area-inset-bottom, 0px));
          }
          .mzn-bottombar button {
            display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
            gap: 5px; padding: 6px 2px; background: none; border: none;
            color: #CBD9D5; font-size: 11px; font-weight: 700; line-height: 1.2;
            text-align: center; letter-spacing: -.01em;
          }
          .mzn-bottombar button:active { color: #5EEAD4; }
          .mzn-bottombar svg { flex: none; }

          .mzn-hero { flex-direction: column !important; min-height: auto !important; padding: 128px 20px 56px !important; }
          .mzn-hero-map, .mzn-hero-route-wrap { display: none !important; }
          .mzn-polaroid { position: relative !important; right: auto !important; left: auto !important; top: auto !important; width: min(260px, 78vw) !important; margin: 0 auto 32px !important; }
          .mzn-hero-cards { grid-template-columns: 1fr !important; }
          .mzn-tl-step { grid-template-columns: 1fr !important; row-gap: 14px !important; }
          /* Clear the fixed bottom bar so it never covers the last of the page. */
          .mzn-footer { padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px)) !important; }
        }
      `}</style>

      <div data-progress style={{ position: "fixed", top: 0, left: 0, height: 3, width: "0%", background: "linear-gradient(90deg,#5EEAD4,#E8A33D)", zIndex: 200 }} />

      {/* ── NAV ── */}
      <nav
        data-nav
        className="mzn-nav"
        style={{ position: "fixed", top: 0, left: 0, width: "100%", zIndex: 180, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px clamp(14px,3vw,50px)", transition: "background .3s ease, padding .3s ease, border-color .3s ease", borderBottom: "1px solid transparent", gap: "clamp(6px,1.4vw,20px)" }}
      >
        <Link to="/" style={{ fontWeight: 800, fontSize: "clamp(18px,2vw,24px)", letterSpacing: "-.02em", color: "#fff", flex: "none" }}>
          mov<span style={{ color: "#5EEAD4" }}>EAZY</span>
        </Link>
        <div className="mzn-nav-links" style={{ display: "flex", alignItems: "center", gap: "clamp(2px,.6vw,8px)", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 100, padding: 6, flex: 1, minWidth: 0, maxWidth: 780, overflowX: "auto", scrollbarWidth: "none", justifyContent: "center" }}>
          <Link to="/" style={{ background: "#5EEAD4", color: "#04211D", fontWeight: 700, fontSize: "clamp(12px,1.05vw,14px)", padding: "10px clamp(14px,1.6vw,20px)", borderRadius: 100, whiteSpace: "nowrap", flex: "none" }}>Home</Link>
          <Link to="/how-it-works" style={{ color: "#CBD9D5", fontWeight: 600, fontSize: "clamp(12px,1.05vw,14px)", padding: "10px clamp(12px,1.4vw,18px)", borderRadius: 100, whiteSpace: "nowrap", flex: "none" }}>How it Works</Link>
          <Link to="/about" style={{ color: "#CBD9D5", fontWeight: 600, fontSize: "clamp(12px,1.05vw,14px)", padding: "10px clamp(12px,1.4vw,18px)", borderRadius: 100, whiteSpace: "nowrap", flex: "none" }}>About Us</Link>
          <a href="#" onClick={(e) => { e.preventDefault(); registerOwner(); }} style={{ display: "flex", alignItems: "center", gap: 6, color: "#CBD9D5", fontWeight: 600, fontSize: "clamp(12px,1.05vw,14px)", padding: "10px clamp(12px,1.4vw,18px)", borderRadius: 100, whiteSpace: "nowrap", flex: "none" }}>
            Register as an Owner<span className="mzn-badge-new">new</span>
          </a>
          <Link to="/register-broker" style={{ display: "flex", alignItems: "center", gap: 6, color: "#CBD9D5", fontWeight: 600, fontSize: "clamp(12px,1.05vw,14px)", padding: "10px clamp(12px,1.4vw,18px)", borderRadius: 100, whiteSpace: "nowrap", flex: "none" }}>
            Register as a Broker<span className="mzn-badge-new">new</span>
          </Link>
        </div>
        <a href="#" className="mzn-nav-cta" onClick={(e) => { e.preventDefault(); startFlatSearch(); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "#5EEAD4", color: "#04211D", fontWeight: 700, fontSize: "clamp(12px,1.1vw,15px)", padding: "11px clamp(12px,1.6vw,22px)", borderRadius: 100, flex: "none", whiteSpace: "nowrap" }}>
          Start your move <span style={{ fontSize: 13 }}>&#8599;</span>
        </a>

        {/* Mobile hamburger — desktop keeps the pill nav above. */}
        <button
          type="button"
          className="mzn-burger"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          )}
        </button>

        {/* Mobile slide-down menu — every nav destination plus sign-in at the end. */}
        <div className={`mzn-sheet ${menuOpen ? "is-open" : ""}`} role="menu">
          <Link to="/" className="mzn-sheet-link is-active" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link to="/how-it-works" className="mzn-sheet-link" onClick={() => setMenuOpen(false)}>How it Works</Link>
          <Link to="/about" className="mzn-sheet-link" onClick={() => setMenuOpen(false)}>About Us</Link>
          <button type="button" className="mzn-sheet-link" onClick={closeThen(registerOwner)}>
            Register as an Owner<span className="mzn-badge-new">new</span>
          </button>
          <Link to="/register-broker" className="mzn-sheet-link" onClick={() => setMenuOpen(false)}>
            Register as a Broker<span className="mzn-badge-new">new</span>
          </Link>
          <button type="button" className="mzn-sheet-cta" onClick={closeThen(startFlatSearch)}>
            Start your move <span style={{ fontSize: 13 }}>&#8599;</span>
          </button>
          <div className="mzn-sheet-divider" />
          {user ? (
            <>
              <button type="button" className="mzn-sheet-link" onClick={closeThen(() => navigate("/profile"))}>My Profile</button>
              <button type="button" className="mzn-sheet-signin" onClick={closeThen(() => logout())}>Sign Out</button>
            </>
          ) : (
            <button type="button" className="mzn-sheet-signin" onClick={closeThen(() => openLogin())}>
              Sign In
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" />
              </svg>
            </button>
          )}
        </div>
      </nav>
      <div className={`mzn-backdrop ${menuOpen ? "is-open" : ""}`} onClick={() => setMenuOpen(false)} aria-hidden />

      {/* ── HERO ── */}
      <section data-hero className="mzn-hero" style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", padding: "120px clamp(20px,4vw,60px) 60px", background: "radial-gradient(120% 100% at 85% 25%, #0A3A33 0%, #052723 45%, #04211D 100%)", overflow: "hidden" }}>

        <svg data-map className="mzn-hero-map" viewBox="0 0 900 900" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", right: "-6%", top: 0, height: "100%", width: "70%", zIndex: 0, opacity: 0.5 }}>
          <g stroke="#0f5a4d" strokeWidth="1.1" fill="none" opacity="0.85">
            <path d="M0 120 L900 60 M0 300 L900 250 M0 470 L900 430 M0 640 L900 610 M0 810 L900 790" />
            <path d="M110 0 L60 900 M290 0 L250 900 M470 0 L440 900 M650 0 L620 900 M830 0 L810 900" />
            <path d="M0 200 L340 0 M300 900 L900 350 M0 700 L520 900" />
          </g>
          <g stroke="#9a7a2e" strokeWidth="2.4" fill="none" opacity="0.55">
            <path d="M-20 640 C180 600 250 470 430 430 C620 388 700 240 900 210" />
            <path d="M700 900 C740 660 820 520 900 470" />
          </g>
          <g stroke="#0d4c42" strokeWidth="4" fill="none" opacity="0.5">
            <path d="M0 520 C220 500 300 330 560 300 C740 280 800 150 900 130" />
          </g>
        </svg>

        <div className="mzn-hero-route-wrap" style={{ position: "absolute", right: "12%", top: "14%", height: "40%", width: "calc(40vh * 400 / 480)", zIndex: 1 }}>
          <svg data-route viewBox="0 0 400 480" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
            <path d="M60 470 C150 415 30 350 130 300 C230 250 110 210 210 165 C290 130 240 75 340 40 C365 30 375 25 385 20" fill="none" stroke="#E8A33D" strokeWidth="2.6" strokeDasharray="9 11" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "mznDashmove 9s linear infinite" }} />
          </svg>
          <div data-pin-a style={{ position: "absolute", left: "96%", top: "4.2%", transform: "translate(-50%,-92%)", zIndex: 2 }}>
            <svg width="30" height="40" viewBox="0 0 24 32" fill="none">
              <path d="M12 1c5.5 0 10 4.4 10 9.9C22 18.6 12 31 12 31S2 18.6 2 10.9C2 5.4 6.5 1 12 1z" stroke="#E8A33D" strokeWidth="1.8" fill="rgba(232,163,61,.10)" />
              <circle cx="12" cy="11" r="3.2" fill="#E8A33D" style={{ animation: "mznPinpulse 2.6s ease-in-out infinite", transformOrigin: "12px 11px" }} />
            </svg>
          </div>
          <div data-pin-b style={{ position: "absolute", left: "15%", top: "97.9%", transform: "translate(-50%,-92%)", zIndex: 2 }}>
            <svg width="26" height="35" viewBox="0 0 24 32" fill="none">
              <path d="M12 1c5.5 0 10 4.4 10 9.9C22 18.6 12 31 12 31S2 18.6 2 10.9C2 5.4 6.5 1 12 1z" stroke="#5EEAD4" strokeWidth="1.8" fill="rgba(94,234,212,.10)" />
              <circle cx="12" cy="11" r="3" fill="#5EEAD4" style={{ animation: "mznPinpulse 2.6s ease-in-out infinite", transformOrigin: "12px 11px" }} />
            </svg>
          </div>
        </div>

        <div data-polaroid className="mzn-polaroid" style={{ position: "absolute", right: "clamp(210px,17vw,320px)", top: "19%", width: "clamp(190px,16vw,250px)", zIndex: 3, transform: "rotate(6deg)", background: "#EFEAE1", padding: "10px 10px 0", borderRadius: 3, boxShadow: "0 30px 70px rgba(0,0,0,.5)" }}>
          <div style={{ position: "absolute", top: -13, left: "24%", width: 70, height: 28, background: "rgba(94,234,212,.42)", transform: "rotate(-12deg)" }} />
          <div style={{ aspectRatio: "1/.84", borderRadius: 2, backgroundImage: `url(${livingRoomImg})`, backgroundSize: "cover", backgroundPosition: "center" }} />
          <div style={{ fontFamily: "'Caveat'", fontSize: 19, color: "#1b1a17", padding: "9px 3px 11px", transform: "rotate(-2deg)" }}>Home base. Found. &#9825;&#9825;</div>
        </div>

        <div data-hero-inner style={{ position: "relative", zIndex: 4, maxWidth: 1240, margin: "0 auto", width: "100%" }}>
          <div data-intro style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontFamily: "'Caveat'", fontSize: "clamp(22px,2.2vw,30px)", color: "#5EEAD4" }}>Your adventure begins here</span>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#5EEAD4" strokeWidth="1.5"><path d="M2 12l19-8-7 19-3-8-9-3z" strokeLinejoin="round" /></svg>
          </div>
          <h1 data-intro style={{ fontFamily: "'Manrope', sans-serif", color: "#F1F6F4", fontWeight: 800, fontSize: "clamp(38px,5.8vw,80px)", lineHeight: 1.03, letterSpacing: "-.035em", margin: "16px 0 0", maxWidth: "14ch" }}>
            New city on the map. New home in <span style={{ color: "#5EEAD4" }}>your story.</span>
          </h1>
          <p data-intro style={{ maxWidth: 420, margin: "22px 0 0", fontSize: "clamp(16px,1.4vw,20px)", lineHeight: 1.5, color: "#B7CBC6" }}>
            We take care of the boring stuff, so you can focus on the big stuff.
          </p>

          <div className="mzn-hero-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: "clamp(18px,2.2vw,32px)", marginTop: "clamp(40px,6vh,72px)", width: "100%" }}>
            <a href="#" data-card onClick={(e) => { e.preventDefault(); startFlatSearch(); }} style={{ border: "1px solid rgba(94,234,212,.28)", borderRadius: 20, padding: "clamp(26px,2.6vw,38px)", background: "rgba(6,45,39,.74)", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <span style={{ flex: "none", width: 60, height: 60, borderRadius: "50%", border: "1px solid rgba(94,234,212,.45)", background: "rgba(94,234,212,.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5EEAD4" strokeWidth="1.6"><path d="M3 10.5 12 3l9 7.5V21H3z" strokeLinejoin="round" /><path d="M9 14l2.2 2.2L15.5 12" strokeLinecap="round" /></svg>
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", color: "#DCE8E5", fontSize: 16, fontWeight: 500 }}>Moving in?</span>
                  <span style={{ display: "block", color: "#5EEAD4", fontSize: "clamp(21px,2vw,28px)", fontWeight: 800, letterSpacing: "-.02em", marginTop: 2 }}>Find your perfect home</span>
                </span>
                <span style={{ flex: "none", width: 44, height: 44, borderRadius: "50%", background: "#5EEAD4", color: "#04211D", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700 }}>&#8594;</span>
              </div>
              <div style={{ color: "#9FB5B0", fontSize: 16, lineHeight: 1.5, marginTop: 20 }}>Curated homes matched to how you actually live, with real photos and same-day visits. <span style={{ color: "#5EEAD4" }}>Hassle-free.</span></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
                <span style={{ border: "1px solid rgba(94,234,212,.22)", color: "#CBE4DF", fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 100 }}>Curated homes</span>
                <span style={{ border: "1px solid rgba(94,234,212,.22)", color: "#CBE4DF", fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 100 }}>Deposit protection</span>
                <span style={{ border: "1px solid rgba(94,234,212,.22)", color: "#CBE4DF", fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 100 }}>Move in within 7 days</span>
              </div>
            </a>
            <a href="#" data-card onClick={(e) => { e.preventDefault(); listMyFlat(); }} style={{ border: "1px solid rgba(232,163,61,.30)", borderRadius: 20, padding: "clamp(26px,2.6vw,38px)", background: "rgba(6,45,39,.74)", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <span style={{ flex: "none", width: 60, height: 60, borderRadius: "50%", border: "1px solid rgba(232,163,61,.48)", background: "rgba(232,163,61,.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E8A33D" strokeWidth="1.6"><path d="M20.5 13.2 13.2 20.5a2 2 0 0 1-2.8 0l-7-7V3.5H11l9.5 9.7z" strokeLinejoin="round" /><circle cx="7.6" cy="7.6" r="1.5" /></svg>
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", color: "#DCE8E5", fontSize: 16, fontWeight: 500 }}>Moving out?</span>
                  <span style={{ display: "block", color: "#E8A33D", fontSize: "clamp(21px,2vw,28px)", fontWeight: 800, letterSpacing: "-.02em", marginTop: 2 }}>List your flat now</span>
                </span>
                <span style={{ flex: "none", width: 44, height: 44, borderRadius: "50%", background: "#5EEAD4", color: "#04211D", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700 }}>&#8594;</span>
              </div>
              <div style={{ color: "#9FB5B0", fontSize: 16, lineHeight: 1.5, marginTop: 20 }}>Reach genuine, move-ready tenants while we handle visits and coordination. Zero <span style={{ color: "#E8A33D" }}>hassle.</span></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
                <span style={{ border: "1px solid rgba(232,163,61,.24)", color: "#EBDCC2", fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 100 }}>Verified tenants</span>
                <span style={{ border: "1px solid rgba(232,163,61,.24)", color: "#EBDCC2", fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 100 }}>Visits handled</span>
                <span style={{ border: "1px solid rgba(232,163,61,.24)", color: "#EBDCC2", fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 100 }}>No hidden fees</span>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* ── TRUST BAND ── */}
      <section style={{ background: "#F4F2ED", color: "#12211E", padding: "clamp(36px,6vh,64px) clamp(20px,4vw,60px)" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 36, alignItems: "center", justifyContent: "space-between" }}>
          <div data-reveal style={{ display: "flex", alignItems: "center", gap: 34, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 13, letterSpacing: ".18em", color: "#6C7A77", fontWeight: 700 }}>TRUSTED BY</div>
              <div style={{ fontWeight: 800, fontSize: "clamp(32px,3.4vw,44px)", color: "#0E7C68", lineHeight: 1.05, margin: "4px 0" }}>100+</div>
              <div style={{ fontSize: 13, letterSpacing: ".18em", color: "#6C7A77", fontWeight: 700 }}>HAPPY MOVERS</div>
              <div style={{ fontSize: 14, color: "#6C7A77", fontWeight: 600, marginTop: 6 }}>within 2 months of operations</div>
            </div>
            <div style={{ display: "flex" }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} style={{ width: 56, height: 56, borderRadius: "50%", border: "3px solid #F4F2ED", background: "repeating-linear-gradient(45deg,rgba(0,0,0,.10) 0 8px,rgba(0,0,0,.04) 8px 16px)", marginLeft: i === 0 ? 0 : -14 }} />
              ))}
            </div>
          </div>
          <div data-reveal style={{ display: "flex", gap: 16, maxWidth: 520, borderLeft: "1px solid rgba(0,0,0,.12)", paddingLeft: 32 }}>
            <span style={{ fontSize: 44, lineHeight: 0.8, color: "#0E7C68", fontWeight: 800 }}>&#8220;</span>
            <span>
              <span style={{ display: "block", fontSize: 17, lineHeight: 1.5, color: "#22322E" }}>"movEazy made my move to Bangalore smooth and stress-free."</span>
              <span style={{ display: "block", fontSize: 15, color: "#6C7A77", marginTop: 8 }}>&#8211; <strong style={{ color: "#12211E" }}>Ananya</strong>, moved in July '26</span>
            </span>
          </div>
        </div>
      </section>

      {/* ── SCENE: WORD-BY-WORD STORY ── */}
      <section data-scene="story" style={{ position: "relative", height: "640vh", background: "#FFFFFF" }}>
        <div data-inner style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden", background: "#FFFFFF", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 clamp(20px,4vw,60px)" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "clamp(10px,1.6vh,20px)" }}>
            <div style={{ fontSize: 13, letterSpacing: ".18em", color: "#0E7C68", fontWeight: 700, marginBottom: "clamp(6px,1.4vh,16px)" }}>THE OLD WAY OF MOVING</div>
            {STORY_LINES.map((line, li) => (
              <p
                key={li}
                data-words
                style={{
                  fontWeight: 800,
                  fontStyle: line.size === "big" ? "italic" : "normal",
                  fontSize: line.size === "big" ? "clamp(22px,2.9vw,44px)" : "clamp(16px,1.85vw,28px)",
                  lineHeight: line.size === "big" ? 1.32 : 1.42,
                  letterSpacing: "-.018em",
                  color: "#D7DEDC",
                  textWrap: "pretty",
                  margin: 0,
                }}
              >
                {line.text.split(" ").map((w, wi) => (
                  <span key={wi} data-word>{w}{wi < line.text.split(" ").length - 1 ? " " : ""}</span>
                ))}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCENE: THE LINE ── */}
      <section data-scene="line" style={{ position: "relative", height: "200vh", background: "#04211D" }}>
        <div data-inner style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 clamp(20px,4vw,60px)", background: "radial-gradient(110% 90% at 50% 40%, #0A3A33 0%, #052723 48%, #04211D 100%)" }}>
          <h2 data-line-head style={{ fontFamily: "'Manrope', sans-serif", maxWidth: 1150, textAlign: "center", fontWeight: 800, fontSize: "clamp(34px,6.4vw,100px)", lineHeight: 1.14, letterSpacing: "-.035em", color: "#F1F6F4", perspective: 900 }}>
            {LINE_WORDS.map((w, wi) => (
              <span key={wi} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
                {w.text.split("").map((ch, ci) => (
                  <span key={ci} data-letter {...(w.accent ? { "data-accent": "" } : {})}>{ch}</span>
                ))}
                {wi < LINE_WORDS.length - 1 ? " " : ""}
              </span>
            ))}
          </h2>
        </div>
      </section>

      {/* ── TIMELINE: MOVING MADE EASY ── */}
      <section data-scene="timeline" id="how" style={{ position: "relative", background: "#F4F2ED", color: "#0B1A17", padding: "clamp(70px,11vh,130px) clamp(20px,4vw,60px) clamp(80px,12vh,150px)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div data-reveal style={{ display: "flex", flexWrap: "wrap", gap: 30, justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: "'Caveat'", fontSize: "clamp(20px,2vw,26px)", color: "#0E7C68" }}>We've got your back</div>
              <h2 style={{ fontFamily: "'Manrope', sans-serif", color: "#0B1A17", fontWeight: 800, fontSize: "clamp(30px,4.4vw,60px)", lineHeight: 1.05, letterSpacing: "-.03em", marginTop: 8 }}>
                Moving made <span style={{ color: "#0E7C68" }}>easy.</span><br />Here's how we do it.
              </h2>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, paddingTop: 10 }}>
              <span style={{ fontFamily: "'Caveat'", fontSize: "clamp(17px,1.6vw,21px)", color: "#5C6B67", lineHeight: 1.3, textAlign: "right" }}>all in one,<br />so you can chill.</span>
              <svg width="46" height="46" viewBox="0 0 46 46" fill="none" stroke="#5C6B67" strokeWidth="1.4">
                <path d="M8 6c-2 14 4 26 18 32" strokeLinecap="round" />
                <path d="M20 32l6 6-8 2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="37" cy="14" r="7" />
                <path d="M34.4 12.4h.01M39.6 12.4h.01M34 16.4c.8 1 1.8 1.5 3 1.5s2.2-.5 3-1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          <div style={{ position: "relative", marginTop: "clamp(48px,7vh,84px)" }}>
            <svg viewBox="0 0 100 1000" preserveAspectRatio="none" style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)", width: 120, height: "100%", overflow: "visible", zIndex: 0 }}>
              <path d="M50 0 C78 90 22 180 50 280 C78 380 22 470 50 570 C78 670 22 760 50 860 C70 925 45 965 50 1000" fill="none" stroke="rgba(14,124,104,.20)" strokeWidth="2" strokeDasharray="7 9" />
              <path data-tl-path d="M50 0 C78 90 22 180 50 280 C78 380 22 470 50 570 C78 670 22 760 50 860 C70 925 45 965 50 1000" pathLength="1000" fill="none" stroke="#0E7C68" strokeWidth="2.4" strokeDasharray="0 1000" />
            </svg>

            <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: "clamp(26px,4vh,50px)" }}>

              <div data-step className="mzn-tl-step" style={{ display: "grid", gridTemplateColumns: "1fr 76px 1fr", alignItems: "center" }}>
                <div data-step-media style={{ borderRadius: 18, overflow: "hidden", background: "#0C1A18", boxShadow: "0 22px 50px rgba(0,0,0,.14)", position: "relative", aspectRatio: "16/11" }}>
                  <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${timelinePhoneImg})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                  <span style={{ position: "absolute", top: 16, left: 16, width: 34, height: 34, borderRadius: "50%", background: "#F4F2ED", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0E7C68" strokeWidth="1.8"><path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.4-4.6A8 8 0 0 1 13 4a8 8 0 0 1 8 8z" strokeLinejoin="round" /></svg>
                  </span>
                  <span style={{ position: "absolute", bottom: 16, left: 16, width: 46, height: 46, borderRadius: "50%", background: "rgba(4,33,29,.72)", border: "1px solid rgba(94,234,212,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5EEAD4" strokeWidth="1.6"><path d="M20 11a7 7 0 0 1-7 7H9l-4 2.5 1-3.6A7 7 0 0 1 13 4a7 7 0 0 1 7 7z" strokeLinejoin="round" /></svg>
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}><span data-step-node style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid rgba(14,124,104,.3)", background: "#F4F2ED", color: "#0E7C68", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>1</span></div>
                <div data-step-text style={{ background: "#fff", border: "1px solid rgba(0,0,0,.07)", borderRadius: 18, padding: "clamp(22px,2.4vw,32px)" }}>
                  <h3 style={{ fontFamily: "'Manrope', sans-serif", color: "#0B1A17", fontWeight: 800, fontSize: "clamp(19px,1.9vw,25px)", lineHeight: 1.25, letterSpacing: "-.02em" }}>You tell us your <span style={{ color: "#0E7C68" }}>requirements</span></h3>
                  <p style={{ color: "#5C6B67", fontSize: 15, lineHeight: 1.55, marginTop: 12 }}>Share your needs, deal breakers, preferences and everything in between.</p>
                </div>
              </div>

              <div data-step className="mzn-tl-step" style={{ display: "grid", gridTemplateColumns: "1fr 76px 1fr", alignItems: "center" }}>
                <div data-step-text style={{ background: "#fff", border: "1px solid rgba(0,0,0,.07)", borderRadius: 18, padding: "clamp(22px,2.4vw,32px)" }}>
                  <h3 style={{ fontFamily: "'Manrope', sans-serif", color: "#0B1A17", fontWeight: 800, fontSize: "clamp(19px,1.9vw,25px)", lineHeight: 1.25, letterSpacing: "-.02em" }}>We guide you <span style={{ color: "#0E7C68" }}>everything</span> about the city</h3>
                  <p style={{ color: "#5C6B67", fontSize: 15, lineHeight: 1.55, marginTop: 12 }}>From traffic choke points to party areas to walking neighbourhoods, we tell you what others won't.</p>
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}><span data-step-node style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid rgba(14,124,104,.3)", background: "#F4F2ED", color: "#0E7C68", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>2</span></div>
                <div data-step-media style={{ borderRadius: 18, overflow: "hidden", background: "#0C1A18", boxShadow: "0 22px 50px rgba(0,0,0,.14)", position: "relative", aspectRatio: "16/11" }}>
                  <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${timelineCityImg})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                  <span style={{ position: "absolute", top: 16, right: 16, width: 34, height: 34, borderRadius: "50%", background: "#F4F2ED", color: "#0E7C68", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>2</span>
                  <span style={{ position: "absolute", bottom: 16, left: 16, width: 46, height: 46, borderRadius: "50%", background: "rgba(4,33,29,.72)", border: "1px solid rgba(94,234,212,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5EEAD4" strokeWidth="1.6"><path d="M12 2c3.9 0 7 3 7 6.9C19 14 12 22 12 22S5 14 5 8.9C5 5 8.1 2 12 2z" strokeLinejoin="round" /><circle cx="12" cy="9" r="2.2" /></svg>
                  </span>
                </div>
              </div>

              <div data-step className="mzn-tl-step" style={{ display: "grid", gridTemplateColumns: "1fr 76px 1fr", alignItems: "center" }}>
                <div data-step-media style={{ borderRadius: 18, overflow: "hidden", background: "#0C1A18", boxShadow: "0 22px 50px rgba(0,0,0,.14)", position: "relative", aspectRatio: "16/11" }}>
                  <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${keysImg})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                  <span style={{ position: "absolute", top: 16, left: 16, width: 34, height: 34, borderRadius: "50%", background: "#F4F2ED", color: "#0E7C68", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>3</span>
                  <span style={{ position: "absolute", bottom: 16, left: 16, width: 46, height: 46, borderRadius: "50%", background: "rgba(4,33,29,.72)", border: "1px solid rgba(94,234,212,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5EEAD4" strokeWidth="1.6"><circle cx="12" cy="4.6" r="2.2" /><path d="M12 7.4v5l3.4 3.2 1.6 5.4M12 12.4 8.4 15l-1.8 5.4M8.6 10.2 12 8.6l3.6 1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}><span data-step-node style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid rgba(14,124,104,.3)", background: "#F4F2ED", color: "#0E7C68", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>3</span></div>
                <div data-step-text style={{ background: "#fff", border: "1px solid rgba(0,0,0,.07)", borderRadius: 18, padding: "clamp(22px,2.4vw,32px)" }}>
                  <h3 style={{ fontFamily: "'Manrope', sans-serif", color: "#0B1A17", fontWeight: 800, fontSize: "clamp(19px,1.9vw,25px)", lineHeight: 1.25, letterSpacing: "-.02em" }}>We help you move in to your perfect home within <span style={{ color: "#0E7C68" }}>7 days</span></h3>
                  <p style={{ color: "#5C6B67", fontSize: 15, lineHeight: 1.55, marginTop: 12 }}>Our on ground agent handles everything, so you don't have to lift a finger.</p>
                </div>
              </div>

              <div data-step className="mzn-tl-step" style={{ display: "grid", gridTemplateColumns: "1fr 76px 1fr", alignItems: "center" }}>
                <div data-step-text style={{ background: "#fff", border: "1px solid rgba(0,0,0,.07)", borderRadius: 18, padding: "clamp(22px,2.4vw,32px)" }}>
                  <h3 style={{ fontFamily: "'Manrope', sans-serif", color: "#0B1A17", fontWeight: 800, fontSize: "clamp(19px,1.9vw,25px)", lineHeight: 1.25, letterSpacing: "-.02em" }}>Weekly parties <span style={{ color: "#0E7C68" }}>in</span> neighbourhood</h3>
                  <p style={{ color: "#5C6B67", fontSize: 15, lineHeight: 1.55, marginTop: 12 }}>Exclusively for movEazy Generation. New city, new people, new stories.</p>
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}><span data-step-node style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid rgba(14,124,104,.3)", background: "#F4F2ED", color: "#0E7C68", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>4</span></div>
                <div data-step-media style={{ borderRadius: 18, overflow: "hidden", background: "#150C22", boxShadow: "0 22px 50px rgba(0,0,0,.14)", position: "relative", aspectRatio: "16/11" }}>
                  <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${sofaImg})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                  <span style={{ position: "absolute", top: 16, right: 16, width: 34, height: 34, borderRadius: "50%", background: "#F4F2ED", color: "#0E7C68", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>4</span>
                  <span style={{ position: "absolute", bottom: 16, left: 16, width: 46, height: 46, borderRadius: "50%", background: "rgba(21,12,34,.72)", border: "1px solid rgba(94,234,212,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5EEAD4" strokeWidth="1.6"><path d="M3 21l6.5-13L21 19.5 3 21z" strokeLinejoin="round" /><path d="M14 4.5v.01M18.5 8v.01M20.5 3.5v.01" strokeLinecap="round" /></svg>
                  </span>
                </div>
              </div>

              <div data-step className="mzn-tl-step" style={{ display: "grid", gridTemplateColumns: "1fr 76px 1fr", alignItems: "center" }}>
                <div data-step-media style={{ borderRadius: 18, overflow: "hidden", background: "#0C1A18", boxShadow: "0 22px 50px rgba(0,0,0,.14)", position: "relative", aspectRatio: "16/11" }}>
                  <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${timelinePhoneImg})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                  <span style={{ position: "absolute", top: 16, left: 16, width: 34, height: 34, borderRadius: "50%", background: "#F4F2ED", color: "#0E7C68", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>5</span>
                  <span style={{ position: "absolute", bottom: 16, left: 16, width: 46, height: 46, borderRadius: "50%", background: "rgba(4,33,29,.72)", border: "1px solid rgba(94,234,212,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5EEAD4" strokeWidth="1.6"><path d="M7 4h9M7 8.4h9M13.5 4c2.4 0 3.6 1.6 3.6 3.4 0 2.2-1.7 3.6-4.4 3.6H7.6l7.6 9" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}><span data-step-node style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid rgba(14,124,104,.3)", background: "#F4F2ED", color: "#0E7C68", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>5</span></div>
                <div data-step-text style={{ background: "#fff", border: "1px solid rgba(0,0,0,.07)", borderRadius: 18, padding: "clamp(22px,2.4vw,32px)" }}>
                  <h3 style={{ fontFamily: "'Manrope', sans-serif", color: "#0B1A17", fontWeight: 800, fontSize: "clamp(19px,1.9vw,25px)", lineHeight: 1.25, letterSpacing: "-.02em" }}>Easy monthly rent payment on <span style={{ color: "#0E7C68" }}>autopay</span></h3>
                  <p style={{ color: "#5C6B67", fontSize: 15, lineHeight: 1.55, marginTop: 12 }}>Set it once and relax. Never miss a rent payment again.</p>
                </div>
              </div>

              <div data-step className="mzn-tl-step" style={{ display: "grid", gridTemplateColumns: "1fr 76px 1fr", alignItems: "center" }}>
                <div data-step-text style={{ background: "#fff", border: "1px solid rgba(0,0,0,.07)", borderRadius: 18, padding: "clamp(22px,2.4vw,32px)" }}>
                  <h3 style={{ fontFamily: "'Manrope', sans-serif", color: "#0B1A17", fontWeight: 800, fontSize: "clamp(19px,1.9vw,25px)", lineHeight: 1.25, letterSpacing: "-.02em" }}>Our partners <span style={{ color: "#0E7C68" }}>furnish</span> the house according to your demand</h3>
                  <p style={{ color: "#5C6B67", fontSize: 15, lineHeight: 1.55, marginTop: 12 }}>From a work corner to a party-ready living room, you ask, we deliver.</p>
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}><span data-step-node style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid rgba(14,124,104,.3)", background: "#F4F2ED", color: "#0E7C68", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>6</span></div>
                <div data-step-media style={{ borderRadius: 18, overflow: "hidden", background: "#150C22", boxShadow: "0 22px 50px rgba(0,0,0,.14)", position: "relative", aspectRatio: "16/11" }}>
                  <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${livingRoomImg})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                  <span style={{ position: "absolute", top: 16, right: 16, width: 34, height: 34, borderRadius: "50%", background: "#F4F2ED", color: "#0E7C68", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>6</span>
                  <span style={{ position: "absolute", bottom: 16, left: 16, width: 46, height: 46, borderRadius: "50%", background: "rgba(21,12,34,.72)", border: "1px solid rgba(94,234,212,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5EEAD4" strokeWidth="1.6"><path d="M4 13v5h16v-5M5.5 13V9a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v4M3 13h18" strokeLinejoin="round" /></svg>
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAND ── */}
      <section style={{ background: "#5EEAD4", color: "#04211D", padding: "clamp(56px,8vh,100px) clamp(20px,4vw,60px)" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "40px 28px" }}>
          {[
            { h: "1 Day", body: "to finalize a home, not a month" },
            { h: "1 Agent", body: "personalized, to guide you everything in and around the city" },
            { h: "Auto-Pay", body: "rent on autopay and no manual hassle" },
            { h: "Your vibe", body: "personalized furnishing touch based on your vibe" },
          ].map((s) => (
            <div data-reveal key={s.h}>
              <div style={{ fontWeight: 800, fontSize: "clamp(36px,4.6vw,66px)", lineHeight: 0.94, letterSpacing: "-.035em" }}>{s.h}</div>
              <div style={{ fontWeight: 600, fontSize: 16, marginTop: 12, color: "#0B4A40", lineHeight: 1.4 }}>{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section id="start" style={{ position: "relative", background: "#04211D", padding: "clamp(100px,17vh,200px) clamp(20px,4vw,60px)", textAlign: "center", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(80% 70% at 50% 20%, rgba(94,234,212,.16), transparent 60%)", zIndex: 0 }} />
        <div data-reveal style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto" }}>
          <div style={{ fontFamily: "'Caveat'", fontSize: "clamp(24px,2.4vw,32px)", color: "#E8A33D", marginBottom: 10 }}>Your adventure begins here</div>
          <h2 style={{ fontFamily: "'Manrope', sans-serif", color: "#F1F6F4", fontWeight: 800, fontSize: "clamp(38px,7.4vw,112px)", lineHeight: 0.96, letterSpacing: "-.035em" }}>Your move<br />starts here.</h2>
          <p style={{ color: "#9FB5B0", fontSize: "clamp(17px,1.6vw,21px)", margin: "26px auto 0", maxWidth: 560 }}>Whether you're listing a flat or looking for one, tell us where you're headed and we'll take it from there.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", marginTop: 38 }}>
            <a href="#" onClick={(e) => { e.preventDefault(); startFlatSearch(); }} style={{ background: "#5EEAD4", color: "#04211D", fontWeight: 700, fontSize: 18, padding: "18px 36px", borderRadius: 100 }}>Start your move</a>
            <a href="#" onClick={(e) => { e.preventDefault(); listMyFlat(); }} style={{ border: "1px solid rgba(255,255,255,.22)", color: "#F1F6F4", fontWeight: 600, fontSize: 18, padding: "18px 36px", borderRadius: 100 }}>List your flat</a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="mzn-footer" style={{ background: "#031916", borderTop: "1px solid rgba(255,255,255,.08)", padding: "44px clamp(20px,4vw,60px)", display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>mov<span style={{ color: "#5EEAD4" }}>EAZY</span></div>
        <div style={{ color: "#6a8b84", fontSize: 14 }}>Redefining how people move into new cities.</div>
        <div style={{ display: "flex", gap: 22 }}>
          <a href="#" onClick={(e) => { e.preventDefault(); startFlatSearch(); }} style={{ color: "#9FB5B0", fontSize: 14 }}>Find a home</a>
          <a href="#" onClick={(e) => { e.preventDefault(); listMyFlat(); }} style={{ color: "#9FB5B0", fontSize: 14 }}>List a flat</a>
          <Link to="/how-it-works" style={{ color: "#9FB5B0", fontSize: 14 }}>How it works</Link>
        </div>
      </footer>

      {/* ── "How do you want to search?" choice popup (app flow, recoloured to the new palette) ── */}
      <style>{`
        .mzn-choice-card { position: relative; width: 100%; max-width: 640px; background: #fff; border-radius: 28px; padding: clamp(28px,4vw,44px); box-shadow: 0 24px 60px rgba(0,15,21,0.24); font-family: 'Manrope', sans-serif; }
        .mzn-choice-close { position: absolute; top: 16px; right: 16px; width: 34px; height: 34px; border-radius: 50%; border: 1px solid #D5D8DA; background: #fff; color: #6C7A77; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 18px; }
        .mzn-choice-eyebrow { font-size: 11.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #0E7C68; margin-bottom: 10px; }
        .mzn-choice-title { font-size: clamp(22px,3vw,28px); font-weight: 800; color: #0B1A17; margin: 0 0 8px; }
        .mzn-choice-sub { font-size: 13.5px; color: #6C7A77; margin: 0 0 26px; }
        .mzn-choice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .mzn-choice-opt { position: relative; text-align: left; border-radius: 20px; padding: 22px 20px; cursor: pointer; font-family: inherit; display: flex; flex-direction: column; gap: 10px; transition: transform 0.15s ease, box-shadow 0.15s ease; border: none; }
        .mzn-choice-opt:hover { transform: translateY(-3px); }
        .mzn-choice-opt-plain { background: #fff; border: 1.5px solid #D5D8DA; color: #0B1A17; }
        .mzn-choice-opt-plain:hover { border-color: #6C7A77; }
        .mzn-choice-opt-hero { background: linear-gradient(155deg, #0E7C68 0%, #031916 100%); border: 1.5px solid transparent; color: #F1F6F4; box-shadow: 0 12px 32px rgba(0,15,21,0.16); transform: scale(1.03); }
        .mzn-choice-opt-hero:hover { transform: scale(1.03) translateY(-3px); }
        .mzn-choice-badge { position: absolute; top: -11px; right: 16px; background: #5EEAD4; color: #04211D; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 5px 12px; border-radius: 999px; box-shadow: 0 4px 10px rgba(0,0,0,0.25); }
        .mzn-choice-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .mzn-choice-opt-plain .mzn-choice-icon { background: #E4FBF6; color: #0E7C68; }
        .mzn-choice-opt-hero .mzn-choice-icon { background: rgba(255,255,255,0.2); color: #F1F6F4; }
        .mzn-choice-opt-title { font-size: 17px; font-weight: 700; }
        .mzn-choice-opt-body { font-size: 12.5px; line-height: 1.55; }
        .mzn-choice-opt-plain .mzn-choice-opt-body { color: #6C7A77; }
        .mzn-choice-opt-hero .mzn-choice-opt-body { color: rgba(255,255,255,0.9); }
        .mzn-choice-opt-cta { margin-top: 4px; font-size: 12.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
        .mzn-choice-opt-plain .mzn-choice-opt-cta { color: #0E7C68; }
        .mzn-choice-opt-hero .mzn-choice-opt-cta { color: #F1F6F4; }
        @media (max-width: 640px) {
          .mzn-choice-grid { grid-template-columns: 1fr; }
          .mzn-choice-opt-hero { transform: none; }
          .mzn-choice-opt-hero:hover { transform: translateY(-3px); }
        }
      `}</style>
      <AnimatePresence>
        {showChoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowChoice(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(4,33,29,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 18 }}
              transition={{ duration: 0.22, ease: CHOICE_EASE }}
              className="mzn-choice-card"
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" className="mzn-choice-close" onClick={() => setShowChoice(false)} aria-label="Close">&times;</button>
              <div className="mzn-choice-eyebrow">Find your next home</div>
              <h2 className="mzn-choice-title">How do you want to search?</h2>
              <p className="mzn-choice-sub">Pick whichever fits how you like to look for a place.</p>

              <div className="mzn-choice-grid">
                <button type="button" className="mzn-choice-opt mzn-choice-opt-plain" onClick={chooseMap}>
                  <span className="mzn-choice-icon"><MapPinIcon /></span>
                  <span className="mzn-choice-opt-title">Explore map-based listings</span>
                  <span className="mzn-choice-opt-body">Browse verified flats on a live map and filter by area yourself.</span>
                  <span className="mzn-choice-opt-cta">Open map <ArrowIcon /></span>
                </button>

                <button type="button" className="mzn-choice-opt mzn-choice-opt-hero" onClick={chooseAgent}>
                  <span className="mzn-choice-badge">Recommended</span>
                  <span className="mzn-choice-icon"><SparkleIcon /></span>
                  <span className="mzn-choice-opt-title">Get my free online agent</span>
                  <span className="mzn-choice-opt-body">Answer a few quick questions and let our AI match you to the best verified homes — free.</span>
                  <span className="mzn-choice-opt-cta">Start free <ArrowIcon /></span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile bottom action bar — the three primary entry points ── */}
      <nav className="mzn-bottombar" aria-label="Primary actions">
        <button type="button" onClick={startFlatSearch}>
          <FlatIcon />
          <span>Find My Flat</span>
        </button>
        <button type="button" onClick={registerOwner}>
          <OwnerIcon />
          <span>List as Owner</span>
        </button>
        <button type="button" onClick={() => navigate("/register-broker")}>
          <BrokerIcon />
          <span>Register as Broker</span>
        </button>
      </nav>

      {/* ── AI Broker consultant ── */}
      <AIBroker open={showChatbot} onClose={() => setShowChatbot(false)} />
    </div>
  );
}
