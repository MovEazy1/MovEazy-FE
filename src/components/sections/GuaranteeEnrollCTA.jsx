// src/components/sections/GuaranteeEnrollCTA.jsx
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import secureDepositImg from "../../assets/images/guarentee-secure-deposit.png";

const EASE = [0.22, 1, 0.36, 1];

export default function GuaranteeEnrollCTA({ onCTAClick }) {
  const { ref, inView } = useInView({ threshold: 0.2, triggerOnce: true });

  return (
    <section className="bg-white py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-10">
        <div
          ref={ref}
          className="
            relative w-full
            rounded-2xl lg:rounded-3xl
            overflow-hidden
            min-h-[380px] sm:min-h-[440px] lg:min-h-[500px]
            flex items-center justify-center
          "
        >
          {/* Background — woman at laptop photo */}
          <img
            src={secureDepositImg}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover object-center select-none"
            draggable={false}
          />

          {/* Dark overlay */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(10,10,10,0.58)" }}
            aria-hidden="true"
          />

          {/* Content */}
          <div className="relative z-10 text-center px-6 sm:px-10 py-16 sm:py-20 max-w-3xl mx-auto">

            <motion.h2
              initial={{ opacity: 0, y: 28 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.65, ease: EASE }}
              className="
                text-[30px] sm:text-[44px] lg:text-[56px]
                font-extrabold text-white uppercase
                leading-[1.1] tracking-tight
              "
            >
              Secure Your Deposit Today.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.12, ease: EASE }}
              className="mt-4 text-[14.5px] sm:text-[15.5px] text-white/70 leading-[1.75] max-w-xl mx-auto"
            >
              Join 10,000+ tenants who have reclaimed their deposit, fee-free.
              Bring peace of mind.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.24, ease: EASE }}
              className="mt-9 flex flex-col items-center gap-3"
            >
              <button
                onClick={onCTAClick}
                className="
                  px-10 sm:px-12 py-[14px] sm:py-[16px]
                  text-[14.5px] sm:text-[15px] font-semibold uppercase tracking-[0.08em]
                  text-white bg-[#EF4444] rounded-xl
                  hover:bg-[#DC2626] active:scale-[0.975]
                  transition-all duration-200
                  shadow-[0_8px_32px_rgba(239,68,68,0.42)]
                "
              >
                Deposit Saver
              </button>

              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
                100% Deposit Protection Guaranteed
              </p>
            </motion.div>

          </div>
        </div>
      </div>
    </section>
  );
}
