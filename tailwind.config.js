// ─────────────────────────────────────────────────────────────────────────────
// tailwind.config.js  — enhanced with premium glow / animation tokens
// ─────────────────────────────────────────────────────────────────────────────

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {

      // ── Brand colors ────────────────────────────────────────────────────
      colors: {
        primary: {
          DEFAULT: "#FF3131",
          dark:    "#DC2626",
          darker:  "#B91C1C",
          light:   "#FECACA",
          soft:    "#FFF4F2",
          glow:    "#FF8A7A",
        },
        ink: {
          DEFAULT: "#292524",
          muted:   "#57534E",
          subtle:  "#78716C",
        },
        surface: {
          white:   "#FFFFFF",
          pink:    "#FFF4F2",
          mist:    "#F0F9FF",
          dark:    "#1C1917",
        },
      },

      // ── Typography ───────────────────────────────────────────────────────
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },

      // ── Box shadows ──────────────────────────────────────────────────────
      boxShadow: {
        card:          "0 4px 24px rgba(0,0,0,0.08)",
        "card-lg":     "0 8px 40px rgba(0,0,0,0.13)",
        red:           "0 6px 24px rgba(239,68,68,0.32)",
        "red-lg":      "0 10px 40px rgba(239,68,68,0.40)",
        navbar:        "0 2px 24px rgba(0,0,0,0.09)",
        "navbar-glow": "0 4px 32px rgba(232,90,79,0.15), 0 2px 12px rgba(0,0,0,0.10)",
        // Premium glow shadows
        "glow-coral":  "0 0 30px rgba(232,90,79,0.50), 0 0 60px rgba(232,90,79,0.25)",
        "glow-coral-lg":"0 0 50px rgba(232,90,79,0.65), 0 0 100px rgba(232,90,79,0.30)",
        "glow-blue":   "0 0 30px rgba(14,165,233,0.40)",
        "glow-purple": "0 0 30px rgba(168,85,247,0.40)",
        "glass":       "0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.15)",
        "card-3d":     "0 20px 60px rgba(0,0,0,0.16), 0 4px 12px rgba(0,0,0,0.08)",
      },

      // ── Border radius ────────────────────────────────────────────────────
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },

      // ── Keyframe animations ──────────────────────────────────────────────
      keyframes: {
        shimmer: {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "33%":      { transform: "translateY(-14px) rotate(1deg)" },
          "66%":      { transform: "translateY(-8px) rotate(-0.5deg)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0px) scale(1)" },
          "50%":      { transform: "translateY(-22px) scale(1.04)" },
        },
        "float-delayed": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-12px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 24px rgba(232,90,79,0.45), 0 4px 20px rgba(232,90,79,0.30)" },
          "50%":      { boxShadow: "0 0 55px rgba(232,90,79,0.85), 0 0 90px rgba(232,90,79,0.35), 0 4px 20px rgba(232,90,79,0.40)" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%":      { backgroundPosition: "100% 50%" },
        },
        "spin-slow": {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "draw-line": {
          "0%":   { strokeDashoffset: "200" },
          "100%": { strokeDashoffset: "0" },
        },
        "blob-move": {
          "0%, 100%": { borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%", transform: "scale(1)" },
          "25%":      { borderRadius: "30% 60% 70% 40% / 50% 60% 30% 60%", transform: "scale(1.05)" },
          "50%":      { borderRadius: "50% 60% 30% 60% / 30% 60% 70% 40%", transform: "scale(0.96)" },
          "75%":      { borderRadius: "60% 40% 60% 40% / 70% 30% 60% 50%", transform: "scale(1.03)" },
        },
        "glow-number": {
          "0%, 100%": { textShadow: "0 0 20px rgba(232,90,79,0.5)" },
          "50%":      { textShadow: "0 0 50px rgba(232,90,79,0.9), 0 0 80px rgba(232,90,79,0.4)" },
        },
      },

      // ── Animation utilities ──────────────────────────────────────────────
      animation: {
        shimmer:           "shimmer 3s linear infinite",
        float:             "float 5s ease-in-out infinite",
        "float-slow":      "float-slow 7s ease-in-out infinite",
        "float-delayed":   "float-delayed 6s ease-in-out infinite 1.5s",
        "pulse-glow":      "pulse-glow 2.5s ease-in-out infinite",
        "gradient-shift":  "gradient-shift 5s ease infinite",
        "spin-slow":       "spin-slow 20s linear infinite",
        "blob-move":       "blob-move 10s ease-in-out infinite",
        "glow-number":     "glow-number 2s ease-in-out infinite",
      },
    },
  },

  plugins: [],
};
