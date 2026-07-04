// src/components/sections/ServicesHero.jsx
import { motion } from "framer-motion";
import cozyLivingRoom from "../../assets/images/Cozy_modern_living_room.png";
import { useNavigate } from "react-router-dom";

const EASE = [0.22, 1, 0.36, 1];
const SPRING = { type: "spring", stiffness: 320, damping: 28 };

// ── helpers ────────────────────────────────────────────────────────────────────

/** Wraps each word in an overflow:hidden mask so it slides up cleanly */
function SplitWords({ text, className, delay = 0, stagger = 0.08, once = true }) {
  const words = text.split(" ");
  return (
    <span className={className} style={{ display: "inline" }}>
      {words.map((word, i) => (
        <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", marginRight: "0.28em" }}>
          <motion.span
            style={{ display: "inline-block" }}
            initial={{ y: "110%", opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once, margin: "-40px" }}
            transition={{ duration: 0.65, delay: delay + i * stagger, ease: EASE }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 && " "}
        </span>
      ))}
    </span>
  );
}

/** Reveals each character individually — for short dramatic words */
function SplitChars({ text, className, delay = 0, stagger = 0.045, once = true }) {
  const chars = text.split("");
  return (
    <span className={className} style={{ display: "inline-block" }}>
      {chars.map((char, i) => (
        <motion.span
          key={i}
          style={{ display: "inline-block", transformOrigin: "50% 100%" }}
          initial={{ opacity: 0, y: 28, rotateX: -60 }}
          whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
          viewport={{ once, margin: "-40px" }}
          transition={{ duration: 0.5, delay: delay + i * stagger, ease: EASE }}
        >
          {char === " " ? " " : char}
        </motion.span>
      ))}
    </span>
  );
}

/** SVG underline that draws itself left → right */
function DrawUnderline({ delay = 0, color = "#EF4444", width = "100%", height = 6 }) {
  return (
    <svg
      viewBox="0 0 200 8"
      preserveAspectRatio="none"
      style={{ width, height, display: "block" }}
      aria-hidden
    >
      <motion.path
        d="M0 5 Q50 2 100 5 Q150 8 200 5"
        stroke={color}
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.75, delay, ease: EASE }}
      />
    </svg>
  );
}

// ── component ──────────────────────────────────────────────────────────────────
export default function ServicesHero() {
  const navigate = useNavigate();

  return (
    <section className="relative w-full overflow-hidden bg-white pt-24 sm:pt-28 lg:pt-32 pb-14 sm:pb-16">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-10 items-center">

          {/* ── LEFT CONTENT ──────────────────────────────────────────── */}
          <div className="max-w-[560px]">

            {/* Badge — spring bounce in */}
            <motion.div
              initial={{ opacity: 0, scale: 0.7, y: 10 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ ...SPRING, delay: 0 }}
            >
              <span className="inline-block rounded-full px-4 py-1.5 bg-[#FDECEA] text-[#EF4444] text-[11px] font-semibold uppercase tracking-[0.12em]">
                Our Mission
              </span>
            </motion.div>

            {/* Headline — word-split "Moving Made" + char-reveal "Human" */}
            <h1 className="mt-5 text-[38px] leading-[1.08] sm:text-[52px] lg:text-[62px] font-extrabold tracking-tight text-[#1E2A3A]">
              <span className="block">
                <SplitWords text="Moving Made" delay={0.08} stagger={0.1} />
              </span>
              {/* "Human" — char-by-char with 3D flip, plus animated underline */}
              <span className="block relative w-fit mt-1">
                <SplitChars text="Human" delay={0.32} stagger={0.06} className="text-[#EF4444]" />
                <DrawUnderline delay={0.72} color="#EF4444" width="100%" height={5} />
              </span>
            </h1>

            {/* Body — blur → clear */}
            <motion.p
              initial={{ opacity: 0, filter: "blur(10px)", y: 12 }}
              whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.8, delay: 0.62, ease: EASE }}
              className="mt-5 max-w-[480px] text-[15px] sm:text-[16px] leading-[1.85] text-gray-500"
            >
              Relocation isn't just about moving boxes; it's about starting a
              new chapter. MovEazy simplifies the journey through empathy,
              technology, and a deep understanding of what makes a place feel
              like home.
            </motion.p>

            {/* Buttons — spring stagger */}
            <div className="mt-8 flex flex-wrap gap-4">
              {[
                {
                  label: "Browse Listings",
                  onClick: () => navigate("/new-listings"),
                  primary: true,
                },
                {
                  label: "Contact & support",
                  onClick: () => navigate("/contact"),
                  primary: false,
                },
              ].map(({ label, onClick, primary }, i) => (
                <motion.button
                  key={label}
                  type="button"
                  onClick={onClick}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ ...SPRING, delay: 0.72 + i * 0.1 }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  className={
                    primary
                      ? "rounded-full px-7 py-3 text-[14px] font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] transition-colors duration-200 shadow-[0_10px_28px_rgba(239,68,68,0.25)]"
                      : "rounded-full px-7 py-3 text-[14px] font-semibold text-[#EF4444] bg-[#FDECEA] hover:bg-[#fbd9d7] transition-colors duration-200"
                  }
                >
                  {label}
                </motion.button>
              ))}
            </div>
          </div>

          {/* ── RIGHT IMAGE — scale + fade ─────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 28 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.9, delay: 0.18, ease: EASE }}
            className="flex justify-center lg:justify-end"
          >
            <motion.div
              whileHover={{ scale: 1.02, rotate: 0.5 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-full max-w-[280px] sm:max-w-[360px] md:max-w-[420px] lg:max-w-[440px] xl:max-w-[470px] rounded-[26px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.12)]"
            >
              <img
                src={cozyLivingRoom}
                alt="Cozy modern living room"
                className="w-full h-auto object-cover"
                draggable={false}
              />
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
