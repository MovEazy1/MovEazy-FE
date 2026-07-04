import logoLight from "../../assets/logo/moveazy-logo-light.png";
import logoDark from "../../assets/logo/moveazy-logo-dark.png";

const SIZE_CLASS = {
  nav: "h-8 w-auto max-w-[180px] object-contain object-left",
  sm: "h-7 w-auto max-w-[160px] object-contain object-left",
  md: "h-9 w-auto max-w-[220px] object-contain object-left",
  lg: "h-11 w-auto max-w-[280px] sm:h-12 sm:max-w-[320px] object-contain object-left",
  footer: "h-9 w-auto max-w-[200px] object-contain object-left",
};

/**
 * Official MovEazy wordmark.
 * @param {"light" | "dark"} variant — light = for white/light backgrounds; dark = for black/dark backgrounds
 */
export default function MovEazyLogo({ variant = "light", size = "md", className = "" }) {
  const src = variant === "dark" ? logoDark : logoLight;
  const imgClass = SIZE_CLASS[size] ?? SIZE_CLASS.md;

  return (
    <span className={`inline-flex shrink-0 items-center ${className}`} role="img" aria-label="MovEazy">
      <img src={src} alt="" draggable={false} className={`block ${imgClass}`} />
    </span>
  );
}
