// src/components/sections/StorySection.jsx
import { motion } from "framer-motion";
import vector20 from "../../assets/images/Vector_20.png";

const EASE = [0.22, 1, 0.36, 1];

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Word-split slide-up with overflow:hidden mask */
function SplitWords({ text, delay = 0, stagger = 0.07, className = "" }) {
  const words = text.split(" ");
  return (
    <span className={className} style={{ display: "inline" }}>
      {words.map((word, i) => (
        <span
          key={i}
          style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", marginRight: "0.28em" }}
        >
          <motion.span
            style={{ display: "inline-block" }}
            initial={{ y: "105%", opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: delay + i * stagger, ease: EASE }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** Each word fades in + drifts up one by one */
function WordFade({ text, delay = 0, stagger = 0.04, className = "" }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          style={{ display: "inline-block" }}
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.45, delay: delay + i * stagger, ease: EASE }}
        >
          {word}&nbsp;
        </motion.span>
      ))}
    </span>
  );
}

export default function StorySection() {
  return (
    <section className="relative w-full min-h-screen bg-[#F7F7F7] overflow-hidden py-24 lg:py-36">

      {/* Decorative wave — scale in */}
      <motion.img
        src={vector20}
        alt=""
        aria-hidden="true"
        initial={{ opacity: 0, scale: 0.92, y: 40 }}
        whileInView={{ opacity: 1, scale: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, ease: EASE }}
        className="absolute bottom-0 right-0 w-[100%] pointer-events-none select-none"
      />

      <div className="relative max-w-[720px] mx-auto px-6 text-center">

        {/* ── Eyebrow badge — bounce in ──────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0 }}
          className="mb-8 inline-flex items-center gap-2"
        >
          <span className="inline-block rounded-full px-4 py-1.5 bg-white border border-gray-200 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.14em] shadow-sm">
            Our Story
          </span>
        </motion.div>

        {/* ── Headline — word-split ──────────────────────────────── */}
        <h2 className="text-[32px] sm:text-[40px] lg:text-[50px] font-extrabold text-[#1E2A3A] leading-[1.1] tracking-tight">
          <SplitWords text="The struggle of" delay={0} stagger={0.09} />
          <br />
          {/* "starting over" in red, char-by-char */}
          {["s", "t", "a", "r", "t", "i", "n", "g", " ", "o", "v", "e", "r", "."].map((char, i) => (
            <motion.span
              key={i}
              style={{ display: "inline-block" }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: 0.55 + i * 0.04, ease: EASE }}
              className="text-[#EF4444]"
            >
              {char === " " ? " " : char}
            </motion.span>
          ))}
        </h2>

        {/* ── Para 1 — word-by-word fade ─────────────────────────── */}
        <div className="mt-10 text-[16px] sm:text-[17px] text-gray-500 leading-[1.88]">
          <WordFade
            text="MovEazy was born in the middle of a chaotic relocation. Our founders spent weeks navigating fragmented websites, unreliable brokers, and the crushing isolation of a new city where they knew no one."
            delay={0.25}
            stagger={0.025}
          />
        </div>

        {/* ── Para 2 — blur-in ───────────────────────────────────── */}
        <motion.p
          initial={{ opacity: 0, filter: "blur(8px)", y: 16 }}
          whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
          className="mt-6 text-[16px] sm:text-[17px] text-gray-500 leading-[1.88]"
        >
          We realized that while logistics were handled by moving trucks, the{" "}
          <motion.strong
            initial={{ backgroundColor: "rgba(239,68,68,0)", color: "#1E2A3A" }}
            whileInView={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#EF4444" }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
            className="font-semibold rounded px-1"
          >
            human element
          </motion.strong>{" "}
          of settling in was completely ignored. We didn't just want a service
          that moved furniture; we wanted a digital concierge that understood
          the anxiety of finding the right neighborhood and the joy of finding
          the right flatmate.
        </motion.p>

        {/* ── Pull quote — clip-path left→right reveal ───────────── */}
        <div className="mt-10 relative">
          {/* Left border line that draws down */}
          <motion.div
            className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-[#EF4444] origin-top"
            initial={{ scaleY: 0, opacity: 0 }}
            whileInView={{ scaleY: 1, opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
          />
          <motion.blockquote
            initial={{ clipPath: "inset(0 100% 0 0)", opacity: 0 }}
            whileInView={{ clipPath: "inset(0 0% 0 0)", opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.85, delay: 0.25, ease: EASE }}
            className="pl-5 text-[16px] sm:text-[17.5px] font-semibold italic text-[#EF4444] leading-[1.72] text-left"
          >
            "We built what we wished we had: a bridge to a better life, not just
            a better apartment."
          </motion.blockquote>
        </div>

      </div>
    </section>
  );
}
