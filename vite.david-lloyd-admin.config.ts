import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  cacheDir: "../node_modules/.vite-david-lloyd-admin",
  root: fileURLToPath(new URL("./david-lloyd-demo-admin", import.meta.url)),
  base: "/david-lloyd-demo-admin/",
  publicDir: false,
  plugins: [react()],
  build: { outDir: "../dist-david-lloyd-admin", emptyOutDir: true },
});
