/**
 * "About MovEazy" — the founders' origin story, told like a documentary.
 *
 * Not a headshot-beside-two-paragraphs page. It's a scroll-driven narrative that
 * earns belief before it explains the product: two IIT Kanpur roommates who got
 * obsessed with a problem everyone accepts as normal.
 *
 * Every fact here is real — drawn from the founders' own LinkedIn profiles and the
 * brief. Nothing about roles, education, or personal life is invented. Where detail
 * is thin (e.g. specific sports), the copy stays general on purpose.
 *
 * Portraits are the founders' own photos, already in the repo (owned by them).
 * Built with Framer Motion + hand-drawn inline SVG — self-contained, no CDNs.
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
} from "framer-motion";
import MovEazyNav from "../components/layout/MovEazyNav";
import AIBroker from "../components/AIBroker";
import { useAuth } from "../context/AuthContext";
import { useLoginModal } from "../context/LoginModalContext";
import yatharthImg from "../assets/images/yatharthdesk.png";
import amanImg from "../assets/images/aman.png";

/* ── Art direction (shared with the How-it-works page) ─────────────────────── */
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

/* ── Motion primitives ─────────────────────────────────────────────────────── */
function Reveal({ children, y = 30, delay = 0, className = "", style }) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
function ParallaxLayer({ mx, my, depth = 20, children, style, className = "" }) {
  const x = useTransform(mx, (v) => v * depth);
  const y = useTransform(my, (v) => v * depth);
  return (
    <motion.div className={className} style={{ x, y, ...style }}>
      {children}
    </motion.div>
  );
}

/* Section kicker + heading */
function Kicker({ tone = "coral", children }) {
  return <span className={`ab-kicker ab-kicker-${tone}`}>{children}</span>;
}

/* ── HERO ──────────────────────────────────────────────────────────────────── */
function Hero({ onScroll }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 50, damping: 18 });
  const sy = useSpring(my, { stiffness: 50, damping: 18 });
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    my.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <section className="ab-hero" onMouseMove={onMove} onMouseLeave={onLeave}>
      <div className="ab-hero-bg" aria-hidden>
        <ParallaxLayer mx={sx} my={sy} depth={-14} className="ab-skyline">
          <Skyline />
        </ParallaxLayer>
        <ParallaxLayer mx={sx} my={sy} depth={30} className="ab-float ab-float-box" style={{ top: "18%", left: "8%" }}>
          <BoxGlyph />
        </ParallaxLayer>
        <ParallaxLayer mx={sx} my={sy} depth={44} className="ab-float ab-float-pin" style={{ top: "26%", right: "12%" }}>
          <PinGlyph />
        </ParallaxLayer>
        <ParallaxLayer mx={sx} my={sy} depth={22} className="ab-float ab-float-box" style={{ bottom: "30%", right: "24%" }}>
          <BoxGlyph small />
        </ParallaxLayer>
        <div className="ab-hero-grain" />
      </div>

      <div className="ab-hero-inner">
        <div className="ab-hero-portraits" aria-hidden>
          <ParallaxLayer mx={sx} my={sy} depth={-10}>
            <motion.figure
              className="ab-portrait ab-portrait-a"
              initial={{ opacity: 0, y: 30, rotate: -3 }}
              animate={{ opacity: 1, y: 0, rotate: -3 }}
              transition={{ delay: 0.2, duration: 0.9, ease: EASE }}
            >
              <img src={yatharthImg} alt="" />
              <figcaption>Yatharth</figcaption>
            </motion.figure>
          </ParallaxLayer>
          <ParallaxLayer mx={sx} my={sy} depth={12}>
            <motion.figure
              className="ab-portrait ab-portrait-b"
              initial={{ opacity: 0, y: 30, rotate: 3 }}
              animate={{ opacity: 1, y: 0, rotate: 3 }}
              transition={{ delay: 0.36, duration: 0.9, ease: EASE }}
            >
              <img src={amanImg} alt="" />
              <figcaption>Aman</figcaption>
            </motion.figure>
          </ParallaxLayer>
        </div>

        <div className="ab-hero-copy">
          <motion.span
            className="ab-eyebrow"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            The story behind MovEazy
          </motion.span>
          <h1 className="ab-hero-h1">
            <motion.span
              className="ab-hero-l1"
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.85, ease: EASE }}
            >
              We didn't start MovEazy because we loved real estate.
            </motion.span>
            <motion.span
              className="ab-hero-l2"
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1, duration: 0.95, ease: EASE }}
            >
              We started it because we <em>hated</em> house hunting.
            </motion.span>
          </h1>
        </div>
      </div>

      <button type="button" className="ab-scrollcue" onClick={onScroll} aria-label="Read the story">
        <span>Their story</span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </section>
  );
}

/* ── ORIGIN STORY ──────────────────────────────────────────────────────────── */
function StorySection() {
  return (
    <section className="ab-sec ab-story">
      <Reveal className="ab-story-mark">
        <span>IIT Kanpur</span>
        <span className="ab-story-dot" />
        <span>Class of 2024</span>
      </Reveal>
      <Reveal delay={0.08}>
        <p className="ab-story-lead">
          Two college roommates. Two best friends.<br />
          They graduated from <b>IIT Kanpur in 2024</b> and walked into very different careers —
          but they'd already caught the same bug: building things that fix real, stubborn problems.
        </p>
      </Reveal>
      <Reveal delay={0.16} className="ab-story-foot">
        Before MovEazy, before any of this, Yatharth and Aman had already shipped a startup together
        at IITK — <b>Zero Carbon</b>, a tool to help businesses measure their carbon footprint. The
        idea didn't last. The instinct to build side by side did.
      </Reveal>
    </section>
  );
}

/* ── FOUNDER SECTION (reused for both) ─────────────────────────────────────── */
function FounderSection({
  img, name, tone, role, kicker, story, path, philosophy, interests, flip = false, imgStyle,
}) {
  return (
    <section className={`ab-sec ab-founder ${flip ? "flip" : ""}`}>
      <div className="ab-founder-grid">
        <Reveal className="ab-founder-media" y={40}>
          <div className={`ab-portrait-lg ab-frame-${tone}`}>
            <img src={img} alt={`${name}, co-founder of MovEazy`} style={imgStyle} />
            <div className="ab-portrait-tag">{role}</div>
          </div>
        </Reveal>

        <div className="ab-founder-body">
          <Reveal><Kicker tone={tone}>{kicker}</Kicker></Reveal>
          <Reveal delay={0.06}><h2 className="ab-founder-name">{name}</h2></Reveal>
          {story.map((p, i) => (
            <Reveal key={i} delay={0.1 + i * 0.05}>
              <p className="ab-founder-p" dangerouslySetInnerHTML={{ __html: p }} />
            </Reveal>
          ))}

          <Reveal delay={0.2} className="ab-path">
            {path.map((step, i) => (
              <div key={step} className="ab-path-step">
                <span className="ab-path-node" style={{ background: C[tone] }} />
                <span className="ab-path-label">{step}</span>
                {i < path.length - 1 && <span className="ab-path-arrow">→</span>}
              </div>
            ))}
          </Reveal>

          <Reveal delay={0.26} className="ab-philo" style={{ borderColor: `${C[tone]}55` }}>
            <span className="ab-philo-quote" style={{ color: C[tone] }}>“</span>
            {philosophy}
          </Reveal>

          <Reveal delay={0.32} className="ab-interests">
            {interests.map((t) => (
              <span key={t} className="ab-interest" style={{ color: C[tone], borderColor: `${C[tone]}44` }}>{t}</span>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── SHARED MINDSET ────────────────────────────────────────────────────────── */
function MindsetSection() {
  const traits = [
    { t: "Discipline", d: "Show up, every day, whether or not it's convenient.", icon: "◎" },
    { t: "Teamwork", d: "The best players make the people around them better.", icon: "⬡" },
    { t: "Competition", d: "Hate losing more than you love winning. Then keep score.", icon: "△" },
  ];
  return (
    <section className="ab-sec ab-mindset">
      <Reveal className="ab-sec-head">
        <Kicker tone="gold">How they build</Kicker>
        <h2 className="ab-h2">They build the way athletes train.</h2>
        <p className="ab-lead">
          Both are sports enthusiasts, and it shows in how they run the company — discipline over
          motivation, team over ego, and a healthy obsession with keeping score.
        </p>
      </Reveal>
      <div className="ab-mindset-grid">
        {traits.map((tr, i) => (
          <Reveal key={tr.t} delay={i * 0.08} className="ab-mindset-card">
            <span className="ab-mindset-icon">{tr.icon}</span>
            <div className="ab-mindset-t">{tr.t}</div>
            <div className="ab-mindset-d">{tr.d}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ── THE REALIZATION ───────────────────────────────────────────────────────── */
function RealizationSection() {
  const fees = ["Brokerage", "Service fee", "Convenience fee", "Platform fee"];
  const reals = ["Wasted time", "Terrible matching", "Fragmented inventory", "Endless searching", "Uncertainty"];
  return (
    <section className="ab-sec ab-real">
      <Reveal className="ab-sec-head">
        <Kicker tone="coral">The realization</Kicker>
        <h2 className="ab-h2">Every platform claims to solve it. None actually do.</h2>
      </Reveal>

      <Reveal className="ab-fees" delay={0.08}>
        {fees.map((f, i) => (
          <motion.span
            key={f}
            className="ab-fee"
            initial={{ opacity: 0, y: 16, rotate: -2 }}
            whileInView={{ opacity: 1, y: 0, rotate: (i - 1.5) * 2 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.5, ease: EASE }}
          >
            {f}
          </motion.span>
        ))}
        <div className="ab-fee-eq">= same outcome</div>
      </Reveal>

      <Reveal className="ab-real-turn" delay={0.1}>
        Here's the thing though — <b>pricing was never the real problem.</b> People don't hate paying
        for value. They hate spending a <b>month</b> of their life to find a place to live.
      </Reveal>

      <div className="ab-reals">
        {reals.map((r, i) => (
          <Reveal key={r} delay={i * 0.06} className="ab-real-chip">
            <span className="ab-real-x">!</span>{r}
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ── THE BROKEN SYSTEM ─────────────────────────────────────────────────────── */
function BrokenSection() {
  const sources = ["Facebook Marketplace", "WhatsApp groups", "MagicBricks", "Housing", "NoBroker", "Dozens of brokers"];
  return (
    <section className="ab-sec ab-broken">
      <div className="ab-broken-grid">
        <Reveal className="ab-broken-copy">
          <Kicker tone="violet">The system today</Kicker>
          <h2 className="ab-h2">Renting in India is a dozen open tabs and no answers.</h2>
          <p className="ab-lead">
            You bounce between marketplaces, chat groups and broker calls — piecing together a
            picture nobody actually has.
          </p>
          <ul className="ab-broken-list">
            {[
              "Nobody has complete inventory.",
              "Nobody understands your preferences.",
              "Nobody learns from your last search.",
              "Nobody filters intelligently.",
            ].map((t, i) => (
              <Reveal key={t} delay={i * 0.05} className="ab-broken-item"><span>✕</span>{t}</Reveal>
            ))}
          </ul>
        </Reveal>

        <Reveal className="ab-tabs" delay={0.1} y={40}>
          {sources.map((s, i) => (
            <motion.div
              key={s}
              className="ab-tab"
              style={{ top: `${i * 15}%`, left: `${(i % 3) * 14 + (i % 2 ? 8 : 0)}%`, zIndex: 10 - i }}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.09, duration: 0.5, ease: EASE }}
              animate={{ y: [0, -6, 0] }}
            >
              <span className="ab-tab-dot" /> {s}
            </motion.div>
          ))}
          <div className="ab-tabs-cursor">↖</div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── WHY BROKERS WILL ALWAYS EXIST ─────────────────────────────────────────── */
function BrokersSection() {
  const value = ["Time", "Stress", "Negotiation", "Paperwork", "Local knowledge"];
  const knows = ["Your lifestyle", "Commute", "Budget", "Neighbourhoods", "Furnishing", "Sunlight", "Pet friendliness", "Family needs"];
  return (
    <section className="ab-sec ab-brokers">
      <Reveal className="ab-sec-head">
        <Kicker tone="sage">An honest take</Kicker>
        <h2 className="ab-h2">Brokers aren't the problem. They're part of the answer.</h2>
        <p className="ab-lead">
          A great broker saves you time, stress, negotiation, paperwork and years of local knowledge.
          The problem was never brokers — it's that they've never had the right tools or incentives.
        </p>
      </Reveal>

      <div className="ab-brokers-cards">
        <Reveal className="ab-broker-card" y={36}>
          <div className="ab-broker-card-h">What a good broker already saves you</div>
          <div className="ab-chips">
            {value.map((v) => <span key={v} className="ab-chip ab-chip-sage">{v}</span>)}
          </div>
        </Reveal>

        <Reveal className="ab-broker-card ab-broker-card-future" delay={0.1} y={36}>
          <div className="ab-broker-card-h">Tomorrow, a broker who's a consultant — and knows</div>
          <div className="ab-chips">
            {knows.map((v) => <span key={v} className="ab-chip ab-chip-gold">{v}</span>)}
          </div>
          <div className="ab-broker-punch">
            Instead of 40 random houses → <b>the 5 you're most likely to love.</b>
          </div>
        </Reveal>
      </div>
      <Reveal className="ab-brokers-foot" delay={0.1}>
        MovEazy exists to make that future possible. <b>AI should empower brokers — not replace them.</b>
      </Reveal>
    </section>
  );
}

/* ── THE VISION (mission statement) ────────────────────────────────────────── */
function MissionSection() {
  return (
    <section className="ab-sec ab-mission">
      <div className="ab-mission-blobs" aria-hidden>
        <div className="ab-blob ab-blob-m1" />
        <div className="ab-blob ab-blob-m2" />
      </div>
      <Reveal className="ab-mission-inner">
        <h2 className="ab-mission-h">
          We don't want to eliminate brokerage.<br />
          <span className="ab-grad">We want to eliminate bad house hunting.</span>
        </h2>
        <p className="ab-mission-sub">
          Technology should remove the uncertainty, the unnecessary travel, the repetitive searching
          and the irrelevant visits — while keeping the human guidance that actually matters.
        </p>
      </Reveal>
    </section>
  );
}

/* ── BLINKIT VISION ────────────────────────────────────────────────────────── */
function BlinkitSection() {
  const signals = [
    "Architectural style", "Sunlight", "Furnishing", "Kitchen layout", "Balcony size",
    "Work-from-home fit", "Commute priorities", "Neighbourhood vibe", "Amenities", "Aesthetics", "Lifestyle",
  ];
  return (
    <section className="ab-sec ab-blinkit">
      <Reveal className="ab-sec-head">
        <Kicker tone="coral">The big vision</Kicker>
        <h2 className="ab-h2">
          House hunting should be as easy as <span className="ab-grad">ordering groceries.</span>
        </h2>
        <p className="ab-lead">
          When you order from Blinkit, you don't scroll a hundred stores — the right thing just shows
          up. We think finding a home should eventually feel that effortless.
        </p>
      </Reveal>

      <div className="ab-blinkit-grid">
        <Reveal className="ab-ppt" y={40}>
          <div className="ab-ppt-head">
            <span className="ab-ppt-time">5–10 min</span>
            Property Preference Test
          </div>
          <p className="ab-ppt-sub">Tell us what you like and what you don't. Rate homes with a tap.</p>
          <div className="ab-ppt-votes">
            <span className="ab-ppt-vote ab-ppt-like">❤️ Like</span>
            <span className="ab-ppt-vote ab-ppt-no">👎 Don't like</span>
          </div>
          <div className="ab-ppt-signals">
            <div className="ab-ppt-signals-h">With every tap, we learn the deeper signals:</div>
            <div className="ab-chips">
              {signals.map((s) => <span key={s} className="ab-chip ab-chip-coral">{s}</span>)}
            </div>
          </div>
        </Reveal>

        <Reveal className="ab-analogy" delay={0.1} y={40}>
          <div className="ab-analogy-row">
            <span className="ab-analogy-logo" style={{ background: "#E50914" }}>N</span>
            <div><b>Netflix</b> learns what you watch.</div>
          </div>
          <div className="ab-analogy-row">
            <span className="ab-analogy-logo" style={{ background: "#1DB954" }}>♫</span>
            <div><b>Spotify</b> learns what you listen to.</div>
          </div>
          <div className="ab-analogy-row ab-analogy-us">
            <span className="ab-analogy-logo" style={{ background: C.coral }}>M</span>
            <div><b>MovEazy</b> is being built to learn where you'll feel at home.</div>
          </div>
          <p className="ab-analogy-foot">
            The ambition: after just 5–10 minutes, recommend homes that feel handpicked. Not hundreds
            of options — just the right ones. <span>(We're building toward this, not there yet.)</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ── TWO PROBLEMS + FLYWHEEL ───────────────────────────────────────────────── */
function ProblemsSection() {
  return (
    <section className="ab-sec ab-problems">
      <Reveal className="ab-sec-head">
        <Kicker tone="violet">The two problems</Kicker>
        <h2 className="ab-h2">Building that future means solving two things.</h2>
      </Reveal>

      <div className="ab-problems-grid">
        <Reveal className="ab-problem" y={36}>
          <div className="ab-problem-num" style={{ background: C.violet }}>01</div>
          <div className="ab-problem-t">Intelligence</div>
          <p className="ab-problem-d">
            Before AI can recommend the perfect home, it has to understand what makes each person
            unique. Every like and dislike trains the engine — and the more you use it, the more
            personal it gets.
          </p>
        </Reveal>
        <Reveal className="ab-problem" delay={0.1} y={36}>
          <div className="ab-problem-num" style={{ background: C.sage }}>02</div>
          <div className="ab-problem-t">Inventory</div>
          <p className="ab-problem-d">
            The smartest AI is useless without great homes to recommend. So we're building one of
            India's largest collaborative rental networks — from broker partners, outgoing tenants,
            landlords, on-ground scouts and community referrals. We reward people who surface genuine,
            high-quality listings.
          </p>
        </Reveal>
      </div>

      <Reveal className="ab-flywheel" delay={0.1}>
        <Flywheel />
        <div className="ab-flywheel-caption">
          Better inventory → better recommendations → more users → more feedback → smarter AI.
          <b> A flywheel that compounds.</b>
        </div>
      </Reveal>
    </section>
  );
}

function Flywheel() {
  const steps = [
    { t: "Better inventory", a: -90, hue: C.sage },
    { t: "Better recommendations", a: -18, hue: C.coral },
    { t: "More users", a: 54, hue: C.gold },
    { t: "More feedback", a: 126, hue: C.violet },
    { t: "Smarter AI", a: 198, hue: C.ink },
  ];
  const R = 128;
  return (
    <div className="ab-fw">
      <svg viewBox="0 0 320 320" className="ab-fw-svg" aria-hidden>
        <circle cx="160" cy="160" r={R} fill="none" stroke={C.line} strokeWidth="2" />
        <circle cx="160" cy="160" r={R} fill="none" stroke="url(#ab-fw-grad)" strokeWidth="3" strokeLinecap="round" strokeDasharray="140 680" className="ab-fw-arc" />
        <defs>
          <linearGradient id="ab-fw-grad" x1="0" x2="1">
            <stop offset="0" stopColor={C.coral} />
            <stop offset="1" stopColor={C.violet} />
          </linearGradient>
        </defs>
        <circle cx="160" cy="160" r="52" fill={C.ink} />
        <text x="160" y="156" textAnchor="middle" className="ab-fw-hub">Mov</text>
        <text x="160" y="174" textAnchor="middle" className="ab-fw-hub" fill={C.coral}>Eazy</text>
      </svg>
      {steps.map((s) => {
        const rad = (s.a * Math.PI) / 180;
        const x = 160 + Math.cos(rad) * R;
        const y = 160 + Math.sin(rad) * R;
        return (
          <div key={s.t} className="ab-fw-node" style={{ left: `${(x / 320) * 100}%`, top: `${(y / 320) * 100}%`, borderColor: s.hue }}>
            <span style={{ background: s.hue }} />{s.t}
          </div>
        );
      })}
    </div>
  );
}

/* ── THE FUTURE ────────────────────────────────────────────────────────────── */
function FutureSection() {
  const rows = [
    { icon: "⏱", t: "Finding a home takes hours, not weeks." },
    { icon: "🤝", t: "Brokers become trusted advisors, equipped with AI." },
    { icon: "🏠", t: "Tenants discover homes tailored to their lifestyle." },
    { icon: "🚚", t: "Moving to a new city feels as simple as ordering groceries." },
  ];
  return (
    <section className="ab-sec ab-future">
      <Reveal className="ab-sec-head">
        <Kicker tone="gold">The future we're building</Kicker>
        <h2 className="ab-h2">We're not building another listing website.</h2>
        <p className="ab-lead">We're building the intelligence layer for India's rental ecosystem — a future where:</p>
      </Reveal>
      <div className="ab-future-list">
        {rows.map((r, i) => (
          <Reveal key={r.t} delay={i * 0.07} className="ab-future-row">
            <span className="ab-future-icon">{r.icon}</span>
            <span className="ab-future-t">{r.t}</span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ── CULTURE / VALUES ──────────────────────────────────────────────────────── */
function CultureSection({ onPrimary }) {
  const values = [
    ["Ownership", "You see it, you own it. No “not my job.”"],
    ["Speed", "Shipped and learning beats perfect and late."],
    ["Customer obsession", "The renter's month is the metric that matters."],
    ["Transparency", "Say the real thing, especially when it's hard."],
    ["Simplicity", "Remove steps. Then remove more."],
    ["Real problems", "Solve what actually hurts — not what looks good in a deck."],
  ];
  return (
    <section className="ab-sec ab-culture">
      <Reveal className="ab-sec-head">
        <Kicker tone="coral">How we work</Kicker>
        <h2 className="ab-h2">MovEazy isn't building a real estate company.</h2>
        <p className="ab-lead">We're building the future of moving cities. These are the things we actually care about:</p>
      </Reveal>

      <div className="ab-values">
        {values.map(([t, d], i) => (
          <Reveal key={t} delay={i * 0.05} className="ab-value">
            <div className="ab-value-t">{t}</div>
            <div className="ab-value-d">{d}</div>
          </Reveal>
        ))}
      </div>

      <Reveal className="ab-culture-not" delay={0.1}>
        Not vanity metrics. Not download counts. Not funding announcements.
        <b> Only solving problems worth solving.</b>
      </Reveal>

      <Reveal className="ab-culture-cta" delay={0.16}>
        <div className="ab-culture-blobs" aria-hidden><div className="ab-blob ab-blob-c1" /><div className="ab-blob ab-blob-c2" /></div>
        <div className="ab-culture-cta-inner">
          <h3 className="ab-culture-cta-h">MovEazy wasn't built to make renting digital.</h3>
          <p className="ab-culture-cta-sub">It was built to make renting genuinely better.</p>
          <button type="button" className="ab-btn" onClick={onPrimary}>
            Come find your home
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </Reveal>
    </section>
  );
}

/* ── Inline SVG glyphs ─────────────────────────────────────────────────────── */
function Skyline() {
  return (
    <svg viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice" width="100%" height="100%" aria-hidden>
      {[
        [40, 150, 70, 170], [120, 110, 60, 210], [190, 180, 80, 140], [280, 90, 66, 230],
        [360, 160, 74, 160], [446, 130, 60, 190], [520, 60, 70, 260], [600, 170, 84, 150],
        [694, 120, 62, 200], [770, 190, 78, 130], [860, 100, 68, 220], [942, 150, 72, 170],
        [1026, 70, 64, 250], [1104, 175, 82, 145], [1198, 120, 66, 200], [1276, 160, 76, 160], [1364, 130, 60, 190],
      ].map(([x, y, w, h], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={h} rx="4" fill={C.ink} opacity={0.05 + (i % 4) * 0.015} />
          {[0, 1, 2].map((c) => [0, 1, 2, 3].map((r) => (
            <rect key={`${c}-${r}`} x={x + 10 + c * (w / 3)} y={y + 14 + r * (h / 5)} width="7" height="9" fill={C.gold} opacity={(i + c + r) % 3 === 0 ? 0.28 : 0.08} />
          )))}
        </g>
      ))}
    </svg>
  );
}
function BoxGlyph({ small }) {
  const s = small ? 40 : 58;
  return (
    <svg width={s} height={s} viewBox="0 0 60 60" fill="none" aria-hidden>
      <path d="M8 20 30 10l22 10-22 10z" fill={C.gold} opacity="0.9" />
      <path d="M8 20v22l22 10V30z" fill={C.coral} opacity="0.85" />
      <path d="M52 20v22L30 52V30z" fill={C.coralDeep} opacity="0.85" />
      <path d="M19 15 41 25" stroke="#fff" strokeWidth="2" opacity="0.6" />
    </svg>
  );
}
function PinGlyph() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden>
      <path d="M22 6a12 12 0 0 1 12 12c0 8-12 20-12 20S10 26 10 18A12 12 0 0 1 22 6z" fill={C.violet} />
      <circle cx="22" cy="18" r="5" fill="#fff" />
    </svg>
  );
}

/* ── PAGE ──────────────────────────────────────────────────────────────────── */
export default function About() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openLogin } = useLoginModal();
  const [showChat, setShowChat] = useState(false);
  const storyRef = useRef(null);

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
  const scrollToStory = () => storyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="ab-root">
      <Styles />
      <motion.div className="ab-progress" style={{ scaleX: barX }} aria-hidden />
      <MovEazyNav active="about" onGetAgent={openAgent} />

      <Hero onScroll={scrollToStory} />
      <div ref={storyRef} />
      <StorySection />

      <FounderSection
        img={yatharthImg}
        name="Yatharth Singh"
        tone="coral"
        role="Co-founder"
        kicker="Founder 1"
        imgStyle={{ objectPosition: "50% 20%" }}
        story={[
          "Yatharth took the path everyone calls <b>the safe one</b> — <b>BCG</b>, then <b>Schlumberger</b>, then the <b>Founder's Office at Masai</b>. A high-paying career with a clear ladder in front of him.",
          "But he kept running into the same thing. Every time someone he knew moved cities — for a job, for college, for a fresh start — they lost <b>weeks</b> to house hunting. Wasted weekends. Blind negotiations. The occasional scam. Deposits gone. An experience that hadn't meaningfully changed in decades.",
          "One question wouldn't leave him alone: <b>why is finding a home in 2026 still this broken?</b> He didn't walk away from a good career out of restlessness — he walked toward a problem worth a decade of his life.",
        ]}
        path={["IIT Kanpur '24", "BCG", "Schlumberger", "Founder's Office @ Masai", "MovEazy"]}
        philosophy="He treats money, time and effort the same way — invest where it compounds, and don't wait for the perfect moment that never comes."
        interests={["Prop-tech", "Personal finance", "Markets", "0→1 building"]}
      />

      <FounderSection
        img={amanImg}
        name="Aman Singh Solanki"
        tone="violet"
        role="Co-founder"
        kicker="Founder 2"
        flip
        story={[
          "Aman is the complementary half — a <b>growth and product</b> builder. He cut his teeth on product as an intern at <b>Everest Carbon</b>, then drove <b>growth at Kreo</b> in the fast, unforgiving world of D2C.",
          "He and Yatharth aren't new co-founders figuring each other out — they're roommates who'd <b>already built together</b>. At IITK they shipped <b>Zero Carbon</b>, a tool to help businesses measure their footprint. It taught them how they work under pressure, and that they'd rather build than watch.",
          "Aman had lived the rental mess firsthand too. Same frustration, different angle — and a shared conviction that technology should <b>reduce effort</b>, not just digitize a broken process.",
        ]}
        path={["IIT Kanpur '24", "Zero Carbon", "Everest Carbon", "Growth @ Kreo", "MovEazy"]}
        philosophy="He's learned that the strongest move isn't always to push harder — sometimes it's to stop, reset, and change direction with intent."
        interests={["Growth", "Product", "Sustainability", "D2C"]}
      />

      <MindsetSection />
      <RealizationSection />
      <BrokenSection />
      <BrokersSection />
      <MissionSection />
      <BlinkitSection />
      <ProblemsSection />
      <FutureSection />
      <CultureSection onPrimary={startFinding} />

      <AIBroker open={showChat} onClose={() => setShowChat(false)} />
    </div>
  );
}

/* ── Scoped styles ─────────────────────────────────────────────────────────── */
function Styles() {
  return (
    <style>{`
      .ab-root {
        background:${C.cream}; color:${C.ink};
        font-family:'Plus Jakarta Sans', system-ui, sans-serif; overflow-x:hidden;
      }
      .ab-root ::selection { background:${C.coral}33; }
      .ab-progress { position:fixed; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg,${C.coral},${C.violet}); transform-origin:0 50%; z-index:1300; }

      .ab-sec { max-width:1180px; margin:0 auto; padding:clamp(64px,10vw,140px) clamp(20px,5vw,40px); position:relative; }
      .ab-sec-head { max-width:780px; margin:0 auto clamp(34px,5vw,60px); text-align:center; }
      .ab-h2 { font-family:'Playfair Display', Georgia, serif; font-weight:700; font-size:clamp(28px,4.8vw,52px); line-height:1.06; letter-spacing:-0.02em; margin:14px 0 0; }
      .ab-lead { font-size:clamp(16px,2vw,19px); line-height:1.62; color:#5f584e; margin:18px auto 0; max-width:640px; }
      .ab-kicker { display:inline-block; font-size:12px; font-weight:800; letter-spacing:0.16em; text-transform:uppercase; padding:6px 14px; border-radius:999px; }
      .ab-kicker-coral { color:${C.coralDeep}; background:${C.coral}1a; }
      .ab-kicker-violet { color:${C.violet}; background:${C.violet}1a; }
      .ab-kicker-sage { color:${C.sage}; background:${C.sage}1a; }
      .ab-kicker-gold { color:#a9781f; background:${C.gold}26; }
      .ab-grad { background:linear-gradient(100deg,${C.coral},${C.gold}); -webkit-background-clip:text; background-clip:text; color:transparent; }

      .ab-btn { display:inline-flex; align-items:center; gap:9px; border-radius:999px; font-family:inherit; font-weight:700; font-size:15.5px; cursor:pointer; border:none; padding:15px 26px; background:#fff; color:${C.ink}; box-shadow:0 14px 36px rgba(0,0,0,0.28); transition:transform .18s ease, box-shadow .18s ease; }
      .ab-btn:hover { transform:translateY(-2px); box-shadow:0 20px 46px rgba(0,0,0,0.34); }

      /* HERO */
      .ab-hero { position:relative; min-height:100vh; display:flex; align-items:center; overflow:hidden; background:radial-gradient(120% 80% at 70% 10%, ${C.cream2}, ${C.cream}); }
      .ab-hero-bg { position:absolute; inset:0; z-index:0; pointer-events:none; }
      .ab-skyline { position:absolute; bottom:0; left:0; right:0; height:46%; }
      .ab-hero-grain { position:absolute; inset:0; background:radial-gradient(100% 60% at 50% 100%, transparent, ${C.cream}); }
      .ab-float { position:absolute; filter:drop-shadow(0 14px 24px rgba(28,26,23,0.14)); }
      .ab-hero-inner { position:relative; z-index:2; max-width:1220px; margin:0 auto; padding:0 clamp(20px,5vw,40px); display:grid; grid-template-columns:0.9fr 1.1fr; gap:40px; align-items:center; width:100%; }
      .ab-hero-portraits { position:relative; height:min(64vh,520px); }
      .ab-portrait { position:absolute; width:min(46%,230px); border-radius:20px; overflow:hidden; margin:0; box-shadow:0 30px 70px rgba(28,26,23,0.28); border:5px solid #fff; }
      .ab-portrait img { width:100%; height:100%; object-fit:cover; display:block; aspect-ratio:1/1.15; }
      .ab-portrait figcaption { position:absolute; bottom:10px; left:12px; color:#fff; font-weight:800; font-size:14px; text-shadow:0 2px 10px rgba(0,0,0,0.5); letter-spacing:0.02em; }
      .ab-portrait-a { top:6%; left:2%; z-index:2; }
      .ab-portrait-a img { object-position:50% 18%; }
      .ab-portrait-b { bottom:4%; right:4%; z-index:3; }
      .ab-hero-copy { }
      .ab-eyebrow { display:inline-block; font-size:13px; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:${C.coralDeep}; background:${C.coral}14; padding:8px 16px; border-radius:999px; }
      .ab-hero-h1 { margin:22px 0 0; font-family:'Playfair Display', Georgia, serif; font-weight:700; line-height:1.06; letter-spacing:-0.02em; }
      .ab-hero-l1 { display:block; font-size:clamp(26px,4.2vw,50px); color:${C.ink}; }
      .ab-hero-l2 { display:block; font-size:clamp(26px,4.2vw,50px); color:${C.coralDeep}; margin-top:10px; }
      .ab-hero-l2 em { font-style:italic; color:${C.ink}; }
      .ab-scrollcue { position:absolute; bottom:20px; left:50%; transform:translateX(-50%); z-index:2; display:flex; flex-direction:column; align-items:center; gap:5px; background:none; border:none; color:${C.muted}; font-size:11px; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; cursor:pointer; }
      .ab-scrollcue svg { animation:ab-bounce 1.8s ease-in-out infinite; }
      @keyframes ab-bounce { 0%,100%{ transform:translateY(0);} 50%{ transform:translateY(5px);} }

      /* STORY */
      .ab-story { text-align:center; max-width:900px; }
      .ab-story-mark { display:inline-flex; align-items:center; gap:14px; font-size:13px; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:${C.muted}; }
      .ab-story-dot { width:6px; height:6px; border-radius:50%; background:${C.coral}; }
      .ab-story-lead { font-family:'Playfair Display', serif; font-size:clamp(22px,3.4vw,38px); line-height:1.32; letter-spacing:-0.01em; margin:22px 0 0; color:${C.ink}; }
      .ab-story-lead b { color:${C.coralDeep}; }
      .ab-story-foot { font-size:clamp(15px,1.9vw,18px); line-height:1.6; color:#5f584e; max-width:660px; margin:26px auto 0; }
      .ab-story-foot b { color:${C.ink}; }

      /* FOUNDER */
      .ab-founder-grid { display:grid; grid-template-columns:0.85fr 1.15fr; gap:clamp(30px,5vw,64px); align-items:center; }
      .ab-founder.flip .ab-founder-grid { grid-template-columns:1.15fr 0.85fr; }
      .ab-founder.flip .ab-founder-media { order:2; }
      .ab-portrait-lg { position:relative; border-radius:26px; overflow:hidden; box-shadow:0 34px 80px rgba(28,26,23,0.24); }
      .ab-portrait-lg img { width:100%; display:block; aspect-ratio:1/1.1; object-fit:cover; }
      .ab-portrait-lg::after { content:""; position:absolute; inset:0; box-shadow:inset 0 0 0 6px #fff; border-radius:26px; pointer-events:none; }
      .ab-frame-coral { background:linear-gradient(135deg,${C.coral},${C.gold}); padding:6px; }
      .ab-frame-violet { background:linear-gradient(135deg,${C.violet},${C.coral}); padding:6px; }
      .ab-portrait-tag { position:absolute; left:18px; bottom:18px; z-index:2; background:rgba(255,255,255,0.92); backdrop-filter:blur(6px); color:${C.ink}; font-size:12px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; padding:7px 14px; border-radius:999px; }
      .ab-founder-name { font-family:'Playfair Display', serif; font-weight:700; font-size:clamp(30px,4.4vw,48px); letter-spacing:-0.02em; margin:12px 0 18px; line-height:1.05; }
      .ab-founder-p { font-size:clamp(15px,1.85vw,17.5px); line-height:1.68; color:#4c463e; margin:0 0 15px; }
      .ab-founder-p b { color:${C.ink}; font-weight:700; }
      .ab-path { display:flex; flex-wrap:wrap; align-items:center; gap:8px 10px; margin-top:22px; }
      .ab-path-step { display:inline-flex; align-items:center; gap:10px; }
      .ab-path-node { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
      .ab-path-label { font-size:13.5px; font-weight:700; color:${C.ink}; }
      .ab-path-arrow { color:${C.muted}; font-weight:700; margin-left:2px; }
      .ab-philo { position:relative; margin-top:24px; padding:4px 0 4px 22px; border-left:3px solid; font-size:clamp(15px,1.9vw,18px); font-style:italic; line-height:1.55; color:#4c463e; }
      .ab-philo-quote { position:absolute; left:8px; top:-6px; font-family:'Playfair Display', serif; font-size:34px; line-height:1; }
      .ab-interests { display:flex; flex-wrap:wrap; gap:8px; margin-top:22px; }
      .ab-interest { font-size:12.5px; font-weight:700; padding:6px 13px; border-radius:999px; border:1px solid; background:#fff; }

      /* MINDSET */
      .ab-mindset-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
      .ab-mindset-card { background:#fff; border:1px solid ${C.line}; border-radius:22px; padding:30px 26px; box-shadow:0 12px 34px rgba(28,26,23,0.06); }
      .ab-mindset-icon { display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:14px; background:${C.gold}1f; color:#a9781f; font-size:22px; }
      .ab-mindset-t { font-family:'Playfair Display', serif; font-weight:700; font-size:22px; margin:16px 0 8px; }
      .ab-mindset-d { font-size:14.5px; color:#5f584e; line-height:1.55; }

      /* REALIZATION */
      .ab-real { text-align:center; }
      .ab-fees { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:14px; margin-bottom:14px; }
      .ab-fee { display:inline-block; background:#fff; border:1px solid ${C.line}; border-radius:14px; padding:14px 22px; font-weight:800; font-size:16px; color:#6a6157; box-shadow:0 10px 26px rgba(28,26,23,0.06); }
      .ab-fee-eq { width:100%; margin-top:8px; font-family:'Playfair Display', serif; font-style:italic; font-size:clamp(20px,3vw,30px); color:${C.coralDeep}; }
      .ab-real-turn { max-width:680px; margin:34px auto 0; font-size:clamp(17px,2.2vw,22px); line-height:1.55; color:${C.ink}; }
      .ab-real-turn b { color:${C.coralDeep}; }
      .ab-reals { display:flex; flex-wrap:wrap; justify-content:center; gap:12px; margin-top:32px; }
      .ab-real-chip { display:inline-flex; align-items:center; gap:9px; background:${C.ink}; color:#fff; border-radius:999px; padding:11px 20px; font-size:14.5px; font-weight:700; }
      .ab-real-x { width:20px; height:20px; border-radius:50%; background:${C.coral}; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:12px; font-weight:900; }

      /* BROKEN */
      .ab-broken-grid { display:grid; grid-template-columns:1fr 1fr; gap:clamp(30px,5vw,60px); align-items:center; }
      .ab-broken-list { list-style:none; padding:0; margin:26px 0 0; display:flex; flex-direction:column; gap:12px; }
      .ab-broken-item { display:flex; align-items:center; gap:12px; font-size:15.5px; font-weight:600; color:#4c463e; }
      .ab-broken-item span { flex-shrink:0; width:22px; height:22px; border-radius:50%; background:${C.coral}1a; color:${C.coralDeep}; display:inline-flex; align-items:center; justify-content:center; font-size:11px; font-weight:900; }
      .ab-tabs { position:relative; height:340px; }
      .ab-tab { position:absolute; display:inline-flex; align-items:center; gap:9px; background:#fff; border:1px solid ${C.line}; border-radius:12px; padding:12px 18px; font-size:14px; font-weight:700; color:${C.ink}; box-shadow:0 16px 40px rgba(28,26,23,0.12); white-space:nowrap; }
      .ab-tab-dot { width:9px; height:9px; border-radius:50%; background:${C.coral}; }
      .ab-tabs-cursor { position:absolute; right:14%; bottom:8%; font-size:26px; color:${C.ink}; }

      /* BROKERS */
      .ab-brokers-cards { display:grid; grid-template-columns:1fr 1fr; gap:22px; max-width:940px; margin:0 auto; }
      .ab-broker-card { background:#fff; border:1px solid ${C.line}; border-radius:24px; padding:clamp(24px,3vw,34px); box-shadow:0 14px 40px rgba(28,26,23,0.06); }
      .ab-broker-card-future { background:linear-gradient(165deg,#fff,${C.cream2}); border-color:${C.gold}55; }
      .ab-broker-card-h { font-family:'Playfair Display', serif; font-weight:700; font-size:19px; margin-bottom:18px; line-height:1.3; }
      .ab-chips { display:flex; flex-wrap:wrap; gap:9px; }
      .ab-chip { font-size:13px; font-weight:700; padding:8px 14px; border-radius:999px; }
      .ab-chip-sage { background:${C.sage}16; color:${C.sage}; }
      .ab-chip-gold { background:${C.gold}22; color:#a9781f; }
      .ab-chip-coral { background:${C.coral}14; color:${C.coralDeep}; }
      .ab-broker-punch { margin-top:20px; font-size:15.5px; color:#4c463e; line-height:1.5; }
      .ab-broker-punch b { color:${C.ink}; }
      .ab-brokers-foot { text-align:center; max-width:620px; margin:36px auto 0; font-size:clamp(16px,2vw,19px); line-height:1.55; color:#5f584e; }
      .ab-brokers-foot b { color:${C.ink}; }

      /* MISSION */
      .ab-mission { max-width:none; text-align:center; background:${C.ink}; color:#fff; border-radius:clamp(26px,4vw,42px); margin:0 clamp(12px,3vw,28px); overflow:hidden; }
      .ab-mission-blobs { position:absolute; inset:0; overflow:hidden; }
      .ab-blob { position:absolute; border-radius:50%; filter:blur(70px); }
      .ab-blob-m1 { width:360px; height:360px; background:${C.coral}; top:-120px; left:10%; opacity:0.4; }
      .ab-blob-m2 { width:340px; height:340px; background:${C.violet}; bottom:-140px; right:12%; opacity:0.34; }
      .ab-mission-inner { position:relative; z-index:1; max-width:820px; margin:0 auto; }
      .ab-mission-h { font-family:'Playfair Display', serif; font-weight:700; font-size:clamp(28px,5vw,54px); line-height:1.1; letter-spacing:-0.02em; color:#fff; }
      .ab-mission-sub { font-size:clamp(16px,2vw,19px); line-height:1.6; color:#cfc8bc; margin:22px auto 0; max-width:620px; }

      /* BLINKIT */
      .ab-blinkit-grid { display:grid; grid-template-columns:1.1fr 0.9fr; gap:clamp(24px,4vw,44px); align-items:stretch; }
      .ab-ppt { background:#fff; border:1px solid ${C.line}; border-radius:26px; padding:clamp(24px,3vw,34px); box-shadow:0 20px 50px rgba(28,26,23,0.08); }
      .ab-ppt-head { display:flex; align-items:center; gap:12px; font-family:'Playfair Display', serif; font-weight:700; font-size:22px; }
      .ab-ppt-time { background:${C.coral}; color:#fff; font-family:'Plus Jakarta Sans',sans-serif; font-size:13px; font-weight:800; padding:6px 13px; border-radius:999px; }
      .ab-ppt-sub { font-size:15px; color:#5f584e; margin:14px 0 18px; }
      .ab-ppt-votes { display:flex; gap:12px; margin-bottom:22px; }
      .ab-ppt-vote { flex:1; text-align:center; padding:14px; border-radius:16px; font-weight:800; font-size:15px; }
      .ab-ppt-like { background:${C.coral}14; color:${C.coralDeep}; border:1.5px solid ${C.coral}44; }
      .ab-ppt-no { background:${C.cream2}; color:#6a6157; border:1.5px solid ${C.line}; }
      .ab-ppt-signals-h { font-size:13px; font-weight:800; color:${C.muted}; letter-spacing:0.02em; margin-bottom:12px; }
      .ab-analogy { background:linear-gradient(165deg,${C.ink},${C.ink2}); border-radius:26px; padding:clamp(24px,3vw,34px); color:#fff; display:flex; flex-direction:column; justify-content:center; gap:18px; }
      .ab-analogy-row { display:flex; align-items:center; gap:14px; font-size:16px; color:#e2dbcf; }
      .ab-analogy-row b { color:#fff; }
      .ab-analogy-logo { width:40px; height:40px; border-radius:11px; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:18px; flex-shrink:0; }
      .ab-analogy-us { font-size:17px; }
      .ab-analogy-foot { font-size:13.5px; line-height:1.6; color:#b7b0a4; margin:6px 0 0; border-top:1px solid rgba(255,255,255,0.12); padding-top:16px; }
      .ab-analogy-foot span { color:${C.gold}; }

      /* PROBLEMS + FLYWHEEL */
      .ab-problems-grid { display:grid; grid-template-columns:1fr 1fr; gap:22px; margin-bottom:clamp(40px,6vw,72px); }
      .ab-problem { background:#fff; border:1px solid ${C.line}; border-radius:24px; padding:clamp(26px,3vw,36px); box-shadow:0 14px 40px rgba(28,26,23,0.06); }
      .ab-problem-num { display:inline-flex; align-items:center; justify-content:center; width:52px; height:52px; border-radius:15px; color:#fff; font-weight:800; font-size:18px; font-family:'Playfair Display',serif; }
      .ab-problem-t { font-family:'Playfair Display', serif; font-weight:700; font-size:26px; margin:18px 0 10px; }
      .ab-problem-d { font-size:15.5px; line-height:1.62; color:#4c463e; }
      .ab-flywheel { display:flex; flex-direction:column; align-items:center; gap:22px; }
      .ab-fw { position:relative; width:min(340px,88vw); aspect-ratio:1; }
      .ab-fw-svg { width:100%; height:100%; }
      .ab-fw-arc { transform-origin:center; animation:ab-spin 8s linear infinite; }
      @keyframes ab-spin { to { transform:rotate(360deg); } }
      .ab-fw-hub { font-family:'Playfair Display',serif; font-weight:700; font-size:17px; fill:#fff; }
      .ab-fw-node { position:absolute; transform:translate(-50%,-50%); display:inline-flex; align-items:center; gap:7px; background:#fff; border:1.5px solid; border-radius:999px; padding:7px 13px; font-size:12.5px; font-weight:800; color:${C.ink}; box-shadow:0 8px 20px rgba(28,26,23,0.1); white-space:nowrap; }
      .ab-fw-node span { width:8px; height:8px; border-radius:50%; }
      .ab-flywheel-caption { max-width:600px; text-align:center; font-size:15px; line-height:1.6; color:#5f584e; }
      .ab-flywheel-caption b { color:${C.ink}; }

      /* FUTURE */
      .ab-future-list { max-width:760px; margin:0 auto; display:flex; flex-direction:column; gap:14px; }
      .ab-future-row { display:flex; align-items:center; gap:18px; background:#fff; border:1px solid ${C.line}; border-radius:18px; padding:20px 24px; box-shadow:0 10px 28px rgba(28,26,23,0.05); }
      .ab-future-icon { flex-shrink:0; width:46px; height:46px; border-radius:14px; background:${C.cream2}; display:flex; align-items:center; justify-content:center; font-size:22px; }
      .ab-future-t { font-size:clamp(16px,2vw,19px); font-weight:700; color:${C.ink}; }

      /* CULTURE */
      .ab-values { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
      .ab-value { background:#fff; border:1px solid ${C.line}; border-radius:20px; padding:26px 24px; box-shadow:0 10px 28px rgba(28,26,23,0.05); }
      .ab-value-t { font-family:'Playfair Display', serif; font-weight:700; font-size:21px; color:${C.ink}; margin-bottom:8px; }
      .ab-value-d { font-size:14.5px; line-height:1.55; color:#5f584e; }
      .ab-culture-not { text-align:center; max-width:640px; margin:38px auto 0; font-size:clamp(16px,2vw,20px); line-height:1.55; color:#5f584e; }
      .ab-culture-not b { color:${C.ink}; }
      .ab-culture-cta { position:relative; margin-top:clamp(44px,6vw,72px); background:${C.ink}; border-radius:clamp(24px,3vw,36px); overflow:hidden; text-align:center; padding:clamp(40px,6vw,72px) clamp(24px,4vw,40px); }
      .ab-culture-blobs { position:absolute; inset:0; overflow:hidden; }
      .ab-blob-c1 { width:320px; height:320px; background:${C.coral}; top:-110px; left:14%; opacity:0.38; filter:blur(70px); }
      .ab-blob-c2 { width:300px; height:300px; background:${C.gold}; bottom:-130px; right:16%; opacity:0.3; filter:blur(70px); }
      .ab-culture-cta-inner { position:relative; z-index:1; }
      .ab-culture-cta-h { font-family:'Playfair Display', serif; font-weight:700; font-size:clamp(24px,4vw,42px); line-height:1.1; letter-spacing:-0.02em; color:#fff; }
      .ab-culture-cta-sub { font-size:clamp(16px,2vw,20px); color:#cfc8bc; margin:16px 0 30px; }

      /* CHAT OVERLAY */
      .ab-chat-overlay { position:fixed; inset:0; z-index:1400; background:rgba(20,18,16,0.55); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:20px; }
      .ab-chat-panel { position:relative; width:min(560px,96vw); height:min(680px,86vh); background:#fff; border-radius:24px; overflow:hidden; box-shadow:0 40px 100px rgba(0,0,0,0.4); display:flex; flex-direction:column; }
      .ab-chat-close { position:absolute; top:14px; right:14px; z-index:5; width:34px; height:34px; border-radius:50%; border:none; background:rgba(0,0,0,0.06); color:${C.ink}; font-size:15px; cursor:pointer; }
      .ab-chat-close:hover { background:rgba(0,0,0,0.12); }

      /* RESPONSIVE */
      @media (max-width:900px) {
        .ab-hero { min-height:auto; padding:120px 0 60px; }
        .ab-hero-inner { grid-template-columns:1fr; gap:10px; }
        .ab-hero-portraits { height:300px; order:2; margin-top:20px; }
        .ab-hero-copy { order:1; }
        .ab-portrait { width:44%; }
        .ab-founder-grid, .ab-founder.flip .ab-founder-grid { grid-template-columns:1fr; }
        .ab-founder.flip .ab-founder-media { order:0; }
        .ab-founder-media { max-width:380px; }
        .ab-mindset-grid { grid-template-columns:1fr; }
        .ab-broken-grid { grid-template-columns:1fr; }
        .ab-tabs { height:300px; }
        .ab-brokers-cards { grid-template-columns:1fr; }
        .ab-blinkit-grid { grid-template-columns:1fr; }
        .ab-problems-grid { grid-template-columns:1fr; }
        .ab-values { grid-template-columns:1fr 1fr; }
        .ab-scrollcue { display:none; }
      }
      @media (max-width:520px) {
        .ab-values { grid-template-columns:1fr; }
        .ab-reals { gap:9px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .ab-scrollcue svg, .ab-fw-arc { animation:none; }
      }
    `}</style>
  );
}
