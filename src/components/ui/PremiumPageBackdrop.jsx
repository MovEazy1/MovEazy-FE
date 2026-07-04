// Animated mesh + faux-3D orbs — variants: checkout, marketing, subtle, dark
import { motion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1];

/** Glossy “3D” orb — CSS gradients + soft specular highlight */
function GlossOrb({ className, delay = 0, duration = 14, label }) {
  return (
    <motion.div
      className={`absolute pointer-events-none select-none will-change-transform ${className}`}
      aria-hidden="true"
      initial={{ opacity: 0.85 }}
      animate={{
        y: [0, -28, 8, 0],
        x: [0, 18, -14, 0],
        rotateX: [0, 18, -12, 0],
        rotateY: [0, -22, 14, 0],
        rotateZ: [0, 6, -4, 0],
        scale: [1, 1.06, 0.98, 1],
      }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
      style={{ transformStyle: "preserve-3d", perspective: 900 }}
    >
      <div
        className="relative flex h-full w-full items-center justify-center rounded-full shadow-[0_24px_48px_rgba(15,23,42,0.18),inset_0_-12px_24px_rgba(0,0,0,0.12),inset_0_8px_20px_rgba(255,255,255,0.45)]"
        style={{
          background:
            "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95) 0%, transparent 42%), radial-gradient(circle at 70% 72%, rgba(251,113,133,0.35) 0%, transparent 50%), linear-gradient(145deg, #fecdd3 0%, #fb7185 35%, #f97316 70%, #fdba74 100%)",
        }}
      >
        <span className="relative z-[1] text-2xl drop-shadow-md md:text-3xl" role="img">
          {label}
        </span>
        <div
          className="pointer-events-none absolute inset-[12%] rounded-full opacity-40 blur-md"
          style={{
            background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.9), transparent 55%)",
          }}
        />
      </div>
    </motion.div>
  );
}

/** Flat frosted “chip” — subtle 3D tilt */
function FrostChip({ className, delay, children }) {
  return (
    <motion.div
      className={`absolute pointer-events-none ${className}`}
      aria-hidden="true"
      animate={{
        y: [0, -16, 4, 0],
        rotateX: [0, 8, -6, 0],
        rotateY: [0, -10, 6, 0],
      }}
      transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay }}
      style={{ transformStyle: "preserve-3d", perspective: 700 }}
    >
      <div className="rounded-2xl border border-white/50 bg-white/25 px-4 py-2 text-xs font-bold uppercase tracking-wider text-rose-900/80 shadow-lg backdrop-blur-md">
        {children}
      </div>
    </motion.div>
  );
}

/** Frost chip tuned for dark pages */
function FrostChipDark({ className, delay, children }) {
  return (
    <motion.div
      className={`absolute pointer-events-none ${className}`}
      aria-hidden="true"
      animate={{ y: [0, -10, 4, 0], opacity: [0.5, 0.85, 0.5] }}
      transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay }}
    >
      <div className="rounded-2xl border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-200/90 shadow-lg backdrop-blur-md">
        {children}
      </div>
    </motion.div>
  );
}

/**
 * @param {"checkout" | "marketing" | "subtle" | "dark"} variant
 * @param {boolean} overlayOnly — skip opaque base wash when the page defines its own background
 */
export default function PremiumPageBackdrop({ variant = "subtle", overlayOnly = false }) {
  const isCheckout = variant === "checkout";
  const isMarketing = variant === "marketing";
  const isDark = variant === "dark";

  /* Marketing = soft blobs only (no grid / orbs) so listing cards stay readable */
  const blobA = isDark
    ? "absolute -left-[18%] top-[8%] h-[min(520px,55vw)] w-[min(520px,55vw)] rounded-full bg-gradient-to-br from-rose-600/25 via-orange-500/15 to-transparent blur-3xl will-change-transform"
    : isMarketing
      ? "absolute -left-[22%] top-[10%] h-[min(420px,48vw)] w-[min(420px,48vw)] rounded-full bg-gradient-to-br from-rose-200/45 via-orange-100/35 to-amber-50/25 blur-3xl will-change-transform"
      : "absolute -left-[18%] top-[8%] h-[min(520px,55vw)] w-[min(520px,55vw)] rounded-full bg-gradient-to-br from-rose-300/95 via-orange-200/80 to-amber-100/70 blur-3xl will-change-transform";

  const blobB = isDark
    ? "absolute -right-[12%] top-[22%] h-[min(480px,50vw)] w-[min(480px,50vw)] rounded-full bg-gradient-to-bl from-violet-600/20 via-indigo-500/12 to-transparent blur-3xl will-change-transform"
    : isMarketing
      ? "absolute -right-[18%] top-[24%] h-[min(400px,45vw)] w-[min(400px,45vw)] rounded-full bg-gradient-to-bl from-sky-200/40 via-violet-100/30 to-fuchsia-50/20 blur-3xl will-change-transform"
      : "absolute -right-[12%] top-[22%] h-[min(480px,50vw)] w-[min(480px,50vw)] rounded-full bg-gradient-to-bl from-sky-300/90 via-violet-200/75 to-fuchsia-200/60 blur-3xl will-change-transform";

  const blobC = isDark
    ? "absolute bottom-[-8%] left-[20%] h-[min(400px,45vw)] w-[min(400px,45vw)] rounded-full bg-gradient-to-tr from-cyan-500/15 to-sky-600/10 blur-3xl will-change-transform"
    : isMarketing
      ? "absolute bottom-[-12%] left-[18%] h-[min(340px,40vw)] w-[min(340px,40vw)] rounded-full bg-gradient-to-tr from-rose-200/35 to-orange-100/25 blur-3xl will-change-transform"
      : "absolute bottom-[-8%] left-[20%] h-[min(400px,45vw)] w-[min(400px,45vw)] rounded-full bg-gradient-to-tr from-rose-400/70 to-orange-200/55 blur-3xl will-change-transform";

  const t1 = isCheckout ? 14 : isMarketing ? 17 : isDark ? 20 : 22;
  const t2 = isCheckout ? 16 : isMarketing ? 19 : isDark ? 22 : 24;
  const t3 = isCheckout ? 11 : isMarketing ? 14 : isDark ? 16 : 18;

  const meshOpacity = isCheckout ? "opacity-[0.07]" : isDark ? "opacity-[0.04]" : "opacity-[0.05]";

  const meshLine = isDark ? "rgba(255,255,255,0.35)" : "rgba(15,23,42,0.9)";

  const driftStyle = isDark
    ? {
        background:
          "radial-gradient(ellipse 70% 50% at 30% 0%, rgba(232,90,79,0.12), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 100%, rgba(99,102,241,0.12), transparent 50%)",
      }
    : {
        background:
          "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,255,255,0.9), transparent 55%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(251,113,133,0.15), transparent 50%)",
      };

  const driftOpacity = isCheckout ? [0.22, 0.38, 0.24] : isMarketing ? [0.08, 0.14, 0.1] : isDark ? [0.35, 0.55, 0.38] : [0.12, 0.2, 0.14];

  const bottomBlobOpacity = isCheckout
    ? [0.55, 0.9, 0.55]
    : isMarketing
      ? [0.28, 0.42, 0.3]
      : isDark
        ? [0.35, 0.55, 0.38]
        : [0.45, 0.7, 0.45];

  /* Pages use their own surface; skip all animated layers for readability (map-style UIs, legal, dashboards). */
  if (isMarketing && overlayOnly) {
    return (
      <div className="pointer-events-none absolute inset-0 min-h-full overflow-hidden" aria-hidden="true" />
    );
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 min-h-full overflow-hidden"
      aria-hidden="true"
      style={{ perspective: 1200 }}
    >
      {!overlayOnly && (
        <div
          className="absolute inset-0"
          style={{
            background: isCheckout
              ? "linear-gradient(165deg, #faf5ff 0%, #fff7ed 28%, #f0f9ff 55%, #fef2f2 100%)"
              : isMarketing
                ? "linear-gradient(155deg, #fffbeb 0%, #fff7f5 30%, #ecfeff 58%, #f5f3ff 100%)"
                : isDark
                  ? "linear-gradient(180deg, #050508 0%, #0c0a14 45%, #08080f 100%)"
                  : "linear-gradient(160deg, #fafafa 0%, #fff7f5 40%, #f8fafc 100%)",
          }}
        />
      )}

      <motion.div
        className={blobA}
        animate={{ x: [0, 32, -18, 0], y: [0, -28, 14, 0], scale: [1, 1.12, 0.94, 1] }}
        transition={{ duration: t1, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className={blobB}
        animate={{ x: [0, -36, 20, 0], y: [0, 28, -12, 0], scale: [1, 0.92, 1.08, 1] }}
        transition={{ duration: t2, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className={blobC}
        animate={{ scale: [1, 1.15, 1], opacity: bottomBlobOpacity }}
        transition={{ duration: t3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />

      {!isMarketing && (
        <div
          className={`absolute inset-0 ${meshOpacity}`}
          style={{
            backgroundImage: `
            linear-gradient(${meshLine} 1px, transparent 1px),
            linear-gradient(90deg, ${meshLine} 1px, transparent 1px)
          `,
            backgroundSize: "48px 48px",
          }}
        />
      )}

      {!isMarketing && (
        <motion.div
          className="absolute inset-0"
          style={driftStyle}
          animate={{ opacity: driftOpacity }}
          transition={{ duration: 8, repeat: Infinity, ease: EASE }}
        />
      )}

      {isCheckout && (
        <>
          <GlossOrb
            className="left-[4%] top-[18%] h-20 w-20 md:left-[6%] md:top-[22%] md:h-28 md:w-28"
            delay={0}
            duration={13}
            label="🛡️"
          />
          <GlossOrb
            className="right-[8%] top-[32%] h-[4.5rem] w-[4.5rem] md:right-[10%] md:top-[28%] md:h-24 md:w-24"
            delay={1.2}
            duration={15}
            label="🔒"
          />
          <GlossOrb
            className="bottom-[28%] left-[12%] h-16 w-16 md:bottom-[22%] md:left-[8%] md:h-20 md:w-20"
            delay={2}
            duration={12}
            label="✨"
          />
          <GlossOrb
            className="right-[6%] bottom-[18%] h-14 w-14 md:right-[14%] md:bottom-[24%] md:h-[4.5rem] md:w-[4.5rem]"
            delay={0.4}
            duration={16}
            label="💳"
          />
          <FrostChip className="left-[8%] top-[42%] md:left-[18%] md:top-[48%]" delay={0.3}>
            Secure UPI
          </FrostChip>
          <FrostChip className="right-[6%] top-[52%] md:right-[20%] md:top-[56%]" delay={1.1}>
            Flat ₹1,499 · Saver ₹1,999
          </FrostChip>
        </>
      )}

      {variant === "subtle" && !isDark && (
        <GlossOrb
          className="right-[5%] top-[15%] h-14 w-14 opacity-70 md:right-[8%] md:h-16 md:w-16"
          delay={0}
          duration={18}
          label="📋"
        />
      )}

      {isDark && (
        <>
          <FrostChipDark className="left-[6%] top-[24%] opacity-90" delay={0}>
            24/7 support
          </FrostChipDark>
          <FrostChipDark className="right-[8%] bottom-[30%] opacity-90" delay={0.6}>
            Bengaluru
          </FrostChipDark>
        </>
      )}

      {!isMarketing && (
        <div
          className={`absolute -right-24 -top-24 h-64 w-64 rotate-12 rounded-full blur-2xl ${
            isDark ? "bg-gradient-to-br from-rose-500/20 to-transparent" : "bg-gradient-to-br from-white/50 to-transparent"
          }`}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
