// src/components/sections/BuiltMoveazy.jsx
import { motion } from "framer-motion";
import { Search, Headphones, ArrowRightLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const EASE = [0.22, 1, 0.36, 1];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 36 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.7, delay, ease: EASE },
});

const FEATURES = [
  {
    Icon: Search,
    title: "Verified Listings",
    desc: "Browse real, verified listings — not expired posts or ghost properties.",
    delay: 0,
    accent: "#EF4444",
    bg: "#FEF2F2",
  },
  {
    Icon: Headphones,
    title: "Concierge Support",
    desc: "Dedicated real estate concierge tailored to your preferences and budget.",
    delay: 0.08,
    accent: "#7C3AED",
    bg: "#F5F3FF",
  },
  {
    Icon: ArrowRightLeft,
    title: "End to End",
    desc: "From listing to lease to move-in — we're with you at every step.",
    delay: 0.16,
    accent: "#0EA5E9",
    bg: "#F0F9FF",
  },
];

export default function BuiltMoveazy() {
  const navigate = useNavigate();
  return (
    <section className="relative w-full bg-white py-20 lg:py-28 overflow-hidden">
      {/* Background mesh */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(239,68,68,0.06) 0%, transparent 60%)",
        }}
        aria-hidden
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
        {/* Heading */}
        <div className="text-center mb-16">
          <motion.p
            {...fadeUp(0)}
            className="text-[11px] font-bold uppercase tracking-[0.14em] text-red-500 mb-4"
          >
            Why MovEazy
          </motion.p>
          <motion.h2
            {...fadeUp(0.06)}
            className="text-[32px] sm:text-[42px] lg:text-[52px] font-extrabold text-[#1E2A3A] leading-[1.08] tracking-tight"
          >
            So we built <span className="text-[#ff3131]">MovEazy</span>.
          </motion.h2>
          <motion.p
            {...fadeUp(0.12)}
            className="mt-4 text-[15px] sm:text-[16px] text-gray-500 leading-[1.82] max-w-[540px] mx-auto"
          >
            A curated relocation experience designed to put your peace of mind first. Honest
            listings, seamless logistics, and a team you'll actually love.
          </motion.p>
        </div>

        {/* Feature Cards */}
        <div className="grid sm:grid-cols-3 gap-6 lg:gap-8 max-w-4xl mx-auto">
          {FEATURES.map(({ Icon, title, desc, delay, accent, bg }) => (
            <motion.div
              key={title}
              {...fadeUp(delay)}
              className="group relative bg-white rounded-2xl border border-gray-100 p-7 shadow-[0_2px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.10)] transition-all duration-300 hover:-translate-y-1"
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: bg }}
              >
                <Icon size={22} style={{ color: accent }} />
              </div>
              <h3 className="text-[15px] font-bold text-[#1E2A3A] mb-2">{title}</h3>
              <p className="text-[13px] text-gray-500 leading-[1.72]">{desc}</p>

              {/* Subtle bottom accent */}
              <div
                className="absolute bottom-0 left-6 right-6 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: accent }}
                aria-hidden
              />
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div {...fadeUp(0.24)} className="mt-12 flex justify-center">
          <button
            type="button"
            onClick={() => navigate("/services")}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-gray-200 text-[14px] font-semibold text-[#1E2A3A] hover:border-red-300 hover:text-red-500 transition-all duration-200"
          >
            Learn how it works
            <span className="text-[#ff3131]">→</span>
          </button>
        </motion.div>
      </div>
    </section>
  );
}
