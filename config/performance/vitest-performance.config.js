import { defineConfig } from "vitest/config";
import os from "node:os";

export default defineConfig({
  test: {
    // Performance benchmarking configuration
    benchmark: {
      include: [
        "tests/performance/**/*.bench.js",
        "tests/benchmarks/**/*.bench.js"
      ],
      exclude: [
        "node_modules/**",
        "dist/**"
      ],
      reporters: ["verbose", "json"],
      outputFile: {
        json: "reports/performance/benchmark-results.json",
        verbose: "reports/performance/benchmark-detailed.txt"
      },
      // Fortune 5 scale benchmarking
      warmupIterations: 100,
      iterations: 1000,
      time: 30000, // 30 seconds per benchmark
      warmupTime: 10000, // 10 seconds warmup
    },
    
    // Performance test configuration
    include: [
      "tests/performance/**/*.test.js",
      "tests/load/**/*.test.js",
      "tests/stress/**/*.test.js"
    ],
    
    // Extended timeouts for performance tests
    testTimeout: 300_000, // 5 minutes for performance tests
    hookTimeout: 60_000,  // 1 minute for setup/teardown
    
    // Memory profiling
    logHeapUsage: true,
    
    // Parallel execution for load testing
    pool: "threads",
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: Math.min(16, os.cpus().length), // Scale with CPU cores
        useAtomics: true,
        isolate: true, // Isolate for accurate performance measurements
      },
    },
    
    // Performance reporting
    reporters: ["verbose", "json", "html"],
    outputFile: {
      json: "reports/performance/test-results.json",
      html: "reports/performance/test-results.html"
    },
    
    // Environment setup
    environment: "node",
    globals: true,
    setupFiles: ["tests/performance/setup.js"],
    
    // Coverage for performance impact analysis
    coverage: {
      enabled: false, // Disable during performance tests to avoid overhead
    }
  },
  
  // Cache configuration for consistent benchmarking
  cacheDir: 'node_modules/.vitest-performance',
});