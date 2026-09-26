import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("./third-space-demo", import.meta.url)),
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  base: "/third-space-demo/",
  publicDir: "public",
  plugins: [react()],
  resolve: { dedupe: ["@assistant-ui/core", "@assistant-ui/store", "react", "react-dom"] },
  build: { outDir: "../dist-third-space", emptyOutDir: true },
});
