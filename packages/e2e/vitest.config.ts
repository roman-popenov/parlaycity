import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    globalSetup: ["./globalSetup.ts"],
    sequence: { concurrent: false },
    fileParallelism: false,
    cache: false,
  },
});
