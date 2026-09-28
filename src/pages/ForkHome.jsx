/**
 * The "/" landing page — India's first speed-renting platform.
 *
 * Screens first, few words, the same principles as the partner and owner
 * landing pages: every phone is the tenant app (the matches are the app's own
 * SwipeDeck and scoring engine over real published inventory — see
 * home/homeScreens.jsx). Three scroll scenes carry the story:
 *
 *   story   the old way of renting, lit word by word as you scroll;
 *   line    "movEazy brings India's first speed-renting platform", letter by letter;
 *   how     four steps of speed renting beside one phone that changes with them.
 *
 * The buttons run the app's real flows, unchanged from before: "Find my home"
 * asks for a number (or not, for a signed-in or known visitor), then opens the
 * AI broker, or goes straight to saved matches; "List my flat" is auth-gated.
 */
import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, CalendarCheck, ClipboardList, Globe, Home, Megaphone, MessageCircle, ShieldCheck, Sparkles, UserRound, Zap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLoginModal } from "../context/LoginModalContext";
import AIBroker from "../components/AIBroker";
import RequirePhoneFirst from "../components/RequirePhoneFirst";
import MovEazyNav from "../components/layout/MovEazyNav";
import { fetchUserRequirement } from "../lib/userRequirements";
import { hasLeadPhone } from "../lib/leadIntake";
import { useLandingSettings } from "../lib/landingSettings";
import { LandingStyles } from "./landing/landingKit";
import { HighlightScene, Phone, SITE_CSS, SiteFooter, clamp, ease, reduced, useScrollScene } from "./home/homeKit";
import { PerfectHomeScreen, SwipeScreen, useSteps } from "./home/homeScreens";
import logoOnDark from "../assets/logo/moveazy-logo-mint-dark.png";

/* ── copy: kept to the bone ─────────────────────────────────────────────── */
const STORY = [
  "You scroll through 100s of listings across a dozen websites.",
  "You call 10+ agents, hoping someone gets what you want.",
  "And they always say:",
  "“Bhaiya, aap visit karlo… main aur flats dikhaata hoon.”",
  "Renting shouldn’t run like it’s 1990.",
];
// The first "word" is the logo itself; the last two carry the promise, in gold.
const LINE = [["brings"], ["India’s"], ["first"], ["Speed‑Renting", true], ["Platform.", true]];
const SOURCES = [
  [MessageCircle, "WhatsApp groups"], [UserRound, "Offline brokers"], [Globe, "Rental platforms"],
  [Megaphone, "Social media posts"], [ClipboardList, "Society notice boards"], [Home, "Owners’ own listings"],
];

function LineScene() {
  const ref = useRef(null);
  const letters = useRef([]);
  useScrollScene(ref, (p) => {
    const ls = letters.current;
    const lit = reduced() ? ls.length + 8 : clamp(p / 0.7) * (ls.length + 8) - 4;
    ls.forEach((l, i) => {
      if (!l) return;
      const t = ease(clamp(lit - i));
      l.style.opacity = t;
      l.style.transform = `translateY(${(1 - t) * 46}px) rotateX(${(1 - t) * -72}deg) scale(${0.86 + 0.14 * t})`;
    });
  });
  let n = 1;
  return (
    <section ref={ref} className="th-line">
      <div className="th-sticky th-line-in">
        <h2 className="th-line-h">
          <span className="th-line-w th-line-logo">
            <img ref={(el) => { letters.current[0] = el; }} className="th-l" src={logoOnDark} alt="movEazy" />
          </span>{" "}
          {LINE.map(([w, accent], wi) => (
            <Fragment key={wi}>
              <span className={`th-line-w${accent ? " accent" : ""}`}>
                {[...w].map((ch, ci) => { const i = n++; return <span key={ci} ref={(el) => { letters.current[i] = el; }} className="th-l">{ch}</span>; })}
              </span>
              {wi < LINE.length - 1 ? " " : ""}
            </Fragment>
          ))}
        </h2>
      </div>
    </section>
  );
}

function HowScene({ steps }) {
  const ref = useRef(null);
  const [active, setActive] = useState(0);
  useScrollScene(ref, (p) => setActive((a) => { const n = Math.min(steps.length - 1, Math.floor(p * steps.length * 0.999)); return n === a ? a : n; }));
  return (
    <section ref={ref} className="th-how" id="how" style={{ height: `${steps.length * 90 + 60}vh` }}>
      <div className="th-sticky th-how-in">
        <div className="th-wrap th-how-grid">
          <div>
            <p className="th-kicker">Speed renting</p>
            <h2 className="th-h2">{steps.length} steps. <span>1 day.</span></h2>
            <ol className="th-steps">
              {steps.map((s, i) => (
                <li key={s.k} className={i === active ? "on" : i < active ? "done" : ""}>
                  <span className="th-step-n">{i + 1}</span>
                  <span><b>{s.title}</b><em>{s.sub}</em></span>
                </li>
              ))}
            </ol>
          </div>
          <div className="th-how-stage">
            <Phone className="th-phone--how">
              {steps.map((s, i) => (
                <div key={s.k} className={`th-screen${i === active ? " on" : ""}`}>{s.screen}</div>
              ))}
            </Phone>
            <div className="th-how-cap"><b>{steps[active].title}</b><span>{steps[active].sub}</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ForkHome() {
  const { user, loading: authLoading } = useAuth();
  const { openLogin } = useLoginModal();
  const navigate = useNavigate();
  const [showChatbot, setShowChatbot] = useState(false);
  const [showPhoneGate, setShowPhoneGate] = useState(false);
  const [checkingPrefs, setCheckingPrefs] = useState(false);
  const [pendingMatchCheck, setPendingMatchCheck] = useState(false);
  const settings = useLandingSettings();
  const { steps, matches } = useSteps();

  // "List my Flat" — auth-gate, then open the inventory listing form.
  // Wait out the persisted-session restore before deciding: without this, a
  // signed-in visitor who clicks right after page load can see a false
  // "please sign in" prompt while their real session is still loading.
    const listMyFlat = () => { if (authLoading) return; user ? navigate("/list-my-flat") : openLogin(() => navigate("/list-my-flat")); };

  // Deep link from the post-publish "Find my next flat" pitch → open the agent.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("find") !== "1" || authLoading) return;
    setSearchParams({}, { replace: true });
    // Same rule as startFlatSearch: the agent opens for anyone, signed in or
    // not; only the number is asked for first.
    if (user || hasLeadPhone()) setShowChatbot(true);
    else setShowPhoneGate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user, authLoading]);

  // "Show me flats" — gate on sign-in first. A returning user who has already set
  // their preferences skips the map-vs-agent choice entirely and goes straight to
  // their best-matched homes; only a first-timer (no saved requirement) sees the
  // choice between browsing the map or talking to the AI broker.
  const goToMatches = async (uid) => {
    setCheckingPrefs(true);
    try {
      const saved = await fetchUserRequirement(uid);
      if (saved) {
        // Their five best matches; the screen itself decides whether that is a
        // fresh swipe or the "sit back and relax" hand-off.
        navigate("/matches", { state: { prefs: saved } });
      } else {
        // First-timer, no saved requirement yet — straight into the AI agent
        // chat. The choice modal (below) is kept but no longer triggered from
        // here; nothing else in the app opens it.
        setShowChatbot(true);
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

  /**
   * "Show me flats" — the click that used to raise a Google popup.
   *
   * It no longer asks anyone to sign up. A signed-out visitor gives a mobile
   * number, answers the questionnaire, and only then meets the gate. Everything
   * they say in between is kept against the browser (lib/leadIntake.js), so a
   * refusal at the gate still leaves the team a named lead with a number and a
   * full brief — which is exactly what the Google wall was throwing away.
   */
  const startFlatSearch = () => {
    if (checkingPrefs || authLoading) return;
    if (user) {
      goToMatches(user.uid);
    } else if (hasLeadPhone()) {
      setShowChatbot(true);
    } else {
      setShowPhoneGate(true);
    }
  };

  // The shared nav's "Start your move" / "Find My Flat" on other pages routes
  // here as `/?search=1`, so every entry point runs this one flow rather than
  // each page reimplementing the preferences check.
  useEffect(() => {
    // Also wait out authLoading here — otherwise this effect would consume the
    // ?search=1 param immediately (even while auth is still resolving), then
    // startFlatSearch()'s own guard would no-op and the param is already gone,
    // silently dropping the deep link instead of just delaying it.
    if (searchParams.get("search") !== "1" || authLoading) return;
    setSearchParams({}, { replace: true });
    startFlatSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user, authLoading]);

  const find = (e) => { e?.preventDefault?.(); startFlatSearch(); };
  const list = (e) => { e?.preventDefault?.(); listMyFlat(); };
  const top = matches[0];

  return (
    <div className="lp lp--tenant th">
      <LandingStyles />
      <style>{SITE_CSS + CSS}</style>
      <MovEazyNav active="home" transparentAtTop onFindFlat={startFlatSearch} />

      {/* ── HERO ── */}
      <header className="th-hero">
        <div className="th-wrap th-hero-grid">
          <div className="th-hero-copy">
            <span className="th-pill"><Zap size={14} fill="currentColor" /> India’s first Speed-Renting Platform</span>
            <h1 className="th-h1">Your next home.<br /><span>Found in a day.</span></h1>
            <p className="th-lead">Tell us once. We rank every verified flat, book the visit, you move in.</p>
            <div className="th-ctas">
              <button type="button" className="th-btn th-btn--mint" onClick={find} disabled={checkingPrefs}>
                {checkingPrefs ? "Finding your matches…" : "Find my home"} <ArrowRight size={18} />
              </button>
              <button type="button" className="th-btn th-btn--ghost" onClick={list}>List my flat</button>
            </div>
            <ul className="th-checks"><li>Verified homes</li><li>Same-day visits</li><li>Deposit protection</li></ul>
          </div>
          <div className="th-hero-stage">
            <Phone className="th-phone--hero"><SwipeScreen matches={matches} /></Phone>
            <div className="th-float" style={{ top: 64, left: -34 }}>
              <span className="ic"><Sparkles size={17} /></span><span><b>{top ? `${top.matchScore}%` : "Top"}</b>match</span>
            </div>
            <div className="th-float" style={{ top: 300, right: -40 }}>
              <span className="ic"><CalendarCheck size={17} /></span><span><b>Today, 4 PM</b>Visit booked</span>
            </div>
            <div className="th-float" style={{ bottom: 70, left: -28 }}>
              <span className="ic"><ShieldCheck size={17} /></span><span><b>Protected</b>Deposit</span>
            </div>
          </div>
        </div>
      </header>

      <div className="th-wrap">
        <div className="th-proof">
          {[["100+", "Happy movers"], [settings.statProperties, "Verified homes"], ["1 day", "To finalise"]].map(([v, l]) => (
            <div key={l}><b>{v}</b><span>{l}</span></div>
          ))}
        </div>
      </div>

      <HighlightScene kicker="The old way of renting" lines={STORY} big={3} />
      <LineScene />
      <HowScene steps={steps} />

      {/* ── NUMBERS ── */}
      <section className="th-nums">
        <div className="th-wrap th-nums-grid">
          {[["1 Day", "to finalise a home"], ["1 Agent", "for everything, start to end"], ["Auto-Pay", "rent, no manual hassle"], ["Your vibe", "furnishing, your way"]].map(([h, b]) => (
            <div key={h}><b>{h}</b><span>{b}</span></div>
          ))}
        </div>
      </section>

      {/* ── THE FRAGMENTED MARKET, SORTED ── */}
      <section className="th-frag">
        <div className="th-wrap">
          <div className="th-frag-head">
            <p className="th-kicker">No more hunting</p>
            <h2 className="th-h2">Scattered everywhere.<br /><span>Sorted for you.</span></h2>
            <p className="th-frag-sub">We take the search across a fragmented market off your hands — on our way to a perfect home at your fingertips.</p>
          </div>
          <div className="th-frag-stage">
            <ul className="th-frag-src">
              {SOURCES.map(([I, t], i) => (
                <li key={t} style={{ animationDelay: `${-i * 0.9}s` }}><span className="ic"><I size={17} /></span>{t}</li>
              ))}
            </ul>
            <div className="th-frag-link" aria-hidden>
              <svg viewBox="0 0 300 480" preserveAspectRatio="none">
                {SOURCES.map((_, i) => {
                  const y = 40 + i * 80;
                  return <path key={i} d={`M0 ${y} C 140 ${y}, 150 240, 250 240`} />;
                })}
                <path className="out" d="M250 240 L300 240" />
              </svg>
              <span className="th-frag-orb"><img src={logoOnDark} alt="" /><em>AI agents</em></span>
            </div>
            <div className="th-frag-phone">
              <Phone className="th-phone--frag"><PerfectHomeScreen listing={top} /></Phone>
            </div>
          </div>
        </div>
      </section>

      {/* ── TWO MORE DOORS ── */}
      <section className="th-doors">
        <div className="th-wrap th-doors-grid">
          <a href="#" onClick={list} className="th-door">
            <span><em>Own a flat?</em><b>List it free</b></span><ArrowRight size={22} />
          </a>
          <a href="https://partners.moveazy.co.in/" className="th-door">
            <span><em>A broker?</em><b>Join MovEazy Partners</b></span><ArrowRight size={22} />
          </a>
        </div>
      </section>

      {/* ── FINAL ── */}
      <section className="th-final">
        <div className="th-wrap">
          <h2 className="th-final-h">Your move<br /><span>starts here.</span></h2>
          <button type="button" className="th-btn th-btn--mint th-btn--lg" onClick={find}>Find my home <ArrowRight size={20} /></button>
          <p className="th-final-note"><BadgeCheck size={15} /> Free · takes 2 minutes</p>
        </div>
      </section>

      <SiteFooter onFind={find} onList={list} />

      <RequirePhoneFirst
        open={showPhoneGate}
        onClose={() => setShowPhoneGate(false)}
        onDone={() => { setShowPhoneGate(false); setShowChatbot(true); }}
      />
      <AIBroker open={showChatbot} onClose={() => setShowChatbot(false)} />
    </div>
  );
}

const CSS = `

/* hero */
.th-hero { position: relative; overflow: hidden; color: #F1F6F4;
  background: radial-gradient(90% 80% at 80% 20%, #0B463D 0%, #052723 45%, #04211D 100%); }
.th-hero::after { content: ""; position: absolute; inset: auto -10% -40% 40%; height: 70%; background: radial-gradient(closest-side, rgba(94,234,212,.18), transparent); pointer-events: none; }
.th-hero-grid { display: grid; grid-template-columns: 1.05fr .95fr; gap: 40px; align-items: center; padding-top: 128px; padding-bottom: 92px; position: relative; z-index: 1; }
.th-pill { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #5EEAD4; padding: 8px 14px; border-radius: 999px;
  background: rgba(94,234,212,.08); border: 1px solid rgba(94,234,212,.3); }
.th-h1 { font-size: clamp(44px, 6.4vw, 84px); line-height: 1; letter-spacing: -.045em; font-weight: 800; margin: 22px 0 20px; color: #F1F6F4; }
.th-h1 span { color: #5EEAD4; }
.th-lead { font-size: clamp(17px, 1.5vw, 20px); line-height: 1.5; color: #A9C2BC; max-width: 470px; margin: 0 0 30px; }
.th-ctas { display: flex; flex-wrap: wrap; gap: 12px; }
.th-checks { display: flex; flex-wrap: wrap; gap: 10px 20px; margin: 30px 0 0; padding: 0; list-style: none; font-size: 14.5px; font-weight: 600; color: #CFE1DC; }
.th-checks li { display: flex; align-items: center; gap: 8px; }
.th-checks li::before { content: "✓"; width: 20px; height: 20px; border-radius: 99px; display: grid; place-items: center; font-size: 11px; background: rgba(94,234,212,.16); color: #5EEAD4; }
.th-hero-stage { position: relative; display: flex; justify-content: center; }
.th-float { position: absolute; z-index: 4; display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,.97); color: #0B1A17; border-radius: 16px;
  padding: 11px 14px; font-size: 12.5px; font-weight: 600; box-shadow: 0 22px 44px rgba(0,0,0,.28); animation: thFloat 6s ease-in-out infinite; }
.th-float:nth-of-type(3) { animation-delay: -2s; } .th-float:nth-of-type(4) { animation-delay: -4s; }
.th-float b { display: block; font-size: 16px; letter-spacing: -.01em; }
.th-float .ic { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background: #E4F6F1; color: #0E7C68; }
@keyframes thFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }

/* phones: a real 375px screen, scaled */
.th-phone--hero { --s: .8; }
.th-phone--how { --s: .8; }

/* proof */
.th-proof { display: grid; grid-template-columns: repeat(3, 1fr); background: #fff; border-radius: 22px; border: 1px solid var(--line); margin-top: -40px;
  position: relative; z-index: 5; box-shadow: 0 24px 50px rgba(4,33,29,.1); }
.th-proof > div { padding: 22px; text-align: center; }
.th-proof > div + div { border-left: 1px solid var(--line); }
.th-proof b { display: block; font-size: clamp(26px, 3vw, 36px); letter-spacing: -.03em; color: #04211D; }
.th-proof span { font-size: 13px; color: var(--dim); font-weight: 600; }


/* line */
.th-line { height: 190vh; background: #04211D; color: #F1F6F4; }
.th-line-in { display: flex; align-items: center; justify-content: center; padding: 0 24px;
  background: radial-gradient(110% 90% at 50% 40%, #0A3A33 0%, #04211D 60%); }
.th-line-h { max-width: 1150px; text-align: center; font-weight: 800; font-size: clamp(38px, 6.6vw, 104px); line-height: 1.12; letter-spacing: -.04em; color: #F1F6F4; perspective: 900px; margin: 0; }
.th-line-w { display: inline-block; white-space: nowrap; }
.th-l { display: inline-block; will-change: transform, opacity; }
.th-line-w.accent .th-l { color: #F5C451; text-shadow: 0 0 44px rgba(245,196,81,.35); }
.th .th-line-logo img.th-l { height: 1.02em; width: auto; vertical-align: -.16em; }

/* how */
.th-how { background: var(--cream); }
.th-how-in { display: flex; align-items: center; padding-top: 64px; }
.th-how-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; width: 100%; }
.th-steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.th-steps li { display: flex; gap: 16px; align-items: center; padding: 14px 18px; border-radius: 18px; transition: background .3s, box-shadow .3s; }
.th-steps li b { display: block; font-size: clamp(20px, 2.1vw, 28px); letter-spacing: -.025em; color: #B5C2BE; transition: color .3s; }
.th-steps li em { display: block; font-style: normal; font-size: 15px; color: #B5C2BE; margin-top: 2px; transition: color .3s; }
.th-step-n { width: 38px; height: 38px; border-radius: 99px; flex: none; display: grid; place-items: center; font-weight: 800; font-size: 15px;
  border: 1.5px solid #CFD8D5; color: #9DAAA6; transition: all .3s; }
.th-steps li.done b, .th-steps li.done em { color: #7D8D89; }
.th-steps li.done .th-step-n { background: #E4F6F1; border-color: #E4F6F1; color: var(--acc); }
.th-steps li.on { background: #fff; box-shadow: 0 16px 36px rgba(4,33,29,.08); }
.th-steps li.on b { color: #04211D; } .th-steps li.on em { color: var(--dim); }
.th-steps li.on .th-step-n { background: #04211D; border-color: #04211D; color: #5EEAD4; }
.th-how-stage { display: flex; flex-direction: column; align-items: center; gap: 18px; }
.th-how-cap { display: none; text-align: center; }
.th-how-cap b { display: block; font-size: 22px; letter-spacing: -.02em; color: #04211D; }
.th-how-cap span { font-size: 14.5px; color: var(--dim); }

/* fragmented market */
.th-frag { background: #04211D; color: #F1F6F4; padding: 120px 0; overflow: hidden; }
.th-frag .th-h2 { color: #F1F6F4; }
.th-frag .th-h2 span { color: #F5C451; }
.th-frag .th-kicker { color: #5EEAD4; }
.th-frag-head { text-align: center; max-width: 760px; margin: 0 auto 60px; }
.th-frag-sub { font-size: clamp(17px, 1.6vw, 20px); line-height: 1.55; color: #A9C2BC; margin: -14px auto 0; max-width: 620px; }
.th-frag-stage { display: grid; grid-template-columns: 260px 1fr 300px; align-items: center; gap: 0; }
.th-frag-src { list-style: none; margin: 0; padding: 0; display: grid; gap: 26px; }
.th-frag-src li { display: flex; align-items: center; gap: 12px; height: 54px; padding: 0 16px; border-radius: 16px; font-weight: 700; font-size: 15px;
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); color: #CFE1DC; animation: thDrift 7s ease-in-out infinite; }
.th-frag-src .ic { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: rgba(94,234,212,.1); color: #5EEAD4; flex: none; }
@keyframes thDrift { 0%, 100% { transform: translateX(0) rotate(-.6deg); } 50% { transform: translateX(8px) rotate(.6deg); } }
.th-frag-link { position: relative; height: 480px; }
.th-frag-link svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.th-frag-link path { fill: none; stroke: rgba(94,234,212,.45); stroke-width: 1.6; stroke-dasharray: 6 9; animation: thFlow 2.4s linear infinite; vector-effect: non-scaling-stroke; }
.th-frag-link path.out { stroke: #F5C451; stroke-width: 2.4; stroke-dasharray: none; }
@keyframes thFlow { to { stroke-dashoffset: -60; } }
.th-frag-orb { position: absolute; right: 16.67%; top: 50%; transform: translate(50%, -50%); width: 128px; height: 128px; border-radius: 99px;
  display: grid; place-items: center; align-content: center; gap: 6px; background: radial-gradient(circle at 30% 30%, #0E4B42, #04211D 70%);
  border: 1.5px solid rgba(94,234,212,.5); box-shadow: 0 0 0 10px rgba(94,234,212,.06), 0 0 80px rgba(94,234,212,.25); }
.th-frag-orb img { width: 96px; height: auto; }
.th-frag-orb em { font-style: normal; font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: #5EEAD4; }
.th-frag-phone { display: flex; justify-content: center; }
.th-phone--frag { --w: 280px; --h: 578px; --s: .693; }

/* numbers, doors, final */
.th-nums { background: #5EEAD4; color: #04211D; padding: 90px 0; }
.th-nums-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 28px; }
.th-nums b { display: block; font-size: clamp(38px, 4.6vw, 64px); line-height: .95; letter-spacing: -.04em; font-weight: 800; }
.th-nums span { display: block; font-size: 15.5px; font-weight: 700; color: #0B4A40; margin-top: 12px; }
.th-doors { background: var(--cream); padding: 80px 0; }
.th-doors-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.th-door { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 30px 32px; border-radius: 24px; background: #fff;
  border: 1px solid var(--line); color: #04211D; text-decoration: none; transition: transform .2s ease, box-shadow .2s ease; }
.th-door:hover { transform: translateY(-2px); box-shadow: 0 20px 40px rgba(4,33,29,.08); }
.th-door em { display: block; font-style: normal; font-size: 14.5px; color: var(--dim); font-weight: 600; }
.th-door b { display: block; font-size: clamp(21px, 2.2vw, 28px); letter-spacing: -.025em; margin-top: 2px; }
.th-door svg { flex: none; color: var(--acc); }
.th-final { background: radial-gradient(80% 70% at 50% 10%, rgba(94,234,212,.16), transparent 60%), #04211D; color: #F1F6F4; text-align: center; padding: 140px 0; }
.th-final-h { font-size: clamp(46px, 8vw, 116px); line-height: .95; letter-spacing: -.045em; font-weight: 800; margin: 0 0 40px; }
.th-final-h span { color: #5EEAD4; }
.th-final-note { margin: 18px 0 0; font-size: 14px; color: #8FB0A9; display: flex; justify-content: center; align-items: center; gap: 6px; }

@media (max-height: 780px) and (min-width: 1001px) { .th-phone--how { --w: 280px; --h: 578px; --s: .693; } }
@media (max-width: 1000px) {
  .th-hero-grid { grid-template-columns: 1fr; padding-top: 112px; padding-bottom: 80px; gap: 48px; }
  .th-float { display: none; }
  .th-how-grid { grid-template-columns: 1fr; gap: 0; }
  .th-how-grid > div:first-child { display: none; }
  .th-how-in { align-items: center; }
  .th-how-cap { display: block; }
  .th-how-in { padding-top: 56px; padding-bottom: 76px; }
  .th-phone--how { --w: 270px; --h: 560px; --s: .666; }
  .th-nums-grid { grid-template-columns: 1fr 1fr; row-gap: 40px; }
  .th-doors-grid { grid-template-columns: 1fr; }
  .th-frag { padding: 90px 0; }
  .th-frag-stage { grid-template-columns: 1fr; gap: 0; justify-items: center; }
  .th-frag-src { grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; }
  .th-frag-src li { height: auto; padding: 12px; font-size: 13.5px; animation: none; }
  .th-frag-link { height: 190px; width: 100%; }
  .th-frag-link svg { display: none; }
  .th-frag-link::before { content: ""; position: absolute; left: 50%; top: 0; bottom: 0; border-left: 2px dashed rgba(94,234,212,.45); }
  .th-frag-orb { right: 50%; }
}
@media (max-width: 520px) {
  .th-wrap { padding-left: 18px; padding-right: 18px; }
  .th-phone--hero { --w: 300px; --h: 620px; --s: .746; }
  .th-proof > div { padding: 16px 8px; }
  .th-proof span { font-size: 11.5px; }
  .th-btn { width: 100%; }
  .th-final { padding: 100px 0 120px; }
}
/* the AI agents' search screen */
.th-live { width: 8px; height: 8px; border-radius: 99px; background: #5EEAD4; box-shadow: 0 0 0 0 rgba(94,234,212,.6); animation: thLive 1.6s ease-out infinite; }
@keyframes thLive { to { box-shadow: 0 0 0 10px rgba(94,234,212,0); } }
.th-radar { position: absolute; left: 50%; top: 50%; width: 86px; height: 86px; transform: translate(-50%, -50%); }
.th-radar span { position: absolute; inset: 0; border-radius: 99px; border: 1.5px solid #5EEAD4; opacity: 0; animation: thRadar 2.7s ease-out infinite; }
.th-radar span:nth-child(2) { animation-delay: .9s; } .th-radar span:nth-child(3) { animation-delay: 1.8s; }
@keyframes thRadar { 0% { transform: scale(1); opacity: .55; } 100% { transform: scale(2.4); opacity: 0; } }
.th-bar { animation: thFill 2.2s cubic-bezier(.16,1,.3,1) both; transform-origin: 0 50%; }
@keyframes thFill { from { transform: scaleX(.08); } to { transform: scaleX(1); } }
@media (prefers-reduced-motion: reduce) { .th-float, .th-frag-src li, .th-frag-link path, .th-radar span, .th-live, .th-bar { animation: none; } }
`;
