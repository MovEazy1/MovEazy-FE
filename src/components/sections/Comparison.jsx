// src/components/sections/Comparison.jsx
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";

const EASE = [0.22, 1, 0.36, 1];

const ROWS = [
  { label: "Approach",       others: "You figure it out",              moveasy: "We guide you" },
  { label: "Listings",       others: "Outdated / overpriced listings",  moveasy: "No listings, real broker access" },
  { label: "Speed",          others: "You miss good options",           moveasy: "Fast-moving, real-time homes" },
  { label: "Support",        others: "DIY process",                     moveasy: "End-to-end help" },
  { label: "Deposit Safety", others: "No protection",                   moveasy: "Protected with legal support" },
  { label: "Experience",     others: "Confusing & time-consuming",      moveasy: "Stress-free" },
];

export default function Comparison() {
  const { ref, inView } = useInView({ threshold: 0.08, triggerOnce: true });

  return (
    <section
      className="py-20 sm:py-24 lg:py-28"
      style={{
        background: "linear-gradient(145deg, #0a0a0f 0%, #111111 50%, #0f0808 100%)",
      }}
    >
      {/* Ambient glow blobs */}
      <div className="max-w-5xl mx-auto px-6 lg:px-10 relative">
        <div
          className="absolute -top-20 left-1/4 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(232,90,79,0.12) 0%, transparent 70%)" }}
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-20 right-1/4 w-56 h-56 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%)" }}
          aria-hidden="true"
        />

        {/* Heading */}
        <motion.div
          className="text-center mb-14 sm:mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <h2 className="text-[28px] sm:text-[38px] lg:text-[46px] font-extrabold leading-[1.1] tracking-tight">
            <span className="text-white">Stop Searching. </span>
            <span className="gradient-text">Start Moving Smart.</span>
          </h2>
          <p className="mt-4 text-[14.5px] sm:text-[15.5px] text-gray-500">
            Why MovEazy works better than traditional platforms
          </p>
        </motion.div>

        {/* Table */}
        <div ref={ref}>

          {/* Column headers — desktop only */}
          <div className="hidden lg:grid grid-cols-[180px_1fr_1fr] mb-2 px-2">
            <div />
            <div className="text-[15px] font-semibold text-gray-400 text-center pb-2">Other Platforms</div>
            <div
              className="text-[15px] font-semibold pl-8 pb-2 gradient-text"
            >
              MovEazy
            </div>
          </div>

          {/* Rows */}
          <div className="relative">
            {/* Gradient backdrop for MovEazy column — desktop */}
            <div
              aria-hidden="true"
              className="hidden lg:block absolute top-0 right-20 w-[calc(32%)] h-full rounded-2xl z-0 overflow-hidden"
              style={{
                background: "linear-gradient(145deg, rgba(53,1,1,0.85), rgba(185,28,28,0.70))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              {/* Shimmer sweep */}
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 3s linear infinite",
                }}
              />
            </div>

            <div className="relative z-10">
              {ROWS.map((row, i) => (
                <motion.div
                  key={row.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.05 + i * 0.07, ease: EASE }}
                  className="flex flex-col lg:grid lg:grid-cols-[180px_1fr_1fr] lg:items-center py-5 lg:py-0 gap-2 lg:gap-0 border-b border-white/5 last:border-0"
                >
                  {/* Label */}
                  <div className="text-[13.5px] sm:text-[14px] text-gray-600 font-medium lg:py-5">
                    {row.label}
                  </div>

                  {/* Others */}
                  <div className="text-[14.5px] sm:text-[15px] text-gray-400 lg:py-5 lg:text-center">
                    <span className="lg:hidden text-gray-600 text-[12px] font-medium mr-2">Others:</span>
                    {row.others}
                  </div>

                  {/* MovEazy */}
                  <div
                    className="text-[14.5px] sm:text-[15px] font-semibold text-white flex items-start lg:py-5 lg:pl-8 bg-gradient-to-br from-[#350101]/90 to-[#b91c1c]/70 lg:bg-none rounded-lg lg:rounded-none px-4 py-3 lg:px-0 lg:py-0"
                  >
                    <span
                      className="mr-2.5 text-[13px] flex-shrink-0 mt-[2px]"
                      style={{ color: "#ff8a7a" }}
                    >
                      ✦
                    </span>
                    {row.moveasy}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
