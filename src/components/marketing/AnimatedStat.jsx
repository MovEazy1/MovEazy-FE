import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";

function parseStat(value) {
  const match = String(value).match(/^([\d.]+)(.*)$/);
  if (!match) return { target: 0, suffix: value, decimals: 0 };
  const num = Number(match[1]);
  const suffix = match[2] || "";
  const decimals = match[1].includes(".") ? 1 : 0;
  return { target: num, suffix, decimals };
}

export default function AnimatedStat({ value, label, suffix: suffixProp }) {
  const { ref, inView } = useInView({ threshold: 0.35, triggerOnce: true });
  const parsed = parseStat(value);
  const { target, decimals } = parsed;
  const suffix = suffixProp ?? parsed.suffix;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return undefined;
    const duration = 1400;
    const start = performance.now();
    let frame = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(target * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, target]);

  const formatted =
    decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString("en-IN");

  return (
    <div ref={ref} className="mkt-stat-item">
      <div className="mkt-stat-value">
        {formatted}
        {suffix}
      </div>
      <div className="mkt-stat-label">{label}</div>
    </div>
  );
}
