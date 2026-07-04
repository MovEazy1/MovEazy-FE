// src/components/sections/GuaranteePlan.jsx
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useInView } from "react-intersection-observer";
import guaranteeBg from "../../assets/images/guarantee-bg.png";

const EASE = [0.22, 1, 0.36, 1];

export default function GuaranteePlan() {
  const navigate = useNavigate();
  const { ref, inView } = useInView({ threshold: 0.15, triggerOnce: true });

  return (
    <section>
      <div className="max-w-full">
        <div
          ref={ref}
          className="relative w-full overflow-hidden min-h-[360px] sm:min-h-[400px] flex items-center justify-center"
        >
          {/* Wavy red gradient background image */}
          <img
            src={guaranteeBg}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover object-center select-none"
            draggable={false}
          />

          {/* Overlay for premium depth */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(135deg, rgba(100,0,0,0.30) 0%, rgba(0,0,0,0.15) 100%)",
            }}
            aria-hidden="true"
          />

          {/* Floating sparkle orbs */}
          {[
            { size: 180, top: "-10%", left: "5%",   color: "rgba(255,140,130,0.20)", delay: 0 },
            { size: 130, top: "60%",  right: "8%",  color: "rgba(255,200,100,0.15)", delay: 2 },
          ].map((orb, i) => (
            <div
              key={i}
              className="absolute rounded-full pointer-events-none"
              style={{
                width:  orb.size,
                height: orb.size,
                top:    orb.top,
                left:   orb.left,
                right:  orb.right,
                background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
                animation: `float-slow 8s ease-in-out infinite ${orb.delay}s`,
              }}
              aria-hidden="true"
            />
          ))}

          {/* Content */}
          <div className="relative z-10 text-center px-6 sm:px-10 py-16 sm:py-20 max-w-2xl mx-auto">

            {/* Animated shield icon */}
            <motion.div
              initial={{ opacity: 0, scale: 0.7, y: -10 }}
              animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
              transition={{ duration: 0.6, ease: EASE }}
              className="flex justify-center mb-6"
              style={{ animation: inView ? "float 5s ease-in-out infinite" : "none" }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.30)",
                  boxShadow: "0 4px 24px rgba(255,255,255,0.15)",
                }}
              >
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 44 44"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M22 3L6 10v10c0 9.5 6.8 18.4 16 20.5C31.2 38.4 38 29.5 38 20V10L22 3z"
                    stroke="white"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <path
                    d="M14.5 22l5 5 10-10"
                    stroke="white"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </motion.div>

            {/* Heading */}
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
              className="text-[28px] sm:text-[40px] lg:text-[50px] font-extrabold text-white uppercase leading-[1.1] tracking-wide"
              style={{ textShadow: "0 2px 20px rgba(0,0,0,0.25)" }}
            >
              The Guarantee Plan
            </motion.h2>

            {/* Body */}
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.58, delay: 0.18, ease: EASE }}
              className="mt-5 text-[14.5px] sm:text-[15.5px] text-white/85 leading-[1.8] max-w-lg mx-auto"
            >
              Total peace of mind for just ₹1,999. Our legal protocol covers your entire transaction,
              providing binding contract verification and an escrow-style deposit security layer.
              If the deal falls through due to broker negligence, we cover the costs.
            </motion.p>

            {/* Ghost CTA button — shimmer border */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.52, delay: 0.28, ease: EASE }}
              className="mt-9"
            >
              <motion.button
                onClick={() => navigate("/guarantee")}
                className="relative px-10 py-[14px] text-[13.5px] font-semibold tracking-widest uppercase text-white rounded-xl overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  backdropFilter: "blur(8px)",
                  border: "1.5px solid rgba(255,255,255,0.40)",
                }}
                whileHover={{
                  backgroundColor: "rgba(255,255,255,0.22)",
                  scale: 1.04,
                  boxShadow: "0 0 30px rgba(255,255,255,0.20)",
                }}
                whileTap={{ scale: 0.97 }}
              >
                {/* Shimmer sweep */}
                <span
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.20) 50%, transparent 70%)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer 2.5s linear infinite",
                  }}
                  aria-hidden="true"
                />
                <span className="relative z-10">View Plan</span>
              </motion.button>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
