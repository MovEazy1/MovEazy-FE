// src/components/sections/GuaranteeHowItWorks.jsx
import { motion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1];

const STEPS = [
  {
    number: "01",
    title: "Legal Audit of Contract",
    desc: "We scrub your rental agreement for illegal clauses and hidden charges before you sign or move out.",
  },
  {
    number: "02",
    title: "Document Verification",
    desc: "Comprehensive inventory mapping and photo-evidence logging to prevent \"new damage\" claims.",
  },
  {
    number: "03",
    title: "Direct Negotiation",
    desc: "Our team handles the communication with your landlord to ensure professional, legal dispute resolution.",
  },
];

export default function GuaranteeHowItWorks() {
  return (
    <section className="bg-white py-20 sm:py-24 lg:py-28">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-14 sm:mb-16"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3">
            Our Method
          </p>
          <h2
            className="
              text-[26px] sm:text-[34px] lg:text-[42px]
              font-extrabold text-[#1E2A3A]
              leading-[1.1] tracking-tight uppercase
            "
          >
            Structural Shield: How It Works
          </h2>
        </motion.div>

        {/* Steps grid */}
        <div className="grid sm:grid-cols-3 gap-10 sm:gap-8 lg:gap-12">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: EASE }}
              className="flex flex-col"
            >
              {/* Number */}
              <span
                className="
                  text-[13px] font-semibold
                  text-gray-400 tracking-[0.08em] mb-2 select-none
                "
              >
                {step.number}
              </span>

              {/* Title */}
              <h3 className="text-[17px] sm:text-[18px] font-bold text-[#1E2A3A] leading-snug mb-3">
                {step.title}
              </h3>

              {/* Description */}
              <p className="text-[14px] sm:text-[14.5px] text-gray-500 leading-[1.82]">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
