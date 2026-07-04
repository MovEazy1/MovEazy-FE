// src/components/sections/ServicesCTA.jsx
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const EASE = [0.22, 1, 0.36, 1];
const SPRING = { type: "spring", stiffness: 300, damping: 26 };

/** Character-by-character reveal — for the big CTA headline */
function SplitChars({ text, delay = 0, stagger = 0.03, className = "" }) {
  return (
    <span className={className} aria-label={text}>
      {text.split("").map((char, i) => (
        <motion.span
          key={i}
          aria-hidden
          style={{ display: "inline-block" }}
          initial={{ opacity: 0, y: 22, scale: 0.85 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.4, delay: delay + i * stagger, ease: EASE }}
        >
          {char === " " ? " " : char}
        </motion.span>
      ))}
    </span>
  );
}

/** Word-by-word fade for body text */
function WordFade({ text, delay = 0, stagger = 0.035, className = "" }) {
  return (
    <span className={className}>
      {text.split(" ").map((word, i) => (
        <motion.span
          key={i}
          style={{ display: "inline-block" }}
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.4, delay: delay + i * stagger, ease: EASE }}
        >
          {word}&nbsp;
        </motion.span>
      ))}
    </span>
  );
}

export default function ServicesCTA() {
  const navigate = useNavigate();

  return (
    <section className="relative w-full bg-white py-16 lg:py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">

        {/* Card — scale + fade in */}
        <motion.div
          initial={{ opacity: 0, y: 48, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.8, ease: EASE }}
          className="relative rounded-[28px] overflow-hidden px-8 py-16 sm:px-14 sm:py-20 text-center"
          style={{ background: "linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)" }}
        >
          {/* Animated blobs */}
          <motion.div
            aria-hidden
            className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/[0.06] pointer-events-none"
            animate={{ scale: [1, 1.15, 1], rotate: [0, 20, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-black/[0.07] pointer-events-none"
            animate={{ scale: [1, 1.2, 1], rotate: [0, -15, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />

          <div className="relative z-10 max-w-[700px] mx-auto">

            {/* Headline — char by char */}
            <h2 className="text-[28px] sm:text-[38px] lg:text-[50px] font-extrabold text-white leading-[1.1] tracking-tight">
              <SplitChars text="Join our journey" delay={0.1} stagger={0.032} />
              <br />
              <SplitChars text="to better living" delay={0.62} stagger={0.032} />
            </h2>

            {/* Body — word-by-word */}
            <p className="mt-5 text-[15.5px] text-white/80 leading-[1.82]">
              <WordFade
                text="Whether you're moving across town or across the globe, or looking to help us build the future of relocation, we'd love to have you."
                delay={0.25}
                stagger={0.028}
              />
            </p>

            {/* Buttons — spring stagger */}
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              {[
                { label: "Find My Home", path: "/plan", primary: true },
                { label: "Explore listings", path: "/new-listings", primary: false },
              ].map(({ label, path, primary }, i) => (
                <motion.button
                  key={label}
                  type="button"
                  onClick={() => navigate(path)}
                  initial={{ opacity: 0, y: 24, scale: 0.9 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ ...SPRING, delay: 0.35 + i * 0.1 }}
                  whileHover={{ scale: 1.06, y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  className={
                    primary
                      ? "px-8 py-[13px] text-[14.5px] font-semibold text-[#EF4444] bg-white rounded-full hover:bg-gray-50 transition-colors duration-200"
                      : "px-8 py-[13px] text-[14.5px] font-semibold text-white rounded-full border border-white/50 hover:bg-white/10 transition-colors duration-200"
                  }
                >
                  {label}
                </motion.button>
              ))}
            </div>

          </div>
        </motion.div>

      </div>
    </section>
  );
}
