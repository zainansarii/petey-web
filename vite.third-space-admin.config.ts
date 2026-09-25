import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("./third-space-demo-admin", import.meta.url)),
  base: "/third-space-demo-admin/",
  publicDir: false,
  plugins: [react()],
  build: { outDir: "../dist-third-space-admin", emptyOutDir: true },
});
