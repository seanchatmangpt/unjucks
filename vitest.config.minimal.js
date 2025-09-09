// Minimal vitest config to bypass esbuild issues
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "tests/basic-test.js"
    ],
    exclude: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "tests/**/*.bak*"
    ],
    testTimeout: 10000,
    hookTimeout: 5000,
    teardownTimeout: 5000,
    passWithNoTests: true,
    reporters: ['default'],
    silent: false
  },
  esbuild: false, // Disable esbuild to avoid version conflicts
  optimizeDeps: {
    disabled: true
  }
});