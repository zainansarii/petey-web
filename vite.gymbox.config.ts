import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  cacheDir: "../node_modules/.vite-gymbox",
  root: fileURLToPath(new URL("./gymbox-demo", import.meta.url)),
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  base: "/gymbox-demo/",
  publicDir: "public",
  plugins: [react()],
  resolve: { dedupe: ["@assistant-ui/core", "@assistant-ui/store", "react", "react-dom"] },
  build: { outDir: "../dist-gymbox", emptyOutDir: true },
});
