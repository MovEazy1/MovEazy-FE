// src/components/sections/Reviews.jsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInView } from "react-intersection-observer";
import ellipseImg  from "../../assets/images/ellipse.png";
import amanImg     from "../../assets/images/aman.png";
import kuldeepImg  from "../../assets/images/kuldeep.png";
import yatharthImg from "../../assets/images/yatharth.png";

const EASE = [0.22, 1, 0.36, 1];

const REVIEWS = [
  {
    id: 0,
    name: "Aman Mishra",
    role: "Software Engineer · Bangalore",
    rating: 4.8,
    date: "29 Aug, 2023",
    avatar: amanImg,
    quote: "Found my dream home in 4 days.",
    body: "I moved from Pune to Bangalore with zero contacts. MovEazy matched me with a broker who knew exactly what I needed. Within 4 days I had visited 3 shortlisted flats and signed the one I loved.",
  },
  {
    id: 1,
    name: "Kuldeep Sharma",
    role: "Product Manager · HSR Layout",
    rating: 4.9,
    date: "12 Dec, 2023",
    avatar: kuldeepImg,
    quote: "No brokerage drama. Zero stress.",
    body: "Every broker I'd dealt with before had hidden charges or fake listings. MovEazy's network was different — transparent, professional, and actually responsive. Got my 2BHK in Koramangala in under a week.",
  },
  {
    id: 2,
    name: "Yatharth Gupta",
    role: "Consultant · Indiranagar",
    rating: 4.7,
    date: "3 Jan, 2024",
    avatar: yatharthImg,
    quote: "Got my full deposit back.",
    body: "I've always lost money during move-out. This time MovEazy handled the entire negotiation with the landlord. Full deposit back, no deductions. I won't rent without them again.",
  },
];

/* Fractional star rating */
function StarRating({ rating }) {
  const full = Math.floor(rating);
  const frac = rating - full;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 13 13">
          <defs>
            <linearGradient id={`sg-${i}-${String(rating).replace(".", "")}`} x1="0%" x2="100%">
              <stop
                offset={`${i < full ? 100 : i === full ? Math.round(frac * 100) : 0}%`}
                stopColor="#F59E0B"
              />
              <stop
                offset={`${i < full ? 100 : i === full ? Math.round(frac * 100) : 0}%`}
                stopColor="#E5E7EB"
              />
            </linearGradient>
          </defs>
          <path
            d="M6.5 0.5l1.545 3.13 3.455.503-2.5 2.437.59 3.44L6.5 8.385l-3.09 1.625.59-3.44L.5 4.133l3.455-.503L6.5.5z"
            fill={
              i < full
                ? "#F59E0B"
                : i === full
                ? `url(#sg-${i}-${String(rating).replace(".", "")})`
                : "#E5E7EB"
            }
          />
        </svg>
      ))}
      <span className="ml-1.5 text-[12px] font-semibold text-gray-500">{rating}</span>
    </div>
  );
}

/* Desktop curve node */
function AvatarNode({ reviewer, isActive, onClick, className }) {
  return (
    <div className={`absolute -translate-x-1/2 -translate-y-1/2 ${className}`}>
      <motion.button
        onClick={onClick}
        className="flex items-center gap-3"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.97 }}
      >
        <motion.div
          className="rounded-full overflow-hidden shrink-0"
          animate={{
            width:   isActive ? 60 : 44,
            height:  isActive ? 60 : 44,
            opacity: isActive ? 1  : 0.6,
          }}
          transition={{ duration: 0.28, ease: EASE }}
          style={{
            boxShadow: isActive
              ? "0 0 0 3px #EF4444, 0 0 22px rgba(239,68,68,0.42)"
              : "0 2px 8px rgba(0,0,0,0.12)",
          }}
        >
          <img src={reviewer.avatar} alt={reviewer.name} className="w-full h-full object-cover" />
        </motion.div>
        <div className="text-left whitespace-nowrap">
          <p className={`font-bold text-gray-900 ${isActive ? "text-[14px]" : "text-[12px] opacity-70"}`}>
            {reviewer.name}
          </p>
          {isActive && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
              <StarRating rating={reviewer.rating} />
            </motion.div>
          )}
        </div>
      </motion.button>
    </div>
  );
}

/* Mobile row node */
function MobileNode({ reviewer, isActive, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.97 }}
    >
      <motion.div
        className="rounded-full overflow-hidden"
        animate={{ width: isActive ? 64 : 52, height: isActive ? 64 : 52, opacity: isActive ? 1 : 0.6 }}
        transition={{ duration: 0.28, ease: EASE }}
        style={{
          boxShadow: isActive
            ? "0 0 0 3px #EF4444, 0 0 18px rgba(239,68,68,0.38)"
            : "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        <img src={reviewer.avatar} alt={reviewer.name} className="w-full h-full object-cover" />
      </motion.div>
      <p className="text-[11px] font-semibold text-gray-700 whitespace-nowrap">{reviewer.name.split(" ")[0]}</p>
    </motion.button>
  );
}

export default function Reviews() {
  const [active, setActive] = useState(1);
  const review = REVIEWS[active];
  const { ref, inView } = useInView({ threshold: 0.15, triggerOnce: true });

  return (
    <section
      className="relative py-14 sm:py-20 overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 0% 50%, rgba(232,90,79,0.06) 0%, transparent 55%), #ffffff",
      }}
    >
      {/* Ellipse decoration */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[220px] sm:w-[300px] opacity-50 pointer-events-none z-0">
        <img src={ellipseImg} alt="" className="w-full" draggable={false} />
      </div>
      {/* Right glow */}
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full pointer-events-none z-0"
        style={{ background: "radial-gradient(circle, rgba(14,165,233,0.06) 0%, transparent 70%)" }}
        aria-hidden
      />

      <div className="relative z-10 w-[92%] max-w-6xl mx-auto">
        <div
          ref={ref}
          className="rounded-3xl px-6 sm:px-10 lg:px-14 py-10 sm:py-14"
          style={{
            background: "rgba(255,255,255,0.82)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(232,90,79,0.10)",
            boxShadow: "0 8px 48px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)",
          }}
        >
          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, ease: EASE }}
            className="mb-10"
          >
            <div
              className="w-10 h-[3px] rounded-full mb-4"
              style={{ background: "linear-gradient(90deg,#e85a4f,#f97316)" }}
            />
            <h2 className="text-[26px] sm:text-[40px] lg:text-[46px] font-extrabold text-gray-900 leading-tight">
              Real stories from{" "}
              <span className="gradient-text">real renters</span>.
            </h2>
            <p className="mt-2 text-[14px] text-gray-400">
              No paid reviews. Just people who moved with us.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-10 items-center">

            {/* ── Desktop left: avatar nodes on curve ────────────── */}
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
              className="relative h-[280px] hidden md:block"
            >
              <svg
                className="absolute left-[78px] top-[8px]"
                width="130" height="264"
                viewBox="0 0 130 264"
                fill="none"
              >
                <defs>
                  <linearGradient id="rev-curve" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%"   stopColor="#e85a4f" stopOpacity="0.55" />
                    <stop offset="50%"  stopColor="#f97316" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#ec4899" stopOpacity="0.25" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M20 0 C120 56,120 208,20 264"
                  stroke="url(#rev-curve)"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                  fill="none"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={inView ? { pathLength: 1, opacity: 1 } : {}}
                  transition={{ duration: 1.3, delay: 0.3, ease: EASE }}
                />
              </svg>

              {REVIEWS.map((r, i) => {
                const pos = [
                  "top-[18px]  left-[150px]",
                  "top-[132px] left-[212px]",
                  "top-[256px] left-[150px]",
                ];
                return (
                  <AvatarNode
                    key={r.id}
                    reviewer={r}
                    isActive={active === i}
                    onClick={() => setActive(i)}
                    className={pos[i]}
                  />
                );
              })}
            </motion.div>

            {/* ── Mobile avatar row ───────────────────────────────── */}
            <div className="md:hidden flex justify-center gap-8 mb-1">
              {REVIEWS.map((r, i) => (
                <MobileNode
                  key={r.id}
                  reviewer={r}
                  isActive={active === i}
                  onClick={() => setActive(i)}
                />
              ))}
            </div>

            {/* ── Desktop right: animated quote card ─────────────── */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.12, ease: EASE }}
              className="hidden md:flex items-center"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  className="max-w-[420px]"
                >
                  <h3 className="text-[32px] lg:text-[38px] font-extrabold italic text-gray-900 leading-[1.18]">
                    "{review.quote}"
                  </h3>
                  <p className="mt-5 text-[15px] text-gray-500 leading-[1.85]">
                    {review.body}
                  </p>
                  <div className="mt-5 flex items-center gap-3">
                    <StarRating rating={review.rating} />
                    <span className="text-[12px] text-gray-300">·</span>
                    <span className="text-[12px] text-gray-400">{review.date}</span>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <img
                      src={review.avatar}
                      alt={review.name}
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm"
                    />
                    <div>
                      <p className="text-[13px] font-bold text-gray-800 leading-snug">{review.name}</p>
                      <p className="text-[11px] text-gray-400">{review.role}</p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </motion.div>

            {/* ── Mobile quote ────────────────────────────────────── */}
            <div className="md:hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  className="rounded-2xl px-5 py-6"
                  style={{
                    background: "rgba(255,244,242,0.7)",
                    border: "1px solid rgba(232,90,79,0.12)",
                  }}
                >
                  <h3 className="text-[21px] font-extrabold italic text-gray-900 leading-snug">
                    "{review.quote}"
                  </h3>
                  <p className="mt-3 text-[13px] text-gray-500 leading-[1.8]">{review.body}</p>
                  <div className="mt-4 flex items-center gap-3">
                    <img
                      src={review.avatar}
                      alt={review.name}
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm"
                    />
                    <div>
                      <p className="text-[13px] font-bold text-gray-800">{review.name}</p>
                      <p className="text-[11px] text-gray-400">{review.role}</p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

          </div>

          {/* Dot navigator */}
          <div className="mt-8 flex items-center justify-center gap-2.5">
            {REVIEWS.map((_, i) => (
              <motion.button
                key={i}
                onClick={() => setActive(i)}
                className="rounded-full"
                animate={{
                  width:      active === i ? 28 : 8,
                  height:     8,
                  backgroundColor: active === i ? "#EF4444" : "#E5E7EB",
                }}
                transition={{ duration: 0.25, ease: EASE }}
                whileHover={{ scale: 1.2 }}
                aria-label={`Review ${i + 1}`}
              />
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
