// src/components/ui/Tilt3D.jsx
// Reusable 3D mouse-tilt wrapper using Framer Motion
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useRef } from "react";

/**
 * Tilt3D — wraps children in a 3D perspective tilt card.
 *
 * @param {number}  intensity  Max rotation in degrees (default 8)
 * @param {number}  scale      Scale on hover (default 1.02)
 * @param {string}  className  Forwarded to the motion.div wrapper
 */
export default function Tilt3D({ children, className = "", intensity = 8, scale = 1.02, style = {} }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useTransform(y, [-120, 120], [intensity, -intensity]);
  const rotateY = useTransform(x, [-120, 120], [-intensity, intensity]);

  const springConfig = { stiffness: 220, damping: 22 };
  const rotateXSpring = useSpring(rotateX, springConfig);
  const rotateYSpring = useSpring(rotateY, springConfig);

  const handleMouseMove = (e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set(e.clientX - cx);
    y.set(e.clientY - cy);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        rotateX: rotateXSpring,
        rotateY: rotateYSpring,
        transformStyle: "preserve-3d",
        perspective: "1200px",
        ...style,
      }}
      whileHover={{ scale }}
      transition={{ scale: { duration: 0.25 } }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </motion.div>
  );
}
