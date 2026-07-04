import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";

const EASE = [0.22, 1, 0.36, 1];

export default function MarketingStorySection({
  num,
  label,
  title,
  titleAccent,
  titleAccentClass = "text-[#ff3131]",
  body,
  banner,
  variant = "dream",
  children,
  bannerClassName = "",
}) {
  const { ref, inView } = useInView({ threshold: 0.08, triggerOnce: true });
  const isChaos = variant === "chaos";

  return (
    <section
      ref={ref}
      className={`mkt-story mkt-story--${variant} max-w-[1330px] mx-auto w-full rounded-[20px] overflow-hidden`}
    >
      <div className="mkt-story__copy px-6 sm:px-10 lg:px-11 pt-10 sm:pt-12 lg:pt-14 pb-6 sm:pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, ease: EASE }}
          className="flex items-baseline gap-3 sm:gap-4 mb-5 sm:mb-6"
        >
          <span className="mkt-panel-label-num">{num}</span>
          <span className="mkt-panel-label-text">{label}</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65, delay: 0.06, ease: EASE }}
          className="mkt-panel-title"
        >
          {title}
          {titleAccent ? (
            <>
              <br />
              <span className={isChaos ? "text-white" : titleAccentClass}>{titleAccent}</span>
            </>
          ) : null}
        </motion.h2>

        {body ? (
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.12, ease: EASE }}
            className="mkt-panel-body mt-4 sm:mt-5 max-w-3xl"
          >
            {body}
          </motion.p>
        ) : null}

        {children ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.18, ease: EASE }}
          >
            {children}
          </motion.div>
        ) : null}
      </div>

      {banner ? (
        <motion.div
          className={`mkt-story__banner ${bannerClassName}`}
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.85, delay: 0.14, ease: EASE }}
        >
          <img src={banner} alt="" className="mkt-story__banner-img" draggable={false} />
        </motion.div>
      ) : null}
    </section>
  );
}
