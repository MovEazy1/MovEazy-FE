// Shared full-page animated backdrop + stacking for marketing and app pages
import PremiumPageBackdrop from "../ui/PremiumPageBackdrop";

/**
 * @param {"checkout" | "marketing" | "subtle" | "dark"} variant
 * @param {boolean} overlayOnly — page keeps its own surface color. With variant `marketing`, no backdrop is drawn (readability).
 * @param {boolean} fixedBackdrop — pin backdrop to viewport (home, checkout-style pages)
 */
export default function PageShell({
  variant = "marketing",
  overlayOnly = false,
  fixedBackdrop = false,
  minHeight = true,
  className = "",
  style,
  children,
}) {
  const layer = fixedBackdrop ? "pointer-events-none fixed inset-0 z-0" : "pointer-events-none absolute inset-0 z-0 min-h-full";

  const showBackdrop = !(variant === "marketing" && overlayOnly);

  return (
    <div
      className={`relative overflow-x-hidden ${minHeight ? "min-h-[100dvh]" : ""} ${className}`.trim()}
      style={style}
    >
      {showBackdrop ? (
        <div className={layer}>
          <PremiumPageBackdrop variant={variant} overlayOnly={overlayOnly} />
        </div>
      ) : null}
      {children}
    </div>
  );
}
