import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: [
      "tests/filters/**/*.test.js"
    ],
    exclude: [
      "node_modules/**",
      "dist/**"
    ],
    testTimeout: 10000,
    hookTimeout: 5000,
    reporters: ['verbose'],
    pool: "threads",
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 4,
      }
    }
  }
});