import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/petey-web/",
  build: {
    rollupOptions: {
      input: { main: "index.html", admin: "admin/index.html" },
    },
  },
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
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: "./src/test/setup.ts",
    css: true,
    globals: true,
    exclude: [...configDefaults.exclude, "functions/**"],
  },
});
