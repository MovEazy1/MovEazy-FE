import { motion } from "framer-motion";
import story04Footer from "../../assets/images/marketing/story-04-footer.png";

const EASE = [0.22, 1, 0.36, 1];

const FEATURES = [
  "Verified Homes",
  "Trusted Brokers",
  "Deposit Safety",
  "Commute-aware Search",
  "End-to-End Support",
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.65, delay, ease: EASE },
});

export default function MarketingWhySection() {
  return (
    <section className="mkt-why max-w-[1330px] mx-auto w-full rounded-[20px] overflow-hidden">
      <div className="mkt-why__inner px-6 sm:px-10 lg:px-11 pt-10 sm:pt-12 lg:pt-14 pb-6 sm:pb-8">
        <motion.div {...fadeUp(0)} className="flex items-baseline gap-3 sm:gap-4 mb-8 lg:mb-10">
          <span className="mkt-panel-label-num text-[#e03e2d]/40">04</span>
          <span className="mkt-panel-label-text">Why MovEazy exists</span>
        </motion.div>

        <div className="mkt-why__top">
          <motion.h2 {...fadeUp(0.06)} className="mkt-panel-title text-[#111827] mkt-why__title">
            So we built <span className="text-[#ff3131]">MovEazy.</span>
          </motion.h2>

          <motion.p {...fadeUp(0.1)} className="mkt-why__quote">
            &ldquo;A platform that removes the chaos and puts you first.&rdquo;
          </motion.p>

          <motion.div {...fadeUp(0.14)} className="mkt-why__features-card">
            <h3 className="mkt-why__features-title">Features</h3>
            <ul className="mkt-why__features-list">
              {FEATURES.map((item, i) => (
                <motion.li
                  key={item}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.18 + i * 0.05, duration: 0.4, ease: EASE }}
                >
                  {item}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>

        <motion.div
          {...fadeUp(0.2)}
          className="mkt-why__footer-art-wrap"
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
        >
          <img src={story04Footer} alt="" className="mkt-why__footer-art" draggable={false} />
        </motion.div>
      </div>
    </section>
  );
}
