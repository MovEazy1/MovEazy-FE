import { motion, useScroll, useTransform } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useMemo, useState, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

/** Premium exterior — Unsplash (license-friendly). */
const HERO_PHOTO =
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=88&w=2400";

const EASE = [0.22, 1, 0.36, 1];

const fadeUp = (delay = 0) => ({
  initial: false,
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: EASE },
});

export default function Hero() {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const panelRef = useRef(null);
  const [quickFilters, setQuickFilters] = useState({
    locality: "",
    bhk: "",
    propertyType: "",
    budget: "any",
  });

  /* Parallax on hero background */
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.65]);

  useGSAP(
    () => {
      const root = heroRef.current;
      const panel = panelRef.current;
      if (!root || !panel) return;

      const layers = root.querySelectorAll("[data-depth]");
      const media = gsap.matchMedia();

      media.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set([panel, ...layers], { clearProps: "all" });
      });

      media.add("(prefers-reduced-motion: no-preference) and (pointer: fine)", () => {
        gsap.set(panel, { transformPerspective: 1200, transformStyle: "preserve-3d" });

        gsap.to(layers, {
          y: (idx) => (idx % 2 === 0 ? -10 : 10),
          duration: 3.2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          stagger: 0.15,
        });

        const tiltXTo = gsap.quickTo(panel, "rotateX", { duration: 0.35, ease: "power3.out" });
        const tiltYTo = gsap.quickTo(panel, "rotateY", { duration: 0.35, ease: "power3.out" });
        const layerXTo = Array.from(layers).map((el) => gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" }));
        const layerYTo = Array.from(layers).map((el) => gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" }));

        const onMove = (event) => {
          const rect = root.getBoundingClientRect();
          const relX = (event.clientX - rect.left) / rect.width - 0.5;
          const relY = (event.clientY - rect.top) / rect.height - 0.5;

          tiltXTo(relY * -10);
          tiltYTo(relX * 12);

          Array.from(layers).forEach((_, idx) => {
            const depth = Number(layers[idx].getAttribute("data-depth") || "0.08");
            layerXTo[idx](relX * depth * 140);
            layerYTo[idx](relY * depth * 100);
          });
        };

        const onLeave = () => {
          tiltXTo(0);
          tiltYTo(0);
          layerXTo.forEach((setX) => setX(0));
          layerYTo.forEach((setY) => setY(0));
        };

        root.addEventListener("mousemove", onMove);
        root.addEventListener("mouseleave", onLeave);

        return () => {
          root.removeEventListener("mousemove", onMove);
          root.removeEventListener("mouseleave", onLeave);
        };
      });

      return () => media.revert();
    },
    { scope: heroRef }
  );

  const featuredLocalities = ["Whitefield", "HSR Layout", "Koramangala", "Indiranagar", "Bellandur", "Mahadevpura"];
  const budgetRanges = useMemo(
    () => ({
      any:            { min: 10000,  max: 100000 },
      "15000-35000":  { min: 15000,  max: 35000  },
      "30000-70000":  { min: 30000,  max: 70000  },
      "70000-120000": { min: 70000,  max: 120000 },
    }),
    []
  );

  const goToMap = (overrides = {}, { openFilters = true } = {}) => {
    const q = { ...quickFilters, ...overrides };
    const budget = budgetRanges[q.budget] || budgetRanges.any;
    const params = new URLSearchParams();
    if (q.locality?.trim())      params.set("locality",      q.locality.trim());
    if (q.bhk?.trim())           params.set("bhk",           q.bhk.trim());
    if (q.propertyType?.trim())  params.set("propertyType",  q.propertyType.trim());
    if (q.budget && q.budget !== "any") {
      params.set("minRent", String(budget.min));
      params.set("maxRent", String(budget.max));
    }
    if (openFilters) params.set("openFilters", "1");
    const qs = params.toString();
    navigate(qs ? `/map?${qs}` : "/map");
  };

  const runSearch = () => goToMap({}, { openFilters: true });

  return (
    <section
      ref={heroRef}
      className="relative z-[1] w-full min-h-0 overflow-x-hidden overflow-y-visible md:min-h-[min(520px,78vh)] lg:min-h-[calc(100vh-3rem)]"
    >
      {/* ── Parallax background photo ── */}
      <motion.img
        src={HERO_PHOTO}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-[115%] w-full object-cover object-center pointer-events-none select-none"
        style={{ y: imgY }}
        draggable={false}
      />

      {/* ── Floating ambient orbs ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Orb 1 — coral top-left */}
        <motion.div
          className="absolute -top-16 -left-16 w-[340px] h-[340px] rounded-full"
          data-depth="0.22"
          style={{
            background: "radial-gradient(circle, rgba(232,90,79,0.35) 0%, transparent 70%)",
            animation: "float-slow 9s ease-in-out infinite",
          }}
        />
        {/* Orb 2 — blue right */}
        <motion.div
          className="absolute top-1/3 -right-20 w-[260px] h-[260px] rounded-full"
          data-depth="0.16"
          style={{
            background: "radial-gradient(circle, rgba(14,165,233,0.25) 0%, transparent 70%)",
            animation: "float-slow 11s ease-in-out infinite 2s",
          }}
        />
        {/* Orb 3 — soft rose (avoids orange clash with CTAs) */}
        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] rounded-full"
          data-depth="0.12"
          style={{
            background: "radial-gradient(ellipse, rgba(244,114,182,0.10) 0%, transparent 70%)",
            animation: "float-slow 13s ease-in-out infinite 1s",
          }}
        />
      </div>

      {/* ── Layered gradient overlays ── */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: overlayOpacity }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, rgba(76,5,25,0.93) 0%, rgba(185,28,28,0.80) 35%, rgba(15,23,42,0.58) 70%, rgba(12,74,110,0.48) 100%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/55 via-transparent to-stone-900/15" />
      </motion.div>

      <div className="relative mx-auto w-full max-w-7xl px-4 pt-4 pb-10 sm:px-6 sm:pt-8 sm:pb-12 lg:px-10 lg:pt-10 lg:pb-14">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:items-stretch">
          {/* ── Main content ── */}
          <motion.div {...fadeUp(0)} className="min-w-0 text-white pt-0 lg:pt-6">
            {/* Badge */}
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, ease: EASE }}
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-[#ffe4e0] backdrop-blur-sm sm:text-xs"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary-glow shadow-[0_0_12px_#ff8a7a] animate-pulse" />
              Bengaluru · Verified listings
            </motion.p>

            {/* Headline with gradient text */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.05, ease: EASE }}
              className="mt-3 break-words text-[32px] font-extrabold leading-[1.1] tracking-tight text-white drop-shadow-sm sm:mt-4 sm:text-4xl sm:leading-[1.08] md:text-5xl lg:text-[3.5rem] xl:text-[3.75rem]"
            >
              Find Verified Properties In{" "}
              <span
                style={{
                  background: "linear-gradient(110deg, #fecaca, #ffffff 45%, #bae6fd)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                }}
              >
                Bengaluru
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.12, ease: EASE }}
              className="mt-3 max-w-xl text-[15px] font-medium leading-relaxed text-[#fecdd3]/95 sm:text-base sm:leading-relaxed"
            >
              100+ listings refreshed daily · curated for serious renters who want clarity, not chaos.
            </motion.p>

            {/* Search box */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
              className="mt-5 rounded-2xl border border-white/20 bg-white/12 p-3 sm:mt-8 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.28)] backdrop-blur-md"
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_0.8fr]">
                <input
                  value={quickFilters.locality}
                  onChange={(e) => setQuickFilters((p) => ({ ...p, locality: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
                  placeholder="Search locality or project"
                  className="min-h-11 rounded-xl border border-white/30 bg-white/95 px-3 py-2.5 text-[15px] text-ink outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-white/70 transition-shadow sm:h-11 sm:py-0 sm:text-sm"
                />
                <motion.button
                  type="button"
                  onClick={runSearch}
                  className="min-h-11 rounded-xl bg-white/95 py-2.5 text-[15px] font-semibold text-ink shadow-[0_8px_24px_rgba(0,0,0,0.22)] ring-1 ring-white/50 sm:h-11 sm:py-0 sm:text-sm"
                  whileHover={{ scale: 1.03, backgroundColor: "#ffffff" }}
                  whileTap={{ scale: 0.97 }}
                >
                  Search
                </motion.button>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    value: quickFilters.propertyType,
                    onChange: (e) => setQuickFilters((p) => ({ ...p, propertyType: e.target.value })),
                    options: [
                      { value: "",                       label: "Any property type" },
                      { value: "Apartment",              label: "Apartment" },
                      { value: "Independent House/Villa", label: "Independent House/Villa" },
                      { value: "Gated Societies",        label: "Gated Societies" },
                      { value: "Gated Community Villa",  label: "Gated Community Villa" },
                    ],
                  },
                  {
                    value: quickFilters.bhk,
                    onChange: (e) => setQuickFilters((p) => ({ ...p, bhk: e.target.value })),
                    options: [
                      { value: "",       label: "Any BHK" },
                      { value: "1 RK",   label: "1 RK" },
                      { value: "1 BHK",  label: "1 BHK" },
                      { value: "2 BHK",  label: "2 BHK" },
                      { value: "3 BHK",  label: "3 BHK" },
                      { value: "3+ BHK", label: "3+ BHK" },
                    ],
                  },
                  {
                    value: quickFilters.budget,
                    onChange: (e) => setQuickFilters((p) => ({ ...p, budget: e.target.value })),
                    options: [
                      { value: "any",            label: "Any budget (10k – 1L)" },
                      { value: "15000-35000",    label: "Budget 15k – 35k" },
                      { value: "30000-70000",    label: "Budget 30k – 70k" },
                      { value: "70000-120000",   label: "Budget 70k – 1.2L" },
                    ],
                  },
                ].map((sel, idx) => (
                  <select
                    key={idx}
                    value={sel.value}
                    onChange={sel.onChange}
                    className="min-h-11 w-full rounded-xl border border-white/30 bg-white/95 px-2 py-2 text-[13px] font-medium text-ink outline-none sm:h-10 sm:py-0 sm:text-xs"
                  >
                    {sel.options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ))}
                <motion.button
                  type="button"
                  onClick={() => goToMap({}, { openFilters: true })}
                  className="min-h-11 rounded-xl border border-white/35 bg-white/15 py-2.5 text-[13px] font-semibold text-white backdrop-blur-sm sm:h-10 sm:py-0 sm:text-xs"
                  whileHover={{ backgroundColor: "rgba(255,255,255,0.28)" }}
                  whileTap={{ scale: 0.97 }}
                >
                  More Filters
                </motion.button>
              </div>

              {/* Popular localities */}
              <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-2">
                <span className="w-full shrink-0 text-xs font-semibold uppercase tracking-wider text-[#fecaca]/90 sm:w-auto sm:text-[11px]">
                  Popular
                </span>
                {featuredLocalities.map((loc) => (
                  <motion.button
                    key={loc}
                    type="button"
                    onClick={() => {
                      setQuickFilters((p) => ({ ...p, locality: loc }));
                      goToMap({ locality: loc });
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:px-2.5 sm:py-1 sm:text-[11px] ${
                      quickFilters.locality === loc
                        ? "border-white bg-white text-primary-darker"
                        : "border-white/40 text-white"
                    }`}
                    whileHover={{
                      backgroundColor: quickFilters.locality === loc ? "#fff" : "rgba(255,255,255,0.18)",
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {loc}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.3, ease: EASE }}
              className="mt-5 flex w-full flex-col gap-2 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
            >
              <motion.button
                type="button"
                onClick={runSearch}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white/95 px-6 py-2.5 text-[15px] font-semibold text-ink shadow-[0_10px_32px_rgba(0,0,0,0.28)] ring-1 ring-white/55 hover:bg-white sm:w-auto sm:py-3 sm:text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
              >
                View Listings <span aria-hidden>→</span>
              </motion.button>
              <motion.button
                type="button"
                onClick={() => navigate("/plan")}
                className="min-h-11 w-full rounded-full border-2 border-white/70 bg-white/10 px-6 py-2.5 text-center text-[15px] font-semibold text-white backdrop-blur-sm sm:w-auto sm:py-3 sm:text-sm"
                whileHover={{ backgroundColor: "rgba(255,255,255,0.22)" }}
                whileTap={{ scale: 0.97 }}
              >
                Flat Plan — ₹1,499
              </motion.button>
              <motion.button
                type="button"
                onClick={() => navigate("/guarantee")}
                className="min-h-11 w-full rounded-full border-2 border-white/70 bg-white/10 px-6 py-2.5 text-center text-[15px] font-semibold text-white backdrop-blur-sm sm:w-auto sm:py-3 sm:text-sm"
                whileHover={{ backgroundColor: "rgba(255,255,255,0.22)" }}
                whileTap={{ scale: 0.97 }}
              >
                Guarantee — ₹1,999
              </motion.button>
            </motion.div>
          </motion.div>

          {/* ── Trust / stats panel ── */}
          <motion.div
            initial={{ opacity: 0, x: 30, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 0.14, ease: EASE }}
            ref={panelRef}
            className="relative flex min-h-0 w-full flex-col justify-end rounded-2xl border border-white/25 bg-white/10 p-4 shadow-glass backdrop-blur-md sm:rounded-[28px] sm:p-5 lg:ml-auto lg:h-auto lg:min-h-0 lg:max-w-md lg:justify-start lg:self-start xl:max-w-lg"
          >
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-[28px]"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(255,255,255,0.05)",
              }}
              aria-hidden="true"
            />

            <p className="relative z-10 mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-100/90 sm:mb-3 sm:text-left lg:text-left">
              Trusted moves
            </p>
            <div className="relative z-10 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-start sm:gap-3 lg:justify-start">
              {[
                { value: "100+", label: "People moved happily", color: "text-primary-darker" },
                { value: "36", label: "Homes closed / month", color: "text-sky-800" },
              ].map(({ value, label, color }) => (
                <motion.div
                  key={label}
                  data-depth="0.28"
                  className="min-w-0 rounded-xl bg-white/95 px-3 py-2.5 shadow-lg ring-1 ring-stone-200/80 sm:rounded-2xl sm:px-4 sm:py-3"
                  whileHover={{ scale: 1.05, boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}
                  transition={{ duration: 0.2 }}
                >
                  <div className={`text-base font-extrabold sm:text-[20px] ${color}`}>{value}</div>
                  <div className="text-ink-muted text-[11px] font-medium leading-snug sm:text-xs">{label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
