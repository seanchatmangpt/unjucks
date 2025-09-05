import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    typecheck: { enabled: true },
    coverage: {
      reporter: ["text", "clover", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.bench.ts",
        "src/**/*.d.ts",
        "src/**/types.ts",
        "src/cli.ts", // CLI entry point doesn't need coverage
        "tests/**/*.ts", // Exclude test files from coverage
        "tests/**/*.feature", // Exclude feature files from coverage
      ],
      thresholds: {
        global: {
          branches: 75,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // Specific thresholds for core unjucks components
        "src/lib/generator.ts": {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        "src/lib/template-scanner.ts": {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        "src/lib/dynamic-commands.ts": {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        "src/lib/prompts.ts": {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        // Command files have lower thresholds as they're mostly CLI wrappers
        "src/commands/**/*.ts": {
          branches: 70,
          functions: 75,
          lines: 75,
          statements: 75,
        },
      },
    },
    // Performance testing configuration
    benchmark: {
      include: ["tests/benchmarks/**/*.bench.ts"],
      reporters: ["verbose"],
      outputFile: "benchmark-results.json",
    },
    // Test environment setup
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // Test file patterns - match actual project structure + Cucumber
    include: [
      "tests/**/*.test.ts", // All existing test files
      "tests/unit/**/*.test.ts", // Future unit tests
      "tests/integration/**/*.test.ts", // Future integration tests
      "tests/features/**/*.feature", // Cucumber feature files
      "tests/step-definitions/**/*.ts", // Cucumber step definitions
    ],
    exclude: [
      "node_modules/**",
      "dist/**",
      "generated/**",
      "playground/**",
      "test-citty/**", // Test project directory
      "coordination/**", // Project management files
      "memory/**", // Memory/agent files
      "features/**", // Feature files (project management)
      "claude-flow*", // Claude flow files
      "*.md", // Documentation files
    ],
    // Test timeout - increased for file system operations and BDD tests
    testTimeout: 45000, // Increased for Cucumber scenarios
    hookTimeout: 15000, // Increased for setup/teardown
    // Snapshot configuration
    snapshotFormat: {
      escapeString: true,
      printBasicPrototype: true,
    },
    // Mock configuration
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    // Reporter configuration - enhanced for BDD
    reporters: ["verbose", "json"],
    outputFile: {
      json: "test-results.json",
    },
    // Parallel execution - conservative for file system tests
    pool: "threads",
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 2, // Reduced for file system operations
      },
    },
    // File system and CLI testing specific config
    testNamePattern: undefined,
    // Allow tests to run in sequence when needed for file operations
    sequence: {
      concurrent: false,
    },
    // Note: Cucumber configuration is handled separately via cucumber.config.js
    // Use 'pnpm test:cucumber' to run BDD tests with proper Cucumber runner
  },
});
