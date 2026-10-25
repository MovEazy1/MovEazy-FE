import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Production config — env loaded from .env
export default defineConfig({
  plugins: [react()],
  base: "/",
  // Honor a host-assigned PORT (e.g. preview harness) when present; falls back to Vite's default.
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
  build: {
    // Fonts stay files, never inlined into the CSS: each subset (latin,
    // latin-ext, …) downloads only if the page has its characters, and an
    // inlined one would be paid for on every page (src/styles/fonts.css).
    assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf|eot)$/i.test(file) ? false : undefined),
    /* Safer than esnext for older mobile WebViews (blank screen if syntax unsupported) */
    target: ["es2020", "edge88", "firefox78", "chrome87", "safari14"],
  },
});
