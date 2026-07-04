// src/components/sections/SavingsBanner.jsx
import { motion } from "framer-motion";
import guaranteeBg from "../../assets/images/guarantee-bg.png";

const EASE = [0.22, 1, 0.36, 1];

const CHIPS = [
  {
    title: "No hidden painting charges",
    desc: "Challenge unlawful 'mandatory' repainting fees.",
  },
  {
    title: "Zero unfair cleaning fees",
    desc: "Normal usage is not professional-level cleaning.",
  },
  {
    title: "Legal backing for wear & tear",
    desc: "Protect yourself against natural usage claims.",
  },
];

// Checkmark SVG
function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="flex-shrink-0 mt-[1px]"
    >
      <circle cx="8" cy="8" r="8" fill="rgba(255,255,255,0.15)" />
      <path
        d="M5 8.5l2 2 4-4"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SavingsBanner() {
  return (
    <section className="relative w-full overflow-hidden">
      {/* Background image */}
      <img
        src={guaranteeBg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover object-center select-none"
        draggable={false}
      />

      <div className="relative z-10 py-20 sm:py-24 lg:py-28">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-10 text-center">

          {/* Headline */}
          <motion.h2
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.65, ease: EASE }}
            className="
              text-[40px] sm:text-[56px] lg:text-[72px]
              font-extrabold text-white
              leading-[1.05] tracking-tight
            "
          >
            SAVE ₹13,000+
          </motion.h2>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
            className="mt-3 text-[14.5px] sm:text-[15.5px] text-white/70"
          >
            Average savings realized per move-out through MovEazy intervention.
          </motion.p>

          {/* Chips */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.65, delay: 0.2, ease: EASE }}
            className="mt-10 grid sm:grid-cols-3 gap-4 text-left"
          >
            {CHIPS.map((chip) => (
              <div
                key={chip.title}
                className="
                  flex items-start gap-3
                  rounded-xl px-5 py-4
                  bg-black/30 backdrop-blur-sm
                  border border-white/10
                "
              >
                <CheckIcon />
                <div>
                  <p className="text-[13.5px] font-semibold text-white leading-snug">
                    {chip.title}
                  </p>
                  <p className="mt-1 text-[12px] text-white/60 leading-[1.6]">
                    {chip.desc}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>

        </div>
      </div>
    </section>
  );
}
