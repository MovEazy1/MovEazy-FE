import { defineConfig } from "vitest/config";

export default defineConfig({
  // JSX for the screen smoke tests (*.test.jsx); the app's own build uses the React plugin.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.test.js", "src/**/*.test.jsx"],
  },
});
