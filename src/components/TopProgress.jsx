/**
 * A thin animated line across the top of the screen while an app that opened
 * on its saved copy fetches the fresh one — the cue that what is showing may
 * change in a second. Nothing at all when `active` is false.
 */
export default function TopProgress({ active, color = "#10B981" }) {
  if (!active) return null;
  return (
    <div role="progressbar" aria-label="Updating" aria-busy="true"
      style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 2147483000, overflow: "hidden", pointerEvents: "none" }}>
      <style>{`
        @keyframes mz-top-progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
        @media (prefers-reduced-motion: reduce) { .mz-top-progress { animation-duration: 3s !important; } }
      `}</style>
      <div className="mz-top-progress"
        style={{ width: "40%", height: "100%", background: color, borderRadius: 3, animation: "mz-top-progress 1.1s ease-in-out infinite" }} />
    </div>
  );
}
