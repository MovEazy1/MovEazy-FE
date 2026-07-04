import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import cityBg from "../../assets/images/city-bg.png";
import heroVisual from "../../assets/images/marketing-hero-visual.png";
import story01 from "../../assets/images/marketing/story-01-banner.png";
import story02 from "../../assets/images/marketing/story-02-banner.png";
import story03 from "../../assets/images/marketing/story-03-banner.png";
import story05 from "../../assets/images/marketing/story-05-banner.png";
import MarketingStorySection from "./MarketingStorySection";
import MarketingWhySection from "./MarketingWhySection";
import AnimatedStat from "./AnimatedStat";
import Reviews from "../sections/Reviews";

const EASE = [0.22, 1, 0.36, 1];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.7, delay, ease: EASE },
});

const TESTIMONIALS = [
  {
    quote:
      "Found my 2BHK in HSR within a week. The broker actually listened and showed flats that matched my budget.",
    name: "Aman Mishra",
    date: "12 Dec, 2021",
    avatar: "https://randomuser.me/api/portraits/men/32.jpg",
  },
  {
    quote:
      "We are very happy customers. The process was seamless compared to dealing with random brokers on portals.",
    name: "Martinez Guela",
    date: "12 Dec, 2021",
    avatar: "https://randomuser.me/api/portraits/men/75.jpg",
  },
  {
    quote: "Dedicated agent, verified homes, and zero ghosting. Worth every rupee of the flat plan.",
    name: "Aditya Jain",
    date: "12 Dec, 2021",
    avatar: "https://randomuser.me/api/portraits/men/22.jpg",
  },
  {
    quote: "As a fresher in Bangalore I had no idea about areas. MovEazy explained HSR vs Whitefield clearly.",
    name: "Priya Nair",
    date: "8 Nov, 2021",
    avatar: "https://randomuser.me/api/portraits/women/44.jpg",
  },
  {
    quote: "Listed my flat when I left the city — quick form, team verified it, and I got leads within days.",
    name: "Rohit K.",
    date: "3 Jan, 2022",
    avatar: "https://randomuser.me/api/portraits/men/41.jpg",
  },
  {
    quote:
      "I've always lost money during move-out, but this time MovEazy handled everything. Got my full deposit back without stress.",
    name: "Riya Singh",
    date: "12 Dec, 2021",
    avatar: "https://randomuser.me/api/portraits/women/68.jpg",
  },
];

function ComparisonList({ items, type }) {
  return (
    <ul className="mkt-compare-list">
      {items.map((t, i) => (
        <motion.li
          key={t}
          initial={{ opacity: 0, x: type === "bad" ? -12 : 12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.06, duration: 0.45, ease: EASE }}
        >
          <span className={type === "bad" ? "mkt-compare-mark mkt-compare-mark--bad" : "mkt-compare-mark mkt-compare-mark--good"}>
            {type === "bad" ? "✕" : "✓"}
          </span>
          {t}
        </motion.li>
      ))}
    </ul>
  );
}

export default function MarketingHomeSections() {
  const navigate = useNavigate();

  return (
    <div className="mkt-page space-y-8 sm:space-y-10 px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto pb-8">
      {/* Hero */}
      <section className="mkt-hero relative z-0 min-h-[480px] lg:min-h-[567px]">
        <div className="mkt-hero-grain" aria-hidden />
        <div className="mkt-hero-inner relative z-10 grid grid-cols-1 lg:grid-cols-[minmax(0,664px)_minmax(280px,1fr)] gap-10 lg:gap-4 items-center px-8 sm:px-10 lg:px-12 py-12 lg:pt-[100px] lg:pb-16">
          <div className="flex flex-col justify-between gap-8 min-h-[285px]">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, ease: EASE }}
                className="text-4xl sm:text-5xl lg:text-[56px] lg:leading-[71px] font-bold text-white max-w-[651px]"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Find Your Perfect Home Without the Stress
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, delay: 0.08, ease: EASE }}
                className="mt-6 text-base leading-7 text-white/95 max-w-[520px]"
                style={{ fontFamily: "Inter, system-ui, sans-serif" }}
              >
                Find verified homes, work with trusted brokers, and move in faster with end-to-end support for just Rs 1,499.
              </motion.p>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.16, ease: EASE }}
              className="mkt-hero-ctas flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 w-full max-w-2xl"
            >
              <button type="button" className="mkt-btn-primary mkt-btn-white w-full sm:w-auto shrink-0" onClick={() => navigate("/plan")}>
                Find My Home
              </button>
              <button type="button" className="mkt-btn-primary mkt-btn-ghost w-full sm:w-auto shrink-0" onClick={() => navigate("/guarantee")}>
                Guarantee
              </button>
              <button
                type="button"
                className="mkt-btn-primary mkt-btn-ghost w-full sm:w-auto shrink-0"
                onClick={() => navigate("/list-my-flat")}
              >
                List My Home
              </button>
            </motion.div>
          </div>

          <motion.div
            className="mkt-hero-visual mx-auto lg:mx-0 lg:ml-auto w-full max-w-[596px]"
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.12, ease: EASE }}
          >
            <img src={heroVisual} alt="" className="mkt-hero-art__img" draggable={false} />
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="mkt-stat-bar grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-6 px-8 sm:px-16 py-14 sm:py-16 text-center">
        <AnimatedStat value="10000+" label="Moves Simplified Across Cities" />
        <AnimatedStat value="500+" label="Trusted Broker Partners" />
        <AnimatedStat value="90" label="Users Found a Home Within 7 Days" suffix="%+" />
      </section>

      <MarketingStorySection
        num="01"
        label="The dream"
        title="A new city."
        titleAccent="A new beginning."
        body="In 2024, two IIT Kanpur graduates moved to Mumbai for new opportunities. They were excited for what's ahead. Finding a flat shouldn't be this hard, right?"
        banner={story01}
        variant="dream"
      />

      <MarketingStorySection
        num="02"
        label="The chaos"
        title="Reality hits"
        titleAccent="different."
        body="Weeks of searching. Endless scrolling. Zero peace of mind."
        banner={story02}
        variant="chaos"
        bannerClassName="mkt-story__banner--chaos"
      >
        <button type="button" className="mkt-btn-primary mkt-btn-red mt-8 !min-w-[200px]" onClick={() => navigate("/plan")}>
          Find My Home →
        </button>
      </MarketingStorySection>

      <section className="mkt-story mkt-story--realization max-w-[1330px] mx-auto w-full rounded-[20px] overflow-hidden">
        <div className="mkt-story__copy px-6 sm:px-10 lg:px-11 pt-10 sm:pt-12 lg:pt-14 pb-6">
          <motion.div {...fadeUp(0)} className="flex items-baseline gap-3 sm:gap-4 mb-5">
            <span className="mkt-panel-label-num text-[#e03e2d]">03</span>
            <span className="mkt-panel-label-text">The realization</span>
          </motion.div>
          <motion.h2 {...fadeUp(0.06)} className="mkt-panel-title text-[#111827] mb-8 lg:mb-10">
            It&apos;s not you. <span className="text-[#ff3131]">It&apos;s the system.</span>
          </motion.h2>
          <div className="grid md:grid-cols-2 gap-5 lg:gap-6">
            <motion.div {...fadeUp(0.1)} className="mkt-compare-card mkt-compare-card--bad">
              <h3>What we found</h3>
              <ComparisonList
                type="bad"
                items={[
                  "Unverified homes",
                  "Brokers who don't listen",
                  "No accountability",
                  "High risk of scams",
                  "No end-to-end support",
                ]}
              />
            </motion.div>
            <motion.div {...fadeUp(0.14)} className="mkt-compare-card mkt-compare-card--good">
              <h3>What should exist</h3>
              <ComparisonList
                type="good"
                items={[
                  "Verified & quality homes",
                  "Brokers who understand",
                  "Transparency & trust",
                  "Safe & secure process",
                  "End-to-end support",
                ]}
              />
            </motion.div>
          </div>
        </div>
        <motion.div {...fadeUp(0.18)} className="mkt-story__banner px-4 sm:px-6 pb-6 sm:pb-8">
          <img src={story03} alt="" className="mkt-story__banner-img rounded-2xl" draggable={false} />
        </motion.div>
      </section>

      <MarketingWhySection />

      <section className="mkt-story mkt-story--experience max-w-[1330px] mx-auto w-full rounded-[20px] overflow-hidden relative">
        <div className="mkt-story__copy px-6 sm:px-10 lg:px-11 pt-10 sm:pt-12 pb-4 relative z-10">
          <motion.div {...fadeUp(0)} className="flex items-baseline gap-3 sm:gap-4 mb-5">
            <span className="mkt-panel-label-num text-[#e03e2d]">05</span>
            <span className="mkt-panel-label-text">The MovEazy experience</span>
          </motion.div>
          <motion.h2 {...fadeUp(0.06)} className="mkt-panel-title max-w-xl">
            <span className="text-[#ff3131]">Relocating</span> should feel
            <br />
            exciting again.
          </motion.h2>
        </div>
        <motion.div {...fadeUp(0.14)} className="mkt-story__banner mkt-story__banner--flush">
          <img src={story05} alt="" className="mkt-story__banner-img" draggable={false} />
        </motion.div>
      </section>


      {/* ── Reviews — interactive, real people ─────────────────────── */}
      <Reviews />

      <section className="mkt-city-cta relative flex items-center justify-center max-w-[1356px] mx-auto w-full overflow-hidden">
        <motion.img
          src={cityBg}
          alt=""
          className="mkt-city-cta__bg"
          draggable={false}
          aria-hidden
          initial={{ scale: 1.08 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 12, ease: "linear" }}
        />
        <div className="mkt-city-cta__overlay" aria-hidden />
        <div className="relative z-10 text-center px-6 py-20 max-w-[793px]">
          <motion.h2 {...fadeUp(0)}>Your New City Doesn&apos;t Have to Be Stressful</motion.h2>
          <motion.p {...fadeUp(0.08)} className="mt-6">
            Stop wasting time on confusion and unreliable brokers. MovEazy helps you find the right home faster — with complete
            clarity and support.
          </motion.p>
          <motion.button
            {...fadeUp(0.14)}
            type="button"
            className="mkt-btn-primary mkt-btn-red mt-10"
            onClick={() => navigate("/plan")}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
          >
            Find My Home
          </motion.button>
        </div>
      </section>
    </div>
  );
}
