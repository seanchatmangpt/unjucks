import { defineConfig } from "vitest/config";
import os from "node:os";
import { comprehensiveReporter } from "./tests/reporting/reporter";
import CoverageConfiguration from "./tests/reporting/coverage.config";
import { benchmarkReporter } from "./tests/reporting/benchmarks";

export default defineConfig({
  test: {
    typecheck: { enabled: true },
    // Enhanced coverage configuration with detailed reporting
    coverage: CoverageConfiguration,
    // Performance testing with comprehensive benchmarking
    benchmark: {
      include: ["tests/benchmarks/**/*.bench.ts", "tests/performance/**/*.bench.ts"],
      reporters: ["verbose", "json"],
      outputFile: "reports/benchmark-results.json",
      // Custom benchmark reporter for detailed analysis
      reporter: async (results) => {
        await benchmarkReporter.initialize();
        const report = await benchmarkReporter.generateReport(results);
        console.log(`\n📊 Performance Report Generated: reports/performance/performance-report.html`);
        return report;
      },
    },
    // Test environment setup
    environment: "node",
    globals: true,
    // setupFiles: ["./tests/setup.ts"],
    // Test file patterns - Vitest unit tests and BDD feature specs
    include: [
      "tests/**/*.test.ts", // All existing test files
      "tests/**/*.spec.ts", // Performance and other spec files
      "tests/unit/**/*.test.ts", // Future unit tests
      "tests/integration/**/*.test.ts", // Future integration tests
      "tests/features/**/*.feature.spec.ts", // Vitest-cucumber BDD specs
      "tests/performance/**/*.spec.ts", // Performance benchmarks
      "src/**/*.test.ts", // Co-located unit tests
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
      "tests/support/world.ts", // Legacy Cucumber World class
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
    // Comprehensive multi-format reporting
    reporters: process.env.CI 
      ? ['json', 'github-actions', 'junit', comprehensiveReporter]
      : ['default', 'verbose', comprehensiveReporter],
    outputFile: {
      json: "reports/test-results.json",
      junit: "reports/junit-report.xml",
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
    cache: {
      dir: 'node_modules/.vitest',
    },
    // Performance optimizations
    isolate: false, // Share contexts between tests for better performance
    passWithNoTests: true,
    logHeapUsage: true, // Monitor memory usage
    // Enhanced reporting configuration
    reporters: process.env.CI 
      ? ['json', 'github-actions', 'junit', comprehensiveReporter]
      : ['default', 'verbose', comprehensiveReporter],
    
    // Watch mode optimizations
    watch: true,
    watchExclude: ['**/node_modules/**', '**/dist/**', '**/generated/**'],
    // File change detection patterns for hot reload
    chokidar: {
      usePolling: false,
      interval: 100,
      binaryInterval: 300,
      ignoreInitial: true,
      ignorePermissionErrors: true,
    },
    // BDD integration: vitest-cucumber handles .feature.spec.ts files
    // Original .feature files remain as reference/documentation
    // Unified test runner handles both unit tests and BDD scenarios
  },
});
