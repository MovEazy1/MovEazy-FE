// src/components/sections/CoreValues.jsx
import { motion } from "framer-motion";
import bgTransparency from "../../assets/images/Background.png";
import bgEmpowerment  from "../../assets/images/Background__1_.png";
import bgCommunity    from "../../assets/images/Background__2_.png";

const EASE = [0.22, 1, 0.36, 1];
const SPRING = { type: "spring", stiffness: 280, damping: 24 };

/** Character-by-character reveal with 3D perspective flip */
function SplitChars({ text, delay = 0, stagger = 0.05, className = "" }) {
  return (
    <span className={className} style={{ display: "inline-block" }}>
      {text.split("").map((char, i) => (
        <motion.span
          key={i}
          style={{ display: "inline-block", transformOrigin: "50% 60%", perspective: 600 }}
          initial={{ opacity: 0, rotateX: -80, y: 12 }}
          whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: delay + i * stagger, ease: EASE }}
        >
          {char === " " ? " " : char}
        </motion.span>
      ))}
    </span>
  );
}

const VALUES = [
  {
    bg:    bgTransparency,
    title: "Radical Transparency",
    desc:  "No hidden fees, no ghost listings, and no fake reviews. We believe clarity is the foundation of trust during a move.",
    delay: 0,
    accent: "#EF4444",
  },
  {
    bg:    bgEmpowerment,
    title: "Empowerment",
    desc:  "We give you the tools and data to make informed decisions. Your move, your rules, powered by our intelligence.",
    delay: 0.12,
    accent: "#7C3AED",
  },
  {
    bg:    bgCommunity,
    title: "Community First",
    desc:  "A home is more than four walls. We connect you to the local pulse and the people who make a city feel alive.",
    delay: 0.24,
    accent: "#0EA5E9",
  },
];

function ValueCard({ bg, title, desc, delay, accent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      whileHover={{ y: -6, boxShadow: "0 16px 48px rgba(0,0,0,0.12)", transition: { duration: 0.28 } }}
      className="bg-white rounded-2xl p-7 sm:p-8 shadow-[0_2px_24px_rgba(0,0,0,0.06)] flex flex-col gap-5 cursor-default overflow-hidden relative"
    >
      {/* Accent bar that slides in from left */}
      <motion.div
        className="absolute top-0 left-0 h-[3px] rounded-br-full"
        style={{ background: accent }}
        initial={{ width: 0 }}
        whileInView={{ width: "40%" }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay: delay + 0.35, ease: EASE }}
        aria-hidden
      />

      {/* Icon tile — spin-in */}
      <motion.div
        className="w-[58px] h-[58px] rounded-[14px] overflow-hidden flex-shrink-0"
        initial={{ opacity: 0, rotate: -12, scale: 0.7 }}
        whileInView={{ opacity: 1, rotate: 0, scale: 1 }}
        viewport={{ once: true }}
        transition={{ ...SPRING, delay: delay + 0.18 }}
      >
        <img src={bg} alt="" aria-hidden className="w-full h-full object-cover" />
      </motion.div>

      <div>
        {/* Title — word split */}
        <h3 className="text-[17px] font-bold text-[#1E2A3A] mb-2 leading-snug">
          {title.split(" ").map((word, i) => (
            <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", marginRight: "0.28em" }}>
              <motion.span
                style={{ display: "inline-block" }}
                initial={{ y: "100%" }}
                whileInView={{ y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: delay + 0.3 + i * 0.07, ease: EASE }}
              >
                {word}
              </motion.span>
            </span>
          ))}
        </h3>

        {/* Desc — blur fade */}
        <motion.p
          className="text-[14px] text-gray-500 leading-[1.82]"
          initial={{ opacity: 0, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: delay + 0.45, ease: EASE }}
        >
          {desc}
        </motion.p>
      </div>
    </motion.div>
  );
}

export default function CoreValues() {
  return (
    <section className="relative w-full bg-[#F2F2FB] py-24 lg:py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">

        {/* ── Badge ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ ...SPRING, delay: 0 }}
          className="mb-5"
        >
          <span className="inline-block rounded-full px-4 py-1.5 bg-white border border-purple-100 text-purple-500 text-[11px] font-semibold uppercase tracking-[0.14em]">
            Our Values
          </span>
        </motion.div>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="max-w-[560px] mb-14">
          {/* Char-by-char heading */}
          <h2 className="text-[32px] sm:text-[40px] lg:text-[50px] font-extrabold text-[#1E2A3A] leading-[1.1] tracking-tight">
            <SplitChars text="Values that" delay={0.05} stagger={0.045} />
            <br />
            <SplitChars text="guide us" delay={0.65} stagger={0.055} />
          </h2>

          {/* Subtitle — clip-path left→right */}
          <motion.p
            initial={{ clipPath: "inset(0 100% 0 0)", opacity: 0 }}
            whileInView={{ clipPath: "inset(0 0% 0 0)", opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.9, delay: 0.15, ease: EASE }}
            className="mt-4 text-[15.5px] text-gray-500 leading-[1.82]"
          >
            Integrity isn't a checkbox; it's our operating system. We believe
            in building a platform that puts the resident first, always.
          </motion.p>
        </div>

        {/* ── Value Cards ────────────────────────────────────────────── */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {VALUES.map((v) => (
            <ValueCard key={v.title} {...v} />
          ))}
        </div>

      </div>
    </section>
  );
}
