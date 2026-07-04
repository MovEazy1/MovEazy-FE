// src/components/sections/ServicesTimeline.jsx
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import timeline1 from "../../assets/images/services/timeline1.png";
import timeline2 from "../../assets/images/services/timeline2.png";
import timeline3 from "../../assets/images/services/timeline3.png";
import timeline4 from "../../assets/images/services/timeline4.png";

const EASE = [0.22, 1, 0.36, 1];
const SPRING = { type: "spring", stiffness: 260, damping: 24 };

/** Word-split slide-up reveal */
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

const ENTRIES = [
  {
    title: "It started with a move to Bangalore",
    body: "Packed bags, fresh offers, and the electric energy of the Garden City. We were ready for the next big chapter.",
    image: timeline1,
    alt: "Moving to Bangalore",
  },
  {
    title: "Then the search began",
    body: "Endless scrolling on portals, juggling with brokers, and visiting 'just-in-case' flats that didn't have windows. The grind was real.",
    image: timeline2,
    alt: "Searching for apartments",
  },
  {
    title: "Nothing matched our needs",
    body: "Overpriced rentals, ghost listings, and 'amenities' that existed only in descriptions. Every call felt like a negotiation we weren't ready to make.",
    image: timeline3,
    alt: "Apartment viewing disappointment",
  },
  {
    title: "Weeks passed, still no home",
    body: "Exhaustion set in. Long list of addresses, in temporary stays, juggling work while chasing leads. We were losing steam.",
    image: timeline4,
    alt: "Exhausted from apartment hunting",
  },
];

function TimelineEntry({ title, body, image, alt, index }) {
  const textOnLeft = index % 2 === 0;
  // alternate: text slides from right, image from left (and vice versa)
  const textXFrom = textOnLeft ? 60 : -60;
  const imgXFrom  = textOnLeft ? -60 : 60;

  const textContent = (
    <motion.div
      initial={{ opacity: 0, x: textXFrom }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.75, ease: EASE }}
      className={`flex flex-col justify-center ${textOnLeft ? "lg:items-end lg:text-right" : "lg:items-start lg:text-left"}`}
    >
      {/* Title — word split */}
      <h3 className="text-[22px] sm:text-[26px] lg:text-[30px] font-bold text-[#1E2A3A] leading-[1.2] tracking-tight">
        <SplitWords text={title} delay={0.1} stagger={0.06} />
      </h3>

      {/* Body — blur-in */}
      <motion.p
        initial={{ opacity: 0, filter: "blur(8px)", y: 10 }}
        whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.75, delay: 0.3, ease: EASE }}
        className="mt-3 text-[14px] sm:text-[15px] text-gray-500 leading-[1.85] max-w-[380px]"
      >
        {body}
      </motion.p>
    </motion.div>
  );

  const imageContent = (
    <motion.div
      initial={{ opacity: 0, x: imgXFrom, scale: 0.94 }}
      whileInView={{ opacity: 1, x: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, ease: EASE }}
      whileHover={{ scale: 1.03, transition: { duration: 0.35 } }}
      className={`flex ${textOnLeft ? "lg:justify-start" : "lg:justify-end"} justify-center`}
    >
      <div className="w-full max-w-[340px] lg:max-w-[380px] rounded-2xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
        <img src={image} alt={alt} className="w-full h-auto object-cover" draggable={false} />
      </div>
    </motion.div>
  );

  return (
    <div className="relative grid lg:grid-cols-[1fr_48px_1fr] gap-6 lg:gap-0 items-center">
      <div className={`order-2 lg:order-1 ${textOnLeft ? "lg:pr-8" : "lg:pr-8"}`}>
        {textOnLeft ? textContent : imageContent}
      </div>

      {/* Center dot — springs in */}
      <div className="hidden lg:flex justify-center order-2 relative z-10">
        <motion.div
          className="w-4 h-4 rounded-full bg-white border-[3px] border-[#EF4444] shadow-sm"
          initial={{ scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ ...SPRING, delay: 0.2 }}
        />
      </div>

      <div className={`order-1 lg:order-3 ${textOnLeft ? "lg:pl-8" : "lg:pl-8"}`}>
        {textOnLeft ? imageContent : textContent}
      </div>
    </div>
  );
}

export default function ServicesTimeline() {
  const lineRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: lineRef,
    offset: ["start 0.8", "end 0.2"],
  });
  const lineScaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section className="relative w-full bg-white py-20 lg:py-28 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">

        {/* ── Section Header ─────────────────────────────────────── */}
        <div className="text-center mb-16 lg:mb-20">
          {/* Badge — spring */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 10 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ ...SPRING, delay: 0 }}
          >
            <span className="inline-block rounded-full px-4 py-1.5 bg-[#FDECEA] text-[#EF4444] text-[11px] font-semibold uppercase tracking-[0.12em]">
              Our Journey
            </span>
          </motion.div>

          {/* Heading — word split + italic "this" with spring */}
          <h2 className="mt-5 text-[32px] sm:text-[42px] lg:text-[52px] font-extrabold text-[#1E2A3A] leading-[1.08] tracking-tight">
            <SplitWords text="Why we started" delay={0.08} stagger={0.1} />{" "}
            <motion.em
              className="not-italic text-[#EF4444] italic"
              initial={{ opacity: 0, scale: 0.5, rotate: -6 }}
              whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ ...SPRING, delay: 0.48 }}
            >
              this
            </motion.em>
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6, duration: 0.3 }}
            >
              .
            </motion.span>
          </h2>

          {/* Subtext — clip-path reveal */}
          <motion.p
            initial={{ clipPath: "inset(0 100% 0 0)", opacity: 0 }}
            whileInView={{ clipPath: "inset(0 0% 0 0)", opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
            className="mt-4 text-[15px] sm:text-[16px] text-gray-500 leading-[1.82] max-w-[520px] mx-auto"
          >
            Relocating shouldn't feel like a part-time job. We went through the grind so you didn't have to.
          </motion.p>
        </div>

        {/* ── Timeline ───────────────────────────────────────────── */}
        <div className="relative" ref={lineRef}>

          {/* Scroll-driven vertical line */}
          <div
            aria-hidden="true"
            className="hidden lg:block absolute left-1/2 top-0 bottom-40 -translate-x-1/2 w-px bg-gray-100 overflow-hidden"
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-b from-[#EF4444] to-[#f87171] origin-top"
              style={{ scaleY: lineScaleY }}
            />
          </div>

          <div className="space-y-16 lg:space-y-20">
            {ENTRIES.map((entry, i) => (
              <TimelineEntry key={entry.title} {...entry} index={i} />
            ))}
          </div>

          {/* ── Conclusion — scale + clip reveal ─────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
            className="relative mt-16 lg:mt-20 flex flex-col items-center text-center"
          >
            {/* Red circle — spring pop */}
            <motion.div
              className="w-14 h-14 rounded-full bg-[#EF4444] flex items-center justify-center shadow-[0_8px_24px_rgba(239,68,68,0.3)] relative z-10"
              initial={{ scale: 0, rotate: -30 }}
              whileInView={{ scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ ...SPRING, delay: 0.15 }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <motion.path
                  d="M6 10L9 13L14 7"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.55, ease: EASE }}
                />
              </svg>
            </motion.div>

            {/* "The process was broken." — word by word */}
            <h3 className="mt-6 text-[24px] sm:text-[28px] font-bold text-[#1E2A3A] leading-[1.2]">
              <SplitWords text="The process was" delay={0.2} stagger={0.08} />
              {" "}
              <span style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", marginRight: "0.28em" }}>
                <motion.span
                  style={{ display: "inline-block" }}
                  initial={{ y: "105%", color: "#1E2A3A" }}
                  whileInView={{ y: 0, color: "#EF4444" }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.6, delay: 0.48, ease: EASE }}
                >
                  broken.
                </motion.span>
              </span>
            </h3>

            {/* Body — blur fade */}
            <motion.p
              initial={{ opacity: 0, filter: "blur(8px)" }}
              whileInView={{ opacity: 1, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.8, delay: 0.35, ease: EASE }}
              className="mt-3 text-[14px] sm:text-[15px] text-gray-500 leading-[1.82] max-w-[480px]"
            >
              It wasn't just a bad search, it was a broken system. Fragmented, opaque,
              and entirely too stressful. Someone had to fix it.
            </motion.p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
