import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  cacheDir: "../node_modules/.vite-david-lloyd",
  root: fileURLToPath(new URL("./david-lloyd-demo", import.meta.url)),
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  base: "/david-lloyd-demo/",
  publicDir: "public",
  plugins: [react()],
  resolve: { dedupe: ["@assistant-ui/core", "@assistant-ui/store", "react", "react-dom"] },
  build: { outDir: "../dist-david-lloyd", emptyOutDir: true },
});
