import { defineConfig } from "vitest/config";
import os from "node:os";

export default defineConfig({
  test: {
    typecheck: { enabled: false }, // Disabled for JavaScript
    coverage: {
      provider: 'v8',
      reporter: ["text", "clover", "json", "html", "text-summary", "lcov"],
      include: ["src/**/*.js"], // Changed from .ts to .js
      exclude: [
        "src/**/*.test.js", // Changed from .ts to .js
        "src/**/*.bench.js", // Changed from .ts to .js
        "src/**/*.d.ts",
        "src/**/types.js", // Changed from .ts to .js
        "src/cli.js", // Changed from .ts to .js
        "tests/**/*.js", // Changed from .ts to .js
        "tests/step-definitions/**/*.js", // Changed from .ts to .js
        "tests/support/**/*.js", // Changed from .ts to .js
      ],
      reportsDirectory: 'reports/coverage',
      thresholds: {
        global: {
          branches: 75,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        "src/lib/generator.js": { // Changed from .ts to .js
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        "src/lib/template-scanner.js": { // Changed from .ts to .js
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90,
        }
      }
    },
    // Performance testing configuration
    benchmark: {
      include: ["tests/benchmarks/**/*.bench.js", "tests/performance/**/*.bench.js"], // Changed from .ts to .js
      reporters: ["verbose"],
      outputFile: "reports/benchmark-results.json"
    },
    // Test environment setup
    environment: "node",
    globals: true,
    // setupFiles: ["./tests/setup.js"], // Changed from .ts to .js
    // Test file patterns - Vitest unit tests and BDD feature specs
    include: [
      "tests/**/*.test.js", // All existing test files - changed from .ts to .js
      "tests/**/*.spec.js", // Performance and other spec files - changed from .ts to .js
      "tests/unit/**/*.test.js", // Future unit tests - changed from .ts to .js
      "tests/integration/**/*.test.js", // Future integration tests - changed from .ts to .js
      "tests/features/**/*.feature.spec.js", // Vitest-cucumber BDD specs - changed from .ts to .js
      "tests/performance/**/*.spec.js", // Performance benchmarks - changed from .ts to .js
      "src/**/*.test.js", // Co-located unit tests - changed from .ts to .js
    ],
    exclude: [
      "node_modules/**",
      "dist/**",
      "generated/**",
      "playground/**",
      "test-citty/**", // Test project directory
      "coordination/**", // Project management files
      "memory/**", // Memory/agent files
      "features/**/*.feature", // Original feature files (reference only)
      "tests/step-definitions/**", // Legacy Cucumber step definitions
      "tests/support/world.js", // Legacy Cucumber World class - changed from .ts to .js
      "claude-flow*", // Claude flow files
      "*.md", // Documentation files
    ],
    // Optimized timeouts for fast execution
    testTimeout: 15_000, // Reduced for faster failure detection
    hookTimeout: 5_000, // Faster setup/teardown
    teardownTimeout: 5_000, // Quick cleanup
    // Snapshot configuration
    snapshotFormat: {
      escapeString: true,
      printBasicPrototype: true,
    },
    // Mock configuration
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    // Multi-format reporting
    reporters: process.env.CI 
      ? ['json', 'github-actions']
      : ['default', 'verbose'],
    outputFile: {
      json: "reports/test-results.json",
    },
    // Silent mode for faster execution (less I/O)
    silent: process.env.NODE_ENV === 'test',
    // High-performance parallel execution - 3x+ speed improvement
    pool: "threads",
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: Math.min(8, Math.max(2, Math.floor(os.cpus().length * 0.8))), // 80% of CPU cores, max 8
        useAtomics: true, // Enable shared memory for faster communication
        isolate: false, // Share contexts where safe for better performance
      },
    },
    // Smart test isolation and sequencing
    testNamePattern: undefined,
    sequence: {
      concurrent: true, // Enable concurrent execution for massive speed gains
      shuffle: false, // Deterministic test order for consistency
      hooks: 'parallel', // Parallel hook execution
      setupFiles: 'parallel', // Parallel setup for faster startup
    },
    // Intelligent test caching for unchanged scenarios
    // Note: cache.dir is deprecated, use cacheDir at the root level instead
    // Performance optimizations
    isolate: false, // Share contexts between tests for better performance
    passWithNoTests: true,
    logHeapUsage: true, // Monitor memory usage
    
    // Watch mode optimizations
    watch: true,
    // BDD integration: vitest-cucumber handles .feature.spec.js files
    // Original .feature files remain as reference/documentation
    // Unified test runner handles both unit tests and BDD scenarios
  },
  // Use Vite's cacheDir instead of deprecated cache.dir
  cacheDir: 'node_modules/.vitest',
});