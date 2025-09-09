import { defineConfig } from "vitest/config";
import os from "node:os";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "tests/basic-test.js",
      "tests/unit/**/*.test.js",
      "tests/integration/**/*.test.js"
    ],
    exclude: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "tests/**/*.bak*",
      "tests/features/**",
      "tests/security/**",
      "tests/performance/**",
      "tests/validation/**",
      "tests/benchmarks/**",
      "tests/regression/**"
    ],
    testTimeout: 10000,
    hookTimeout: 5000,
    teardownTimeout: 5000,
    passWithNoTests: true,
    reporters: ['default'],
    silent: false,
    pool: "forks", // Use forks instead of threads to avoid esbuild
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: Math.min(4, Math.max(1, Math.floor(os.cpus().length * 0.5)))
      }
    }
  },
  // Disable esbuild completely
  esbuild: false,
  // Disable optimizations that might trigger esbuild
  optimizeDeps: {
    disabled: true
  },
  // Use native Node.js resolution
  resolve: {
    conditions: ['node', 'import']
  }
});