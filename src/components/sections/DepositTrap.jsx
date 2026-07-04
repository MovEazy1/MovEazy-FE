// src/components/sections/DepositTrap.jsx
import { motion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.65, delay, ease: EASE },
});

export default function DepositTrap() {
  return (
    <section className="bg-[#111111] py-16 sm:py-20 lg:py-24">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-10">
        <div className="grid lg:grid-cols-2 gap-14 lg:gap-16 items-center">

          {/* ── LEFT: Text ────────────────────────────────────────────── */}
          <div>
            <motion.h2
              {...fadeUp(0)}
              className="
                text-[28px] sm:text-[34px] lg:text-[40px]
                font-extrabold text-white
                leading-[1.1] tracking-tight
              "
            >
              The Deposit Trap
            </motion.h2>

            <motion.p
              {...fadeUp(0.1)}
              className="mt-6 text-[14px] sm:text-[15px] text-gray-400 leading-[1.85] max-w-[460px]"
            >
              Landlords and property managers frequently exploit the lack of legal
              oversight during move-outs. Standard practice often involves arbitrary
              20–30% deductions for "routine maintenance" that should fall under fair
              wear and tear.
            </motion.p>

            <motion.div {...fadeUp(0.2)} className="mt-7">
              <a
                href="#"
                className="
                  inline-flex items-center gap-2
                  text-[13px] font-semibold uppercase tracking-[0.1em]
                  text-white border-b border-white/40
                  hover:border-white transition-colors duration-150 pb-0.5
                "
              >
                Read The Case Study
              </a>
            </motion.div>
          </div>

          {/* ── RIGHT: Metric Cards ───────────────────────────────────── */}
          <div className="flex flex-col gap-4">

            {/* White card — METRIC 01 */}
            <motion.div
              initial={{ opacity: 0, x: 28 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.6, delay: 0, ease: EASE }}
              className="
                bg-white rounded-2xl px-7 py-6
                shadow-[0_4px_32px_rgba(0,0,0,0.18)]
              "
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-3">
                Metric 01
              </p>
              <p className="text-[42px] sm:text-[52px] font-extrabold text-[#1E2A3A] leading-none">
                12%
              </p>
              <p className="mt-2 text-[14px] text-gray-500 font-medium">Average Loss</p>
            </motion.div>

            {/* Red card — METRIC 02 */}
            <motion.div
              initial={{ opacity: 0, x: 28 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.6, delay: 0.12, ease: EASE }}
              className="
                rounded-2xl px-7 py-6
                shadow-[0_4px_32px_rgba(239,68,68,0.25)]
              "
              style={{ background: "linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)" }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60 mb-3">
                Metric 02
              </p>
              <p className="text-[42px] sm:text-[52px] font-extrabold text-white leading-none">
                Zero
              </p>
              <p className="mt-2 text-[14px] text-white/80 font-medium">Legal Recourse</p>
            </motion.div>

          </div>
        </div>
      </div>
    </section>
  );
}
