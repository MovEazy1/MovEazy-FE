/**
 * "How MovEazy Works" — a scroll-driven, storytelling landing page.
 *
 * Not a Step 1/2/3 page. It's an interactive narrative: the reader *experiences*
 * the product (a real Like / Don't-Like engine, a living inventory ecosystem, a
 * scroll-linked timeline) rather than reading about it. Built with Framer Motion
 * (parallax, scroll reveals, spring physics) + hand-drawn inline SVG scenes so the
 * whole thing stays self-contained, on-brand, and fast — no stock art, no CDNs.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  motion,
  AnimatePresence,
  useScroll,
  useSpring,
  useTransform,
  useMotionValue,
  useInView,
} from "framer-motion";
import MovEazyNav from "../components/layout/MovEazyNav";
import AIBroker from "../components/AIBroker";
import { useAuth } from "../context/AuthContext";
import { useLoginModal } from "../context/LoginModalContext";

/* ── Art direction ─────────────────────────────────────────────────────────── */
const C = {
  ink: "#1C1A17",
  ink2: "#28241f",
  cream: "#FBF9F4",
  cream2: "#F3EEE4",
  coral: "#EF5A45",
  coralDeep: "#d8412b",
  gold: "#E0A83B",
  violet: "#7C6BF0",
  sage: "#3E9E86",
  line: "#E8E1D4",
  muted: "#8C8377",
};
const EASE = [0.22, 1, 0.36, 1];

/* ── Reusable motion primitives ────────────────────────────────────────────── */
function Reveal({ children, y = 30, delay = 0, className = "", style }) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.75, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Parallax layer that reads normalized pointer motion values (-1..1). */
function ParallaxLayer({ mx, my, depth = 20, children, style, className = "" }) {
  const x = useTransform(mx, (v) => v * depth);
  const y = useTransform(my, (v) => v * depth);
  return (
    <motion.div className={className} style={{ x, y, ...style }}>
      {children}
    </motion.div>
  );
}

/** Count from 0 → target once the element scrolls into view. */
function useCountUp(target, duration = 1500) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration]);
  return [ref, val];
}

/* ── Small SVG glyphs ──────────────────────────────────────────────────────── */
function HomeGlyph({ hue = C.coral, size = 46 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M8 22 24 9l16 13v16a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z" fill={hue} opacity="0.16" />
      <path d="M6 23 24 9l18 14" stroke={hue} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 24v14a2 2 0 0 0 2 2h22a2 2 0 0 0 2-2V24" stroke={hue} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="20" y="30" width="8" height="10" rx="1.5" fill={hue} />
    </svg>
  );
}

/* ── Section 1 · HERO ──────────────────────────────────────────────────────── */
function Hero({ onPrimary, onScrollToEngine }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 55, damping: 18 });
  const sy = useSpring(my, { stiffness: 55, damping: 18 });

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    my.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  const floatCards = [
    { hue: C.coral, name: "Indiranagar", meta: "2BHK · South-facing", d: 34, top: "6%", left: "6%", r: -8 },
    { hue: C.sage, name: "Koramangala", meta: "Studio · Balcony", d: 22, top: "44%", left: "0%", r: 6 },
    { hue: C.gold, name: "HSR Layout", meta: "3BHK · Gated", d: 48, top: "18%", left: "58%", r: 7 },
    { hue: C.violet, name: "Whitefield", meta: "1BHK · Pet friendly", d: 30, top: "60%", left: "52%", r: -6 },
  ];

  return (
    <section className="hiw-hero" onMouseMove={onMove} onMouseLeave={onLeave}>
      <div className="hiw-hero-blobs" aria-hidden>
        <ParallaxLayer mx={sx} my={sy} depth={-18} className="hiw-blob hiw-blob-a" />
        <ParallaxLayer mx={sx} my={sy} depth={26} className="hiw-blob hiw-blob-b" />
        <ParallaxLayer mx={sx} my={sy} depth={-30} className="hiw-blob hiw-blob-c" />
      </div>

      <div className="hiw-hero-grid">
        <div className="hiw-hero-copy">
          <Reveal>
            <span className="hiw-eyebrow">
              <span className="hiw-eyebrow-dot" /> How MovEazy works
            </span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="hiw-hero-h1">
              House hunting that <span className="hiw-grad">learns what you love.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="hiw-hero-sub">
              The more homes you explore, the smarter your recommendations become — until MovEazy
              shows only the homes you're highly likely to love.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="hiw-hero-cta">
              <button type="button" className="hiw-btn hiw-btn-primary" onClick={onPrimary}>
                Start finding my home
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" className="hiw-btn hiw-btn-ghost" onClick={onScrollToEngine}>
                See how it learns
              </button>
            </div>
          </Reveal>
          <Reveal delay={0.32}>
            <div className="hiw-hero-proof">
              <span><b>1 month</b> of searching</span>
              <span className="hiw-arrow">→</span>
              <span className="hiw-proof-hot"><b>a few days</b></span>
            </div>
          </Reveal>
        </div>

        <div className="hiw-hero-stage" aria-hidden>
          <ParallaxLayer mx={sx} my={sy} depth={-12} className="hiw-brain-halo" />
          {floatCards.map((c, i) => (
            <ParallaxLayer
              key={c.name}
              mx={sx}
              my={sy}
              depth={c.d}
              className="hiw-floatcard"
              style={{ top: c.top, left: c.left, rotate: c.r }}
            >
              <motion.div
                className="hiw-floatcard-inner"
                initial={{ opacity: 0, y: 24, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.12, duration: 0.7, ease: EASE }}
                whileHover={{ y: -8, rotate: 0 }}
              >
                <HomeGlyph hue={c.hue} />
                <div>
                  <div className="hiw-fc-name">{c.name}</div>
                  <div className="hiw-fc-meta">{c.meta}</div>
                </div>
                <div className="hiw-fc-heart" style={{ color: c.hue }}>♥</div>
              </motion.div>
            </ParallaxLayer>
          ))}
        </div>
      </div>

      <button type="button" className="hiw-scrollcue" onClick={onScrollToEngine} aria-label="Scroll">
        <span>Scroll</span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </section>
  );
}

/* ── Section 2 · WHY IT'S BROKEN ───────────────────────────────────────────── */
function BrokenStat({ value, suffix = "", prefix = "", label }) {
  const [ref, n] = useCountUp(value);
  return (
    <Reveal className="hiw-stat">
      <div ref={ref} className="hiw-stat-num">
        {prefix}
        {n}
        {suffix}
      </div>
      <div className="hiw-stat-label">{label}</div>
    </Reveal>
  );
}

function BrokenSection() {
  return (
    <section className="hiw-sec hiw-broken">
      <Reveal className="hiw-sec-head">
        <span className="hiw-kicker hiw-kicker-coral">The problem</span>
        <h2 className="hiw-h2">House hunting in India is quietly broken.</h2>
        <p className="hiw-lead">
          Scattered listings. The same flats on every site. Weekends gone. You do all the work and
          still settle.
        </p>
      </Reveal>

      <div className="hiw-stats">
        <BrokenStat value={6} prefix="3–" label="weekends lost to house hunting" />
        <BrokenStat value={50} prefix="20–" label="brokers called, chased, ghosted" />
        <BrokenStat value={30} suffix="+" label="homes visited across the city" />
        <BrokenStat value={1} suffix=" mo" label="average time to actually move in" />
      </div>

      <Reveal className="hiw-brokenscene" delay={0.1}>
        <ChaosCity />
      </Reveal>
    </section>
  );
}

function ChaosCity() {
  return (
    <svg viewBox="0 0 900 260" className="hiw-chaos" role="img" aria-label="A person crossing the city between scattered houses">
      <defs>
        <linearGradient id="hiw-road" x1="0" x2="1">
          <stop offset="0" stopColor={C.cream2} />
          <stop offset="1" stopColor="#e9e1d1" />
        </linearGradient>
      </defs>
      {/* scattered, disconnected houses */}
      {[
        [70, 70, C.muted, -6], [230, 40, C.muted, 5], [400, 90, C.muted, -3],
        [560, 45, C.muted, 8], [720, 80, C.muted, -5], [840, 50, C.muted, 4],
        [150, 150, C.muted, 3], [330, 175, C.muted, -7], [520, 155, C.muted, 6], [690, 175, C.muted, -4],
      ].map(([x, y, hue, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`} opacity="0.5">
          <HouseMini hue={hue} />
        </g>
      ))}
      {/* winding path */}
      <path
        d="M40 230 C 180 210, 180 120, 320 150 S 520 60, 640 130 S 820 120, 870 60"
        stroke={C.coral}
        strokeWidth="3"
        strokeDasharray="2 10"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      {/* tired traveller dot */}
      <circle r="7" fill={C.coral}>
        <animateMotion dur="6s" repeatCount="indefinite" path="M40 230 C 180 210, 180 120, 320 150 S 520 60, 640 130 S 820 120, 870 60" />
      </circle>
    </svg>
  );
}
function HouseMini({ hue }) {
  return (
    <g>
      <path d="M0 16 14 4l14 12" stroke={hue} strokeWidth="2.4" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M3 15v13h22V15" stroke={hue} strokeWidth="2.4" fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );
}

/* ── Section 3 · THE RECOMMENDATION ENGINE (interactive) ───────────────────── */
const DEMO_HOMES = [
  { id: 1, name: "Sunlit 2BHK", area: "Indiranagar", rent: "₹38,000", hue: C.coral, tags: ["South-facing", "Balcony", "Gated"] },
  { id: 2, name: "Cosy Studio", area: "Koramangala", rent: "₹22,000", hue: C.sage, tags: ["Furnished", "Pet friendly"] },
  { id: 3, name: "Airy 3BHK", area: "HSR Layout", rent: "₹52,000", hue: C.gold, tags: ["High floor", "Modular kitchen", "Gated"] },
  { id: 4, name: "Garden 1BHK", area: "Whitefield", rent: "₹19,000", hue: C.violet, tags: ["Ground floor", "Semi-furnished"] },
  { id: 5, name: "Skyline 2BHK", area: "Bellandur", rent: "₹41,000", hue: C.coral, tags: ["Lake view", "Balcony", "Amenities"] },
];
const PREFS = [
  "Locality", "Budget", "Sunlight", "Furnishing", "Kitchen style", "Balcony",
  "Gated society", "Pet friendly", "Commute", "Amenities", "Layout", "Floor", "Aesthetics",
];

function EngineSection({ innerRef }) {
  const [index, setIndex] = useState(0);
  const [signals, setSignals] = useState(0);
  const [flyDir, setFlyDir] = useState(1);

  const done = index >= DEMO_HOMES.length;
  const intensity = Math.min(1, signals / 6);
  const learned = Math.min(PREFS.length, signals * 2);
  const match = Math.min(96, 40 + signals * 8);

  const vote = (dir) => {
    if (done) return;
    setFlyDir(dir);
    setSignals((s) => s + 1);
    setIndex((i) => i + 1);
  };
  const reset = () => {
    setIndex(0);
    setSignals(0);
  };

  const stack = DEMO_HOMES.slice(index, index + 3);

  return (
    <section className="hiw-sec hiw-engine" ref={innerRef}>
      <Reveal className="hiw-sec-head">
        <span className="hiw-kicker hiw-kicker-violet">The engine</span>
        <h2 className="hiw-h2">
          It works like Netflix — <span className="hiw-grad-violet">for homes.</span>
        </h2>
        <p className="hiw-lead">
          Nobody knows your taste on day one. Every <b>Like</b> and <b>Don't like</b> trains the
          engine. Try it — swipe a few and watch it sharpen.
        </p>
      </Reveal>

      <div className="hiw-engine-stage">
        {/* left · the deck */}
        <div className="hiw-deck-wrap">
          <div className="hiw-deck">
            <AnimatePresence>
              {!done &&
                stack.map((home, i) => {
                  const top = i === 0;
                  return (
                    <motion.div
                      key={home.id}
                      className="hiw-card"
                      drag={top ? "x" : false}
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.7}
                      onDragEnd={(e, info) => {
                        if (info.offset.x > 110) vote(1);
                        else if (info.offset.x < -110) vote(-1);
                      }}
                      initial={{ scale: 0.92, y: 26, opacity: 0 }}
                      animate={{ scale: 1 - i * 0.05, y: i * 16, opacity: 1, zIndex: 10 - i }}
                      exit={{ x: flyDir * 460, y: -80, rotate: flyDir * 18, opacity: 0, transition: { duration: 0.45, ease: EASE } }}
                      transition={{ duration: 0.4, ease: EASE }}
                      whileDrag={{ rotate: 0 }}
                      style={{ cursor: top ? "grab" : "default" }}
                    >
                      <div className="hiw-card-photo" style={{ background: `linear-gradient(135deg, ${home.hue}26, ${home.hue}0d)` }}>
                        <HomeGlyph hue={home.hue} size={62} />
                        <span className="hiw-card-rent">{home.rent}/mo</span>
                      </div>
                      <div className="hiw-card-body">
                        <div className="hiw-card-title">{home.name}</div>
                        <div className="hiw-card-area">
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={C.muted} strokeWidth="2" aria-hidden>
                            <path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z" strokeLinejoin="round" />
                            <circle cx="12" cy="10" r="2.4" />
                          </svg>
                          {home.area}
                        </div>
                        <div className="hiw-card-tags">
                          {home.tags.map((t) => (
                            <span key={t} className="hiw-tag" style={{ color: home.hue, borderColor: `${home.hue}44` }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
            </AnimatePresence>

            {done && (
              <motion.div className="hiw-card hiw-card-done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: EASE }}>
                <div className="hiw-done-badge">{match}% match</div>
                <div className="hiw-done-title">Now we're talking.</div>
                <p className="hiw-done-sub">MovEazy has your taste. Real recommendations would look like these — not 500 random flats.</p>
                <button type="button" className="hiw-btn hiw-btn-ghost hiw-btn-sm" onClick={reset}>
                  Try again
                </button>
              </motion.div>
            )}
          </div>

          {!done && (
            <div className="hiw-votes">
              <button type="button" className="hiw-vote hiw-vote-no" onClick={() => vote(-1)} aria-label="Don't like">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
              <div className="hiw-vote-hint">Swipe or tap</div>
              <button type="button" className="hiw-vote hiw-vote-yes" onClick={() => vote(1)} aria-label="Like">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
                  <path d="M12 21s-7.5-4.7-10-9.3C.4 8.4 2 4.8 5.4 4.8c2 0 3.4 1.2 4.6 3 1.2-1.8 2.6-3 4.6-3 3.4 0 5 3.6 3.4 6.9C19.5 16.3 12 21 12 21z" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* right · the brain + live taste profile */}
        <div className="hiw-brain-wrap">
          <AIBrain intensity={intensity} />
          <div className="hiw-profile">
            <div className="hiw-profile-top">
              <span>Your taste profile</span>
              <span className="hiw-profile-match" style={{ color: signals ? C.sage : C.muted }}>{match}% match</span>
            </div>
            <div className="hiw-profile-bar">
              <motion.div className="hiw-profile-fill" animate={{ width: `${(learned / PREFS.length) * 100}%` }} transition={{ duration: 0.5, ease: EASE }} />
            </div>
            <div className="hiw-prefs">
              {PREFS.map((p, i) => {
                const on = i < learned;
                return (
                  <span key={p} className={`hiw-pref ${on ? "on" : ""}`}>{p}</span>
                );
              })}
            </div>
            <div className="hiw-signalcount">
              <b>{signals}</b> signal{signals === 1 ? "" : "s"} learned
              {signals >= 3 && <span className="hiw-signal-live"> · getting smarter</span>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AIBrain({ intensity }) {
  const nodes = [
    [50, 22], [26, 40], [74, 40], [34, 66], [66, 66], [50, 50], [50, 82], [18, 58], [82, 58],
  ];
  const links = [[5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [5, 6], [1, 7], [2, 8], [3, 6], [4, 6]];
  const glow = 0.25 + intensity * 0.75;
  return (
    <div className="hiw-brain" style={{ "--glow": glow }}>
      <div className="hiw-brain-ring" style={{ opacity: 0.4 + intensity * 0.6 }} />
      <div className="hiw-brain-ring hiw-brain-ring2" style={{ opacity: 0.25 + intensity * 0.5 }} />
      <svg viewBox="0 0 100 100" className="hiw-brain-svg" aria-hidden>
        <defs>
          <radialGradient id="hiw-core" cx="50%" cy="45%" r="60%">
            <stop offset="0" stopColor={C.violet} stopOpacity={glow} />
            <stop offset="1" stopColor={C.violet} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="46" fill="url(#hiw-core)" />
        {links.map(([a, b], i) => (
          <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke={C.violet} strokeWidth="0.8" strokeOpacity={0.25 + intensity * 0.5} />
        ))}
        {nodes.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === 5 ? 4.4 : 2.6} fill={i === 5 ? C.violet : "#fff"} stroke={C.violet} strokeWidth="1">
            <animate attributeName="r" values={`${i === 5 ? 4.4 : 2.6};${(i === 5 ? 4.4 : 2.6) + 0.6 + intensity};${i === 5 ? 4.4 : 2.6}`} dur={`${1.6 + (i % 3) * 0.4}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>
    </div>
  );
}

/* ── Section 4 · INVENTORY ECOSYSTEM ───────────────────────────────────────── */
function EcosystemSection() {
  const sources = [
    { label: "Verified brokers", hue: C.coral, x: 90, y: 60 },
    { label: "Landlords", hue: C.sage, x: 90, y: 200 },
    { label: "Existing tenants", hue: C.gold, x: 610, y: 60 },
    { label: "Property scouts", hue: C.violet, x: 610, y: 200 },
  ];
  return (
    <section className="hiw-sec hiw-eco">
      <Reveal className="hiw-sec-head">
        <span className="hiw-kicker hiw-kicker-sage">The inventory</span>
        <h2 className="hiw-h2">
          One flat is never on every site. <span className="hiw-grad-sage">So we built one place for all of them.</span>
        </h2>
        <p className="hiw-lead">
          India's largest collaborative rental inventory. Brokers, landlords, tenants and scouts
          share genuine listings — and earn rewards for the good ones.
        </p>
      </Reveal>

      <Reveal className="hiw-eco-stage" delay={0.1}>
        <svg viewBox="0 0 700 260" className="hiw-eco-svg" role="img" aria-label="Listings flowing from brokers, landlords, tenants and scouts into the MovEazy hub, with rewards flowing back">
          {sources.map((s, i) => {
            const path = `M${s.x} ${s.y} Q 350 130 350 130`;
            return (
              <g key={s.label}>
                <path id={`eco-${i}`} d={path} fill="none" stroke={s.hue} strokeWidth="1.5" strokeOpacity="0.28" strokeDasharray="3 7" />
                {/* listing travelling inward */}
                <circle r="4.5" fill={s.hue}>
                  <animateMotion dur={`${2.4 + i * 0.35}s`} repeatCount="indefinite" path={path} />
                </circle>
                {/* reward travelling outward */}
                <circle r="3.2" fill={C.gold}>
                  <animateMotion dur={`${2.4 + i * 0.35}s`} repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear" path={path} begin={`${i * 0.5}s`} />
                </circle>
              </g>
            );
          })}
          {sources.map((s) => (
            <g key={`n-${s.label}`} transform={`translate(${s.x} ${s.y})`}>
              <circle r="30" fill="#fff" stroke={s.hue} strokeWidth="2" />
              <circle r="30" fill={s.hue} fillOpacity="0.1" />
              <g transform="translate(-14 -14)"><HouseMini hue={s.hue} /></g>
              <text x="0" y="52" textAnchor="middle" className="hiw-eco-label" fill={C.ink}>{s.label}</text>
            </g>
          ))}
          {/* central hub */}
          <g transform="translate(350 130)">
            <circle r="52" fill={C.ink} />
            <circle r="52" fill="none" stroke={C.gold} strokeWidth="1.5" strokeOpacity="0.6">
              <animate attributeName="r" values="52;58;52" dur="3s" repeatCount="indefinite" />
            </circle>
            <text x="0" y="-2" textAnchor="middle" className="hiw-eco-hub" fill="#fff">Mov</text>
            <text x="0" y="16" textAnchor="middle" className="hiw-eco-hub" fill={C.coral}>Eazy</text>
          </g>
        </svg>
      </Reveal>

      <div className="hiw-eco-note">
        <Reveal className="hiw-eco-chip"><span>🎁</span> Share a genuine listing → earn rewards</Reveal>
        <Reveal className="hiw-eco-chip" delay={0.08}><span>⚡</span> Fresh inventory before most platforms</Reveal>
      </div>
    </section>
  );
}

/* ── Section 5 · AI + HUMAN BROKERS ────────────────────────────────────────── */
function BrokerSection() {
  return (
    <section className="hiw-sec hiw-brokers">
      <div className="hiw-brokers-grid">
        <Reveal className="hiw-brokers-copy">
          <span className="hiw-kicker hiw-kicker-gold">Humans still matter</span>
          <h2 className="hiw-h2">Brokers aren't the enemy. Bad searching is.</h2>
          <p className="hiw-lead">
            A good broker knows which societies allow bachelors, where rent is negotiable, the
            hidden issues, the paperwork, the landlord's temperament. We make brokers <b>smarter with
            AI</b> — not obsolete.
          </p>
          <ul className="hiw-broker-list">
            {[
              "Which societies actually allow bachelors",
              "Where the rent is genuinely negotiable",
              "Hidden issues you'd only find after moving in",
              "Documentation & landlord behaviour",
            ].map((t, i) => (
              <Reveal key={t} delay={0.05 * i} className="hiw-broker-item">
                <span className="hiw-check">✓</span> {t}
              </Reveal>
            ))}
          </ul>
        </Reveal>

        <Reveal className="hiw-savings" delay={0.1}>
          <div className="hiw-savings-card">
            <div className="hiw-savings-kicker">The maths nobody does</div>
            <p className="hiw-savings-line">
              A broker who negotiates just <b>₹1,000/month</b> off your rent…
            </p>
            <div className="hiw-savings-calc">
              <div className="hiw-savings-row"><span>₹1,000 × 24 months</span><b>₹24,000</b></div>
              <div className="hiw-savings-vs">often more than the brokerage itself</div>
            </div>
            <p className="hiw-savings-foot">
              You're not paying to unlock a door. You're paying to save <b>weeks of your life</b>.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Section 6 · COMPARISON ────────────────────────────────────────────────── */
function CompareSection() {
  const old = [
    "Endless scrolling",
    "Same listings everywhere",
    "Random recommendations",
    "No learning, ever",
    "Call every broker yourself",
    "Outdated, gone-already flats",
    "3–4 weekends house hunting",
  ];
  const neu = [
    "Learns your taste",
    "Recommendations improve daily",
    "Fresh, collaborative inventory",
    "Human expertise + AI",
    "Curated, high-signal visits",
    "Less travel, faster decisions",
    "Move in within days",
  ];
  return (
    <section className="hiw-sec hiw-compare">
      <Reveal className="hiw-sec-head">
        <span className="hiw-kicker hiw-kicker-coral">The difference</span>
        <h2 className="hiw-h2">Same city. A completely different search.</h2>
      </Reveal>

      <div className="hiw-compare-grid">
        <Reveal className="hiw-compare-card hiw-compare-old">
          <div className="hiw-compare-head">Traditional platforms</div>
          <ul>
            {old.map((t, i) => (
              <motion.li key={t} initial={{ opacity: 0, x: -14 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.5, ease: EASE }}>
                <span className="hiw-x">✕</span> {t}
              </motion.li>
            ))}
          </ul>
        </Reveal>

        <Reveal className="hiw-compare-card hiw-compare-new" delay={0.1}>
          <div className="hiw-compare-glow" aria-hidden />
          <div className="hiw-compare-head hiw-compare-head-new">
            Mov<span style={{ color: C.coral }}>Eazy</span>
          </div>
          <ul>
            {neu.map((t, i) => (
              <motion.li key={t} initial={{ opacity: 0, x: 14 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.5, ease: EASE }}>
                <span className="hiw-tick">✓</span> {t}
              </motion.li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Section 7 · TIMELINE ──────────────────────────────────────────────────── */
const TIMELINE = [
  { t: "Day 1", h: "You start rating homes", d: "Like / don't-like a handful of flats. No forms, no 40-field questionnaire.", hue: C.coral, icon: "👋" },
  { t: "Hours in", h: "The AI learns your taste", d: "Locality, budget, light, layout, vibe — it maps what actually matters to you.", hue: C.violet, icon: "🧠" },
  { t: "Day 2", h: "Curated visits, not chaos", d: "Instead of 40 houses, you see the 5 most likely to be *the one*.", hue: C.sage, icon: "📍" },
  { t: "Day 3", h: "A broker negotiates for you", d: "Human expertise closes the gap — rent, terms, paperwork, landlord.", hue: C.gold, icon: "🤝" },
  { t: "Day 4–5", h: "You move in", d: "Boxes in, plants out, friends over. House hunting — solved.", hue: C.coral, icon: "🏡" },
];
function TimelineSection() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 65%", "end 60%"] });
  const fill = useSpring(scrollYProgress, { stiffness: 80, damping: 24 });
  const scaleY = useTransform(fill, [0, 1], [0, 1]);
  return (
    <section className="hiw-sec hiw-timeline" ref={ref}>
      <Reveal className="hiw-sec-head">
        <span className="hiw-kicker hiw-kicker-violet">The journey</span>
        <h2 className="hiw-h2">From “I need a place” to keys — in days.</h2>
      </Reveal>

      <div className="hiw-tl">
        <div className="hiw-tl-track">
          <motion.div className="hiw-tl-fill" style={{ scaleY }} />
        </div>
        {TIMELINE.map((s, i) => (
          <Reveal key={s.t} className={`hiw-tl-step ${i % 2 ? "right" : "left"}`} delay={0.04}>
            <div className="hiw-tl-node" style={{ background: s.hue }}>{s.icon}</div>
            <div className="hiw-tl-card">
              <div className="hiw-tl-day" style={{ color: s.hue }}>{s.t}</div>
              <div className="hiw-tl-h">{s.h}</div>
              <div className="hiw-tl-d">{s.d}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ── Section 8 · FINAL CTA ─────────────────────────────────────────────────── */
function FinalCTA({ onPrimary }) {
  return (
    <section className="hiw-sec hiw-final">
      <div className="hiw-final-blobs" aria-hidden>
        <div className="hiw-blob hiw-blob-f1" />
        <div className="hiw-blob hiw-blob-f2" />
      </div>
      <Reveal className="hiw-final-inner">
        <h2 className="hiw-final-h">
          Stop searching. <br />
          <span className="hiw-grad">Start matching.</span>
        </h2>
        <p className="hiw-final-sub">Rate a few homes. Let the engine do the hunting.</p>
        <button type="button" className="hiw-btn hiw-btn-primary hiw-btn-lg" onClick={onPrimary}>
          Find my perfect home
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </Reveal>
    </section>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */
export default function HowItWorks() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openLogin } = useLoginModal();
  const [showChat, setShowChat] = useState(false);
  const engineRef = useRef(null);

  const { scrollYProgress } = useScroll();
  const barX = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  const startFinding = () => {
    if (user) navigate("/map");
    else openLogin(() => navigate("/map"));
  };
  const openAgent = () => {
    if (user) setShowChat(true);
    else openLogin(() => setShowChat(true));
  };
  const scrollToEngine = () => engineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="hiw-root">
      <Styles />
      <motion.div className="hiw-progress" style={{ scaleX: barX }} aria-hidden />
      <MovEazyNav active="how" onGetAgent={openAgent} />

      <Hero onPrimary={startFinding} onScrollToEngine={scrollToEngine} />
      <BrokenSection />
      <EngineSection innerRef={engineRef} />
      <EcosystemSection />
      <BrokerSection />
      <CompareSection />
      <TimelineSection />
      <FinalCTA onPrimary={startFinding} />

      <AIBroker open={showChat} onClose={() => setShowChat(false)} />
    </div>
  );
}

/* ── Scoped styles ─────────────────────────────────────────────────────────── */
function Styles() {
  return (
    <style>{`
      .hiw-root {
        --ink:${C.ink}; --coral:${C.coral}; --gold:${C.gold}; --violet:${C.violet}; --sage:${C.sage};
        --cream:${C.cream}; --line:${C.line}; --muted:${C.muted};
        background:${C.cream}; color:${C.ink};
        font-family:'Plus Jakarta Sans', system-ui, sans-serif;
        overflow-x:hidden;
      }
      .hiw-root ::selection { background:${C.coral}33; }
      .hiw-progress { position:fixed; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg,${C.coral},${C.gold}); transform-origin:0 50%; z-index:1300; }

      .hiw-sec { max-width:1180px; margin:0 auto; padding:clamp(70px,11vw,150px) clamp(20px,5vw,40px); position:relative; }
      .hiw-sec-head { max-width:760px; margin:0 auto clamp(38px,6vw,68px); text-align:center; }
      .hiw-h2 { font-family:'Playfair Display', Georgia, serif; font-weight:700; font-size:clamp(30px,5.2vw,54px); line-height:1.05; letter-spacing:-0.02em; margin:14px 0 0; }
      .hiw-lead { font-size:clamp(16px,2vw,19px); line-height:1.6; color:#5f584e; margin:18px auto 0; max-width:620px; }
      .hiw-kicker { display:inline-block; font-size:12px; font-weight:800; letter-spacing:0.16em; text-transform:uppercase; padding:6px 14px; border-radius:999px; }
      .hiw-kicker-coral { color:${C.coralDeep}; background:${C.coral}1a; }
      .hiw-kicker-violet { color:${C.violet}; background:${C.violet}1a; }
      .hiw-kicker-sage { color:${C.sage}; background:${C.sage}1a; }
      .hiw-kicker-gold { color:#a9781f; background:${C.gold}26; }
      .hiw-grad { background:linear-gradient(100deg,${C.coral},${C.gold}); -webkit-background-clip:text; background-clip:text; color:transparent; }
      .hiw-grad-violet { background:linear-gradient(100deg,${C.violet},${C.coral}); -webkit-background-clip:text; background-clip:text; color:transparent; }
      .hiw-grad-sage { background:linear-gradient(100deg,${C.sage},${C.gold}); -webkit-background-clip:text; background-clip:text; color:transparent; }

      /* buttons */
      .hiw-btn { display:inline-flex; align-items:center; gap:9px; border-radius:999px; font-family:inherit; font-weight:700; font-size:15px; cursor:pointer; border:1px solid transparent; padding:14px 24px; transition:transform .18s ease, box-shadow .18s ease, background .18s ease; }
      .hiw-btn-primary { background:${C.ink}; color:#fff; box-shadow:0 12px 30px rgba(28,26,23,0.28); }
      .hiw-btn-primary:hover { transform:translateY(-2px); box-shadow:0 18px 40px rgba(28,26,23,0.34); }
      .hiw-btn-ghost { background:transparent; color:${C.ink}; border-color:${C.line}; }
      .hiw-btn-ghost:hover { background:#fff; transform:translateY(-2px); }
      .hiw-btn-lg { padding:17px 30px; font-size:16.5px; }
      .hiw-btn-sm { padding:9px 16px; font-size:13.5px; }

      /* HERO */
      .hiw-hero { position:relative; max-width:1240px; margin:0 auto; padding:clamp(40px,7vw,86px) clamp(20px,5vw,40px) clamp(50px,7vw,90px); min-height:88vh; display:flex; align-items:center; }
      .hiw-hero-blobs { position:absolute; inset:0; overflow:hidden; z-index:0; pointer-events:none; }
      .hiw-blob { position:absolute; border-radius:50%; filter:blur(60px); opacity:0.5; }
      .hiw-blob-a { width:420px; height:420px; background:${C.coral}; top:-60px; left:-40px; opacity:0.28; }
      .hiw-blob-b { width:360px; height:360px; background:${C.gold}; bottom:-80px; right:8%; opacity:0.26; }
      .hiw-blob-c { width:300px; height:300px; background:${C.violet}; top:30%; right:26%; opacity:0.2; }
      .hiw-hero-grid { position:relative; z-index:1; display:grid; grid-template-columns:1.05fr 0.95fr; gap:40px; align-items:center; width:100%; }
      .hiw-eyebrow { display:inline-flex; align-items:center; gap:8px; font-size:13px; font-weight:700; color:#6a6157; letter-spacing:0.02em; padding:7px 15px 7px 12px; background:rgba(255,255,255,0.7); border:1px solid ${C.line}; border-radius:999px; backdrop-filter:blur(8px); }
      .hiw-eyebrow-dot { width:8px; height:8px; border-radius:50%; background:${C.coral}; box-shadow:0 0 0 4px ${C.coral}2e; }
      .hiw-hero-h1 { font-family:'Playfair Display', Georgia, serif; font-weight:700; font-size:clamp(38px,6.6vw,74px); line-height:1.02; letter-spacing:-0.025em; margin:20px 0 0; }
      .hiw-hero-sub { font-size:clamp(16px,2.1vw,20px); line-height:1.6; color:#5f584e; max-width:500px; margin:22px 0 0; }
      .hiw-hero-cta { display:flex; flex-wrap:wrap; gap:12px; margin-top:32px; }
      .hiw-hero-proof { display:flex; align-items:center; gap:12px; margin-top:26px; font-size:14px; color:#6a6157; }
      .hiw-hero-proof b { color:${C.ink}; }
      .hiw-arrow { color:${C.coral}; font-weight:800; }
      .hiw-proof-hot b { color:${C.coralDeep}; }

      .hiw-hero-stage { position:relative; height:min(60vh,460px); }
      .hiw-brain-halo { position:absolute; width:340px; height:340px; border-radius:50%; top:50%; left:50%; transform:translate(-50%,-50%); background:radial-gradient(circle,${C.violet}22,transparent 65%); }
      .hiw-floatcard { position:absolute; width:190px; }
      .hiw-floatcard-inner { display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.82); border:1px solid rgba(255,255,255,0.9); box-shadow:0 20px 44px rgba(28,26,23,0.14); backdrop-filter:blur(12px); border-radius:18px; padding:14px; cursor:default; }
      .hiw-fc-name { font-weight:800; font-size:14px; }
      .hiw-fc-meta { font-size:11.5px; color:${C.muted}; margin-top:2px; }
      .hiw-fc-heart { margin-left:auto; font-size:16px; }
      .hiw-scrollcue { position:absolute; bottom:14px; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; gap:4px; background:none; border:none; color:${C.muted}; font-size:11px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; cursor:pointer; }
      .hiw-scrollcue svg { animation:hiw-bounce 1.8s ease-in-out infinite; }
      @keyframes hiw-bounce { 0%,100%{ transform:translateY(0);} 50%{ transform:translateY(5px);} }

      /* BROKEN */
      .hiw-broken { text-align:center; }
      .hiw-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:20px; margin-bottom:clamp(40px,6vw,72px); }
      .hiw-stat { background:#fff; border:1px solid ${C.line}; border-radius:22px; padding:30px 18px; box-shadow:0 10px 30px rgba(28,26,23,0.05); }
      .hiw-stat-num { font-family:'Playfair Display', serif; font-weight:700; font-size:clamp(34px,5vw,52px); color:${C.coralDeep}; line-height:1; letter-spacing:-0.02em; }
      .hiw-stat-label { font-size:13.5px; color:#6a6157; margin-top:12px; line-height:1.4; }
      .hiw-chaos { width:100%; height:auto; max-width:900px; margin:0 auto; display:block; }

      /* ENGINE */
      .hiw-engine { }
      .hiw-engine-stage { display:grid; grid-template-columns:1fr 1fr; gap:clamp(30px,5vw,64px); align-items:center; }
      .hiw-deck-wrap { display:flex; flex-direction:column; align-items:center; gap:22px; }
      .hiw-deck { position:relative; width:min(320px,80vw); height:390px; }
      .hiw-card { position:absolute; inset:0; background:#fff; border:1px solid ${C.line}; border-radius:26px; box-shadow:0 26px 60px rgba(28,26,23,0.16); overflow:hidden; display:flex; flex-direction:column; user-select:none; }
      .hiw-card-photo { position:relative; height:190px; display:flex; align-items:center; justify-content:center; }
      .hiw-card-rent { position:absolute; top:14px; right:14px; background:${C.ink}; color:#fff; font-size:13px; font-weight:800; padding:6px 12px; border-radius:999px; }
      .hiw-card-body { padding:18px 20px; }
      .hiw-card-title { font-family:'Playfair Display', serif; font-weight:700; font-size:23px; }
      .hiw-card-area { display:flex; align-items:center; gap:5px; font-size:13.5px; color:${C.muted}; margin-top:5px; }
      .hiw-card-tags { display:flex; flex-wrap:wrap; gap:7px; margin-top:16px; }
      .hiw-tag { font-size:12px; font-weight:700; padding:5px 11px; border-radius:999px; border:1px solid; background:#fff; }
      .hiw-card-done { align-items:center; justify-content:center; text-align:center; padding:34px; gap:6px; background:linear-gradient(160deg,#fff,${C.cream2}); }
      .hiw-done-badge { display:inline-block; background:${C.sage}; color:#fff; font-weight:800; font-size:14px; padding:7px 16px; border-radius:999px; margin-bottom:14px; }
      .hiw-done-title { font-family:'Playfair Display', serif; font-weight:700; font-size:27px; }
      .hiw-done-sub { font-size:14px; color:#6a6157; line-height:1.55; margin:10px 0 20px; }
      .hiw-votes { display:flex; align-items:center; gap:18px; }
      .hiw-vote { width:60px; height:60px; border-radius:50%; border:1px solid ${C.line}; background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 8px 22px rgba(28,26,23,0.1); transition:transform .16s ease; }
      .hiw-vote:hover { transform:translateY(-3px) scale(1.05); }
      .hiw-vote-no { color:${C.muted}; }
      .hiw-vote-no:hover { color:${C.coralDeep}; border-color:${C.coral}; }
      .hiw-vote-yes { color:${C.coral}; }
      .hiw-vote-yes:hover { background:${C.coral}; color:#fff; border-color:${C.coral}; }
      .hiw-vote-hint { font-size:12px; font-weight:700; color:${C.muted}; letter-spacing:0.02em; }

      .hiw-brain-wrap { display:flex; flex-direction:column; align-items:center; gap:26px; }
      .hiw-brain { position:relative; width:230px; height:230px; display:flex; align-items:center; justify-content:center; }
      .hiw-brain-ring { position:absolute; inset:8px; border-radius:50%; border:1.5px dashed ${C.violet}55; animation:hiw-spin 26s linear infinite; }
      .hiw-brain-ring2 { inset:34px; border-style:solid; border-color:${C.violet}33; animation:hiw-spin 18s linear infinite reverse; }
      @keyframes hiw-spin { to { transform:rotate(360deg); } }
      .hiw-brain-svg { width:100%; height:100%; position:relative; z-index:1; filter:drop-shadow(0 0 calc(14px * var(--glow)) ${C.violet}); }
      .hiw-profile { width:100%; max-width:340px; background:#fff; border:1px solid ${C.line}; border-radius:20px; padding:20px; box-shadow:0 14px 40px rgba(28,26,23,0.08); }
      .hiw-profile-top { display:flex; justify-content:space-between; align-items:center; font-size:13px; font-weight:800; color:${C.ink}; }
      .hiw-profile-match { font-weight:800; }
      .hiw-profile-bar { height:8px; border-radius:999px; background:${C.cream2}; margin:12px 0 16px; overflow:hidden; }
      .hiw-profile-fill { height:100%; border-radius:999px; background:linear-gradient(90deg,${C.violet},${C.coral}); }
      .hiw-prefs { display:flex; flex-wrap:wrap; gap:7px; }
      .hiw-pref { font-size:11.5px; font-weight:700; padding:5px 10px; border-radius:999px; background:${C.cream2}; color:#b3aa9d; transition:all .35s ease; }
      .hiw-pref.on { background:${C.violet}1a; color:${C.violet}; }
      .hiw-signalcount { margin-top:16px; font-size:12.5px; color:${C.muted}; }
      .hiw-signalcount b { color:${C.ink}; }
      .hiw-signal-live { color:${C.sage}; font-weight:700; }

      /* ECOSYSTEM */
      .hiw-eco-stage { max-width:760px; margin:0 auto; }
      .hiw-eco-svg { width:100%; height:auto; display:block; }
      .hiw-eco-label { font:700 12px 'Plus Jakarta Sans', sans-serif; }
      .hiw-eco-hub { font:700 16px 'Playfair Display', serif; }
      .hiw-eco-note { display:flex; flex-wrap:wrap; gap:14px; justify-content:center; margin-top:36px; }
      .hiw-eco-chip { display:inline-flex; align-items:center; gap:9px; background:#fff; border:1px solid ${C.line}; border-radius:999px; padding:12px 20px; font-size:14px; font-weight:700; box-shadow:0 8px 22px rgba(28,26,23,0.06); }
      .hiw-eco-chip span { font-size:17px; }

      /* BROKERS */
      .hiw-brokers-grid { display:grid; grid-template-columns:1.05fr 0.95fr; gap:clamp(28px,5vw,60px); align-items:center; }
      .hiw-broker-list { list-style:none; padding:0; margin:26px 0 0; display:flex; flex-direction:column; gap:12px; }
      .hiw-broker-item { display:flex; align-items:center; gap:12px; font-size:15.5px; color:#4a443c; font-weight:600; }
      .hiw-check { flex-shrink:0; width:24px; height:24px; border-radius:50%; background:${C.sage}1f; color:${C.sage}; display:inline-flex; align-items:center; justify-content:center; font-size:13px; font-weight:900; }
      .hiw-savings-card { position:relative; background:linear-gradient(160deg,${C.ink},${C.ink2}); color:#fff; border-radius:28px; padding:clamp(28px,4vw,40px); box-shadow:0 30px 70px rgba(28,26,23,0.3); overflow:hidden; }
      .hiw-savings-card::before { content:""; position:absolute; width:260px; height:260px; border-radius:50%; background:${C.gold}; filter:blur(80px); opacity:0.3; top:-80px; right:-60px; }
      .hiw-savings-kicker { position:relative; font-size:12px; font-weight:800; letter-spacing:0.16em; text-transform:uppercase; color:${C.gold}; }
      .hiw-savings-line { position:relative; font-size:clamp(19px,2.6vw,26px); font-weight:700; line-height:1.35; margin:16px 0 22px; font-family:'Playfair Display', serif; }
      .hiw-savings-line b { color:${C.gold}; }
      .hiw-savings-calc { position:relative; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); border-radius:18px; padding:18px 20px; }
      .hiw-savings-row { display:flex; justify-content:space-between; align-items:baseline; font-size:15px; color:#e9e2d5; }
      .hiw-savings-row b { font-family:'Playfair Display', serif; font-size:30px; color:#fff; }
      .hiw-savings-vs { font-size:12.5px; color:${C.gold}; margin-top:6px; font-weight:600; }
      .hiw-savings-foot { position:relative; font-size:14.5px; color:#d9d2c6; line-height:1.6; margin:22px 0 0; }
      .hiw-savings-foot b { color:#fff; }

      /* COMPARE */
      .hiw-compare-grid { display:grid; grid-template-columns:1fr 1fr; gap:22px; max-width:920px; margin:0 auto; }
      .hiw-compare-card { border-radius:26px; padding:clamp(26px,3.4vw,38px); position:relative; overflow:hidden; }
      .hiw-compare-old { background:#f4f0e8; border:1px solid ${C.line}; }
      .hiw-compare-new { background:linear-gradient(165deg,#fff,${C.cream2}); border:1px solid ${C.coral}44; box-shadow:0 26px 60px rgba(239,90,69,0.14); }
      .hiw-compare-glow { position:absolute; width:220px; height:220px; border-radius:50%; background:${C.coral}; filter:blur(80px); opacity:0.16; top:-60px; right:-40px; }
      .hiw-compare-head { font-family:'Playfair Display', serif; font-weight:700; font-size:22px; margin-bottom:20px; color:#6a6157; }
      .hiw-compare-head-new { color:${C.ink}; position:relative; }
      .hiw-compare-card ul { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:13px; }
      .hiw-compare-card li { display:flex; align-items:center; gap:11px; font-size:15px; font-weight:600; }
      .hiw-compare-old li { color:#8a8177; }
      .hiw-compare-new li { color:${C.ink}; position:relative; }
      .hiw-x { flex-shrink:0; width:22px; height:22px; border-radius:50%; background:#e4ddd0; color:#a89e90; display:inline-flex; align-items:center; justify-content:center; font-size:11px; font-weight:900; }
      .hiw-tick { flex-shrink:0; width:22px; height:22px; border-radius:50%; background:${C.coral}; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:12px; font-weight:900; }

      /* TIMELINE */
      .hiw-tl { position:relative; max-width:840px; margin:0 auto; padding:10px 0; }
      .hiw-tl-track { position:absolute; left:50%; top:0; bottom:0; width:3px; transform:translateX(-50%); background:${C.line}; border-radius:999px; overflow:hidden; }
      .hiw-tl-fill { position:absolute; inset:0; transform-origin:top; background:linear-gradient(${C.coral},${C.violet},${C.sage},${C.gold}); }
      .hiw-tl-step { position:relative; width:50%; padding:22px 44px; box-sizing:border-box; }
      .hiw-tl-step.left { left:0; text-align:right; }
      .hiw-tl-step.right { left:50%; text-align:left; }
      .hiw-tl-node { position:absolute; top:26px; width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:20px; box-shadow:0 8px 22px rgba(28,26,23,0.18); border:3px solid ${C.cream}; z-index:1; }
      .hiw-tl-step.left .hiw-tl-node { right:-22px; }
      .hiw-tl-step.right .hiw-tl-node { left:-22px; }
      .hiw-tl-card { background:#fff; border:1px solid ${C.line}; border-radius:20px; padding:20px 22px; box-shadow:0 12px 34px rgba(28,26,23,0.07); display:inline-block; text-align:left; }
      .hiw-tl-day { font-size:12px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; }
      .hiw-tl-h { font-family:'Playfair Display', serif; font-weight:700; font-size:20px; margin:5px 0 7px; }
      .hiw-tl-d { font-size:14px; color:#6a6157; line-height:1.55; }

      /* FINAL */
      .hiw-final { max-width:none; text-align:center; background:${C.ink}; color:#fff; border-radius:clamp(28px,4vw,44px); margin:0 clamp(12px,3vw,28px) clamp(28px,5vw,48px); overflow:hidden; }
      .hiw-final-blobs { position:absolute; inset:0; overflow:hidden; }
      .hiw-blob-f1 { width:380px; height:380px; background:${C.coral}; top:-120px; left:8%; opacity:0.4; filter:blur(70px); }
      .hiw-blob-f2 { width:340px; height:340px; background:${C.gold}; bottom:-140px; right:10%; opacity:0.32; filter:blur(70px); }
      .hiw-final-inner { position:relative; z-index:1; }
      .hiw-final .hiw-btn-primary { background:#fff; color:${C.ink}; box-shadow:0 16px 40px rgba(0,0,0,0.35); }
      .hiw-final .hiw-btn-primary:hover { background:${C.cream}; box-shadow:0 22px 50px rgba(0,0,0,0.42); }
      .hiw-final-h { font-family:'Playfair Display', serif; font-weight:700; font-size:clamp(34px,6.4vw,68px); line-height:1.04; letter-spacing:-0.02em; color:#fff; }
      .hiw-final-sub { font-size:clamp(15px,2vw,19px); color:#cfc8bc; margin:20px 0 34px; }

      /* CHAT OVERLAY */
      .hiw-chat-overlay { position:fixed; inset:0; z-index:1400; background:rgba(20,18,16,0.55); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:20px; }
      .hiw-chat-panel { position:relative; width:min(560px,96vw); height:min(680px,86vh); background:#fff; border-radius:24px; overflow:hidden; box-shadow:0 40px 100px rgba(0,0,0,0.4); display:flex; flex-direction:column; }
      .hiw-chat-close { position:absolute; top:14px; right:14px; z-index:5; width:34px; height:34px; border-radius:50%; border:none; background:rgba(0,0,0,0.06); color:${C.ink}; font-size:15px; cursor:pointer; }
      .hiw-chat-close:hover { background:rgba(0,0,0,0.12); }

      /* RESPONSIVE */
      @media (max-width:900px) {
        .hiw-hero { min-height:auto; }
        .hiw-hero-grid { grid-template-columns:1fr; gap:20px; }
        .hiw-hero-stage { height:360px; margin-top:10px; order:2; }
        .hiw-hero-copy { order:1; }
        .hiw-stats { grid-template-columns:repeat(2,1fr); }
        .hiw-engine-stage { grid-template-columns:1fr; gap:44px; }
        .hiw-brokers-grid { grid-template-columns:1fr; }
        .hiw-compare-grid { grid-template-columns:1fr; }
        .hiw-scrollcue { display:none; }

        .hiw-tl-track { left:22px; }
        .hiw-tl-step, .hiw-tl-step.left, .hiw-tl-step.right { width:100%; left:0; text-align:left; padding:16px 0 16px 58px; }
        .hiw-tl-step.left .hiw-tl-node, .hiw-tl-step.right .hiw-tl-node { left:0; right:auto; }
      }
      @media (max-width:520px) {
        .hiw-stats { grid-template-columns:1fr 1fr; gap:12px; }
        .hiw-floatcard { width:158px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .hiw-scrollcue svg, .hiw-brain-ring, .hiw-brain-ring2 { animation:none; }
      }
    `}</style>
  );
}
