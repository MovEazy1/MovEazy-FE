// src/components/sections/ServiceRecap.jsx
import { motion } from "framer-motion";
import iconConsultation from "../../assets/images/Icon__3_.png";
import iconBroker       from "../../assets/images/Icon__2_.png";
import iconMap          from "../../assets/images/Icon__1_.png";
import iconFlatmate     from "../../assets/images/Icon.png";

const EASE = [0.22, 1, 0.36, 1];
const SPRING = { type: "spring", stiffness: 280, damping: 22 };

/** Word-split with overflow:hidden mask */
function SplitWords({ text, delay = 0, stagger = 0.08, className = "" }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", marginRight: "0.28em" }}>
          <motion.span
            style={{ display: "inline-block" }}
            initial={{ y: "105%", opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6, delay: delay + i * stagger, ease: EASE }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

const SERVICES = [
  {
    icon:  iconConsultation,
    title: "Personalized Consultation",
    desc:  "Expert guidance from those who've walked the path before.",
    bg:    "bg-white",
    delay: 0,
    xFrom: -50,
  },
  {
    icon:  iconBroker,
    title: "Broker Connections",
    desc:  "Access to vetted, trustworthy local real estate partners.",
    bg:    "bg-[#FFF0EE]",
    delay: 0.08,
    xFrom: 50,
  },
  {
    icon:  iconMap,
    title: "Intelligent Map Search",
    desc:  "Neighborhood data that matters: commute, vibe, and safety.",
    bg:    "bg-[#FFF0EE]",
    delay: 0.16,
    xFrom: -50,
  },
  {
    icon:  iconFlatmate,
    title: "Flatmate Matching",
    desc:  "Find the people you'll actually enjoy sharing breakfast with.",
    bg:    "bg-white",
    delay: 0.24,
    xFrom: 50,
  },
];

const CHECKPOINTS = [
  "Seamless tech-driven logistics combined with high-touch human support.",
  "Real-time neighborhood analysis to match your lifestyle, not just your budget.",
];

function ServiceCard({ icon, title, desc, bg, delay, xFrom }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: xFrom, y: 20 }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.65, delay, ease: EASE }}
      whileHover={{ scale: 1.03, y: -3, transition: { duration: 0.25 } }}
      className={`${bg} rounded-2xl p-5 sm:p-6 border border-white/70 shadow-[0_2px_18px_rgba(0,0,0,0.06)] overflow-hidden`}
    >
      {/* Icon — bounce in */}
      <motion.img
        src={icon}
        alt=""
        aria-hidden
        className="w-7 h-7 object-contain mb-4"
        initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
        whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
        viewport={{ once: true }}
        transition={{ ...SPRING, delay: delay + 0.2 }}
      />

      {/* Title — word split */}
      <h3 className="text-[15px] font-bold text-[#1E2A3A] leading-snug mb-2">
        {title.split(" ").map((word, i) => (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", marginRight: "0.28em" }}>
            <motion.span
              style={{ display: "inline-block" }}
              initial={{ y: "100%" }}
              whileInView={{ y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: delay + 0.28 + i * 0.06, ease: EASE }}
            >
              {word}
            </motion.span>
          </span>
        ))}
      </h3>

      {/* Desc — blur fade */}
      <motion.p
        className="text-[13px] text-gray-500 leading-[1.78]"
        initial={{ opacity: 0, filter: "blur(5px)" }}
        whileInView={{ opacity: 1, filter: "blur(0px)" }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: delay + 0.42, ease: EASE }}
      >
        {desc}
      </motion.p>
    </motion.div>
  );
}

export default function ServiceRecap() {
  return (
    <section className="relative w-full bg-[#FEF2F0] py-24 lg:py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="grid lg:grid-cols-2 items-center gap-12 lg:gap-20">

          {/* ── Left: 2×2 Service Cards ──────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            {SERVICES.map((s) => (
              <ServiceCard key={s.title} {...s} />
            ))}
          </div>

          {/* ── Right: Narrative ────────────────────────────────────── */}
          <div>
            {/* Heading — word split, two lines */}
            <h2 className="text-[30px] sm:text-[36px] lg:text-[44px] font-extrabold text-[#1E2A3A] leading-[1.14] tracking-tight">
              <span className="block">
                <SplitWords text="Integrated support" delay={0} stagger={0.1} />
              </span>
              <span className="block">
                <SplitWords text="for every step." delay={0.28} stagger={0.1} />
              </span>
            </h2>

            {/* Body — clip-path reveal */}
            <motion.p
              initial={{ clipPath: "inset(0 100% 0 0)", opacity: 0 }}
              whileInView={{ clipPath: "inset(0 0% 0 0)", opacity: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.95, delay: 0.15, ease: EASE }}
              className="mt-5 text-[15.5px] text-gray-500 leading-[1.85]"
            >
              We don't provide a list of features; we provide a curated
              journey. From the moment you think about moving to the night you
              host your first housewarming, MovEazy is there.
            </motion.p>

            {/* Checkpoints — slide in + SVG checkmark draw */}
            <ul className="mt-8 space-y-4">
              {CHECKPOINTS.map((point, i) => (
                <motion.li
                  key={point}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.55, delay: 0.3 + i * 0.12, ease: EASE }}
                  className="flex items-start gap-3"
                >
                  {/* Circle with animated SVG path */}
                  <span className="flex-shrink-0 mt-[3px] w-5 h-5 rounded-full bg-[#0E6B4E] flex items-center justify-center">
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <motion.path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="white"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        whileInView={{ pathLength: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.55, delay: 0.5 + i * 0.12, ease: EASE }}
                      />
                    </svg>
                  </span>

                  {/* Text — word fade stagger */}
                  <span className="text-[14.5px] text-gray-600 leading-[1.76]">
                    {point.split(" ").map((word, j) => (
                      <motion.span
                        key={j}
                        style={{ display: "inline-block" }}
                        initial={{ opacity: 0, y: 6 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: 0.38 + i * 0.12 + j * 0.025, ease: EASE }}
                      >
                        {word}&nbsp;
                      </motion.span>
                    ))}
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </section>
  );
}
