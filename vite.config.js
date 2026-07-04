import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Production config — env loaded from .env
export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    /* Safer than esnext for older mobile WebViews (blank screen if syntax unsupported) */
    target: ["es2020", "edge88", "firefox78", "chrome87", "safari14"],
  },
});
