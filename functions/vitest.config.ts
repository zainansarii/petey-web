import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: process.env.FIRESTORE_EMULATOR_HOST ? 30_000 : 5_000,
    hookTimeout: 30_000,
  },
});
