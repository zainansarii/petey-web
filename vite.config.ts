import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/petey-web/",
  optimizeDeps: {
    include: [
      "@assistant-ui/react",
      "firebase/app",
      "firebase/app-check",
      "firebase/auth",
      "firebase/functions",
      "react",
      "react-dom",
    ],
  },
  plugins: [react()],
  resolve: {
    dedupe: ["@assistant-ui/core", "@assistant-ui/store", "react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    globals: true,
    exclude: [...configDefaults.exclude, "functions/**"],
  },
});
