// src/components/sections/CityCTA.jsx
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useInView } from "react-intersection-observer";
import cityBg from "../../assets/images/city-bg.png";

const EASE = [0.22, 1, 0.36, 1];

export default function CityCTA() {
  const { ref, inView } = useInView({ threshold: 0.2, triggerOnce: true });
  const navigate = useNavigate();

  return (
    <section className="bg-white py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div
          ref={ref}
          className="relative w-full rounded-2xl lg:rounded-3xl overflow-hidden min-h-[360px] sm:min-h-[420px] lg:min-h-[480px] flex items-center justify-center"
        >
          {/* Background image */}
          <img
            src={cityBg}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover object-center select-none"
            draggable={false}
          />

          {/* Gradient overlay — richer than flat dark */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(135deg, rgba(10,5,20,0.72) 0%, rgba(50,10,10,0.65) 40%, rgba(10,15,40,0.60) 100%)",
            }}
            aria-hidden="true"
          />

          {/* Ambient glow blobs over the image */}
          <div
            className="absolute top-0 left-0 w-64 h-64 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(232,90,79,0.30) 0%, transparent 70%)",
              animation: "float-slow 9s ease-in-out infinite",
            }}
            aria-hidden="true"
          />
          <div
            className="absolute bottom-0 right-0 w-56 h-56 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(14,165,233,0.20) 0%, transparent 70%)",
              animation: "float-slow 11s ease-in-out infinite 2s",
            }}
            aria-hidden="true"
          />

          {/* Content */}
          <div className="relative z-10 text-center px-6 sm:px-10 py-16 sm:py-20 max-w-3xl mx-auto">
            <motion.h2
              initial={{ opacity: 0, y: 28 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.65, ease: EASE }}
              className="text-[30px] sm:text-[42px] lg:text-[52px] font-extrabold text-white leading-[1.1] tracking-tight"
            >
              Your New City Doesn't
              <br />
              <span
                style={{
                  background: "linear-gradient(110deg, #fca5a5, #fdba74, #f9a8d4)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                }}
              >
                Have to Be Stressful
              </span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.12, ease: EASE }}
              className="mt-5 text-[14.5px] sm:text-[16px] text-white/75 leading-[1.75] max-w-xl mx-auto"
            >
              Stop wasting time on listings, confusion, and unreliable brokers.
              <br className="hidden sm:block" />
              MovEazy helps you find the right home faster — with complete clarity and protection.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.24, ease: EASE }}
              className="mt-8"
            >
              <motion.button
                onClick={() => navigate("/map")}
                className="px-8 sm:px-10 py-[14px] sm:py-[15px] text-[14.5px] sm:text-[15px] font-semibold text-white rounded-full btn-glow-pulse"
                style={{
                  background: "linear-gradient(135deg, #e85a4f 0%, #f97316 100%)",
                }}
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.97 }}
              >
                Start Your Move →
              </motion.button>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
