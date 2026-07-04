// src/components/sections/GuaranteeHero.jsx
import { motion } from "framer-motion";
import keyhandoverImg from "../../assets/images/guarentee-keyhandover.jpg";
import depositImg from "../../assets/images/guarentee-deposit.png";
import disputeImg from "../../assets/images/guarentee-dispute.png";

const EASE = [0.22, 1, 0.36, 1];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.65, delay, ease: EASE },
});

const FEATURE_LINKS = [
  "Legal-Backed Protection",
  "Fair & Transparent Process",
  "Stress-Free Move-Out",
];

export default function GuaranteeHero({ onCTAClick }) {
  return (
    <section className="relative w-full overflow-hidden bg-white pt-[88px] sm:pt-[96px] lg:pt-[110px] pb-14 sm:pb-16 lg:pb-20">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">

          {/* ── LEFT CONTENT ─────────────────────────────────────────── */}
          <div className="max-w-[600px]">

            {/* Headline */}
            <motion.h1
              {...fadeUp(0)}
              className="
                text-[36px] sm:text-[48px] lg:text-[58px]
                font-extrabold text-[#1E2A3A]
                leading-[1.06] tracking-tight
              "
            >
              From Move Out Stress To Full Deposit — We Handle It
            </motion.h1>

            {/* Subtext */}
            <motion.p
              {...fadeUp(0.1)}
              className="mt-5 text-[15px] sm:text-[16px] text-gray-500 leading-[1.82] max-w-[480px]"
            >
              No More Unfair Deductions, Arguments, Or Hidden Charges
              When You Move Out.
            </motion.p>

            {/* CTA Button + trust line */}
            <motion.div {...fadeUp(0.18)} className="mt-7 flex flex-col gap-3">
              <div>
                <button
                  onClick={onCTAClick}
                  className="
                    px-7 py-[13px] text-[14.5px] font-semibold
                    text-white bg-[#EF4444] rounded-full
                    hover:bg-[#DC2626] active:scale-[0.975]
                    transition-all duration-200
                    shadow-[0_8px_28px_rgba(239,68,68,0.32)]
                  "
                >
                  Get Protected Now
                </button>
              </div>
              <p className="text-[12.5px] text-gray-400">
                Backed by Legal Support &amp; MovEazy Team
              </p>
            </motion.div>

            {/* Stat chips row — plain inline, no card borders */}
            <motion.div
              {...fadeUp(0.26)}
              className="mt-8 flex flex-wrap gap-8"
            >
              {/* Chip 1 */}
              <div>
                <p className="text-[13px] font-bold text-[#1E2A3A]">₹13K+ Saved</p>
                <p className="mt-0.5 text-[11.5px] text-gray-400 max-w-[160px] leading-[1.5]">
                  Average Savings Users Get By Avoiding Unfair Deductions
                </p>
              </div>
              {/* Chip 2 */}
              <div>
                <p className="text-[13px] font-bold text-[#1E2A3A]">100% Protection Focus</p>
                <p className="mt-0.5 text-[11.5px] text-gray-400 max-w-[160px] leading-[1.5]">
                  MovEazy Prioritises Protecting Your Security Deposit With Structured Support And Legal Backing
                </p>
              </div>
            </motion.div>

            {/* Large stat + feature links row */}
            <motion.div
              {...fadeUp(0.34)}
              className="mt-8 flex flex-col sm:flex-row gap-8 sm:gap-10 items-start"
            >
              {/* 300+ stat */}
              <div className="flex-shrink-0 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm text-center min-w-[120px]">
                <p className="text-[32px] font-extrabold text-[#EF4444] leading-none">300+</p>
                <p className="mt-2 text-[11.5px] text-gray-500 leading-[1.55] max-w-[100px] mx-auto">
                  Chose Us As Their Trusted Partner
                </p>
              </div>

              {/* Feature links */}
              <div className="flex flex-col gap-3">
                {FEATURE_LINKS.map((link) => (
                  <a
                    key={link}
                    href="/contact"
                    className="
                      inline-flex items-center gap-2
                      text-[14px] font-medium text-[#1E2A3A]
                      hover:text-[#EF4444] transition-colors duration-150
                      group
                    "
                  >
                    {link}
                    <span className="text-[#EF4444] group-hover:translate-x-1 transition-transform duration-150">
                      →
                    </span>
                  </a>
                ))}
              </div>
            </motion.div>
          </div>

          {/* ── RIGHT VISUAL ─────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: 28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="flex justify-center lg:justify-end w-full"
          >
            {/*
              Figma layout — use a grid approach:
              Row 1: [empty left 42%] [img1 right 58%]
              Row 2: [badge centered ~110px] with dashed lines above/below
              Row 3: [img3 left 88%] [empty right 12%]
            */}
            <div className="relative w-full max-w-[320px] sm:max-w-[380px] lg:max-w-[440px]">

              {/* Row 1: img1 pushed to the right */}
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
                className="flex justify-end"
              >
                <div className="w-[55%] rounded-[16px] overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.12)] bg-[#f5f0eb]">
                  <img
                    src={keyhandoverImg}
                    alt="Tenant handing over keys"
                    className="w-full h-auto object-contain"
                    draggable={false}
                  />
                </div>
              </motion.div>

              {/* Connector 1: L-shaped — vertical down from img1 center, then horizontal left to badge */}
              <svg
                className="w-full h-10"
                viewBox="0 0 440 40"
                preserveAspectRatio="xMidYMid meet"
                fill="none"
                aria-hidden="true"
              >
                {/* Vertical drop from ~73% (center of img1) down */}
                <line x1="320" y1="0" x2="320" y2="24" stroke="#D1D5DB" strokeWidth="1.5" />
                {/* Horizontal line going left to ~50% (badge center) */}
                <line x1="320" y1="24" x2="220" y2="24" stroke="#D1D5DB" strokeWidth="1.5" />
                {/* Dot at the bend */}
                <circle cx="320" cy="24" r="2.5" fill="#9CA3AF" />
                {/* Dot at the end (badge top) */}
                <circle cx="220" cy="24" r="2.5" fill="#9CA3AF" />
              </svg>

              {/* Row 2: badge — offset left to match Figma zigzag */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3, ease: EASE }}
                className="flex justify-center -translate-x-[14%]"
              >
                <div className="drop-shadow-xl" style={{ width: "100px" }}>
                  <img
                    src={depositImg}
                    alt="100% Deposit Return Guarantee"
                    className="w-full h-auto"
                    draggable={false}
                  />
                </div>
              </motion.div>

              {/* Connector 2: L-shaped — vertical down from badge center, then horizontal right to img3 */}
              <svg
                className="w-full h-10"
                viewBox="0 0 440 40"
                preserveAspectRatio="xMidYMid meet"
                fill="none"
                aria-hidden="true"
              >
                {/* Vertical drop from badge center (~50% - offset = ~40%) */}
                <line x1="190" y1="0" x2="190" y2="16" stroke="#D1D5DB" strokeWidth="1.5" />
                {/* Horizontal line going right to ~32% (img3 top-center area) */}
                <line x1="190" y1="16" x2="300" y2="16" stroke="#D1D5DB" strokeWidth="1.5" />
                {/* Dot at the bend */}
                <circle cx="190" cy="16" r="2.5" fill="#9CA3AF" />
                {/* Dot at the end (img3 top) */}
                <circle cx="300" cy="16" r="2.5" fill="#9CA3AF" />
              </svg>

              {/* Row 3: img3 pushed to the left — wider, more left-shifted than img1 */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.65, delay: 0.5, ease: EASE }}
                className="flex justify-start -translate-x-[14%]"
              >
                <div className="w-[90%] rounded-[16px] overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.14)]">
                  <img
                    src={disputeImg}
                    alt="MoveAZY agent mediating a deposit dispute"
                    className="w-full h-auto object-cover"
                    draggable={false}
                  />
                </div>
              </motion.div>

            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
