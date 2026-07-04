import { useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import useGsapStaggerReveal from "../../hooks/useGsapStaggerReveal";

const STATS = [
  { value: 1000, suffix: "+",  label: "Moves Simplified Across Bangalore", accent: "#e85a4f" },
  { value: 200,   suffix: "+",  label: "Trusted Broker Partners",         accent: "#f97316" },
  { value: 90,    suffix: "%+", label: "Users Found a Home Within 7 Days", accent: "#ec4899" },
];

function useCounter(target, duration, start) {
  const [count, setCount] = useState(0);
  const rafRef   = useRef(null);
  const beganRef = useRef(false);

  useEffect(() => {
    if (!start || beganRef.current) return;
    beganRef.current = true;
    const startTime = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [start, target, duration]);

  return count;
}

function StatItem({ stat, inView, index }) {
  const count     = useCounter(stat.value, 1300, inView);
  const formatted = count.toLocaleString("en-IN");

  return (
    <div className="flex flex-col items-center text-center px-2 sm:px-4" data-gsap-reveal>
      {/* Glowing number */}
      <span
        className="text-[30px] sm:text-[46px] lg:text-[58px] font-bold leading-none tracking-tight"
        style={{
          color: stat.accent,
          textShadow: `0 0 30px ${stat.accent}70, 0 0 60px ${stat.accent}35`,
          animation: "glow-number 2.5s ease-in-out infinite",
          animationDelay: `${index * 0.4}s`,
        }}
      >
        {formatted}
        {stat.suffix}
      </span>

      <span className="mt-1.5 text-[11px] sm:text-[13px] lg:text-[14px] text-gray-400 max-w-[150px] sm:max-w-[180px] leading-snug">
        {stat.label}
      </span>
    </div>
  );
}

export default function Stats() {
  const { ref, inView } = useInView({ threshold: 0.35, triggerOnce: true });
  const sectionRef = useGsapStaggerReveal({ y: 20, stagger: 0.14, start: "top 84%" });

  return (
    <section ref={sectionRef} className="bg-transparent py-0">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          ref={ref}
          className="relative rounded-xl sm:rounded-2xl lg:rounded-[28px] px-3 sm:px-6 lg:px-8 py-5 sm:py-10 lg:py-12 overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #0f0a0a 0%, #1a0808 40%, #0a0a14 100%)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          {/* Ambient corner glows */}
          <div
            className="absolute -top-12 -left-12 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(232,90,79,0.25) 0%, transparent 70%)" }}
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-12 -right-12 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(14,165,233,0.18) 0%, transparent 70%)" }}
            aria-hidden="true"
          />
          {/* Gradient border */}
          <div
            className="absolute inset-0 rounded-xl sm:rounded-2xl lg:rounded-[28px] pointer-events-none"
            style={{
              border: "1px solid rgba(232,90,79,0.18)",
              background: "transparent",
            }}
            aria-hidden="true"
          />

          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-0 items-center">
            {STATS.map((stat, i) => (
              <div key={stat.label} className="relative flex justify-center sm:min-h-[120px]">
                <StatItem stat={stat} inView={inView} index={i} />

                {i < STATS.length - 1 && (
                  <>
                    {/* desktop divider with gradient */}
                    <div
                      className="hidden sm:block absolute right-0 top-1/2 -translate-y-1/2 h-14 w-px"
                      style={{
                        background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.12), transparent)",
                      }}
                    />
                    {/* mobile divider */}
                    <div
                      className="sm:hidden absolute -bottom-2 left-1/2 -translate-x-1/2 h-px w-12"
                      style={{
                        background: "linear-gradient(to right, transparent, rgba(255,255,255,0.12), transparent)",
                      }}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
