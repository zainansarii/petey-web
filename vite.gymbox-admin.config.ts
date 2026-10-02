import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  cacheDir: "../node_modules/.vite-gymbox-admin",
  root: fileURLToPath(new URL("./gymbox-demo-admin", import.meta.url)),
  base: "/gymbox-demo-admin/",
  publicDir: false,
  plugins: [react()],
  build: { outDir: "../dist-gymbox-admin", emptyOutDir: true },
});
