import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "../vitest.config.js";

/**
 * Vitest configuration specifically for Cucumber BDD testing
 * Phase 1 Migration: Core infrastructure for vitest-cucumber integration
 * 
 * Features:
 * - @amiceli/vitest-cucumber integration for .feature.spec.ts files
 * - Parallel execution with optimized performance
 * - Proper test isolation and coverage
 * - Hot reload for feature files
 * - Legacy cucumber.config.cjs compatibility bridge
 */
export default mergeConfig(baseConfig, defineConfig({
  test: {
    // BDD-specific test patterns
    include: [
      "tests/features/**/*.feature.spec.ts", // Primary vitest-cucumber specs
      "tests/features/**/*.test.ts", // Additional BDD unit tests
    ],
    exclude: [
      ...baseConfig.test?.exclude || [],
      "features/**/*.feature", // Original .feature files (reference only)
      "tests/step-definitions/**", // Legacy step definitions
      "cucumber.config.cjs", // Legacy cucumber config
    ],
    
    // BDD-optimized configuration
    testTimeout: 20_000, // Slightly higher for BDD scenarios
    hookTimeout: 8_000,
    
    // BDD reporters - more verbose for scenario tracking
    reporters: process.env.CI 
      ? ['json', 'github-actions', 'junit'] 
      : ['default', 'verbose'],
    
    outputFile: {
      json: "reports/vitest-cucumber-results.json",
      junit: "reports/vitest-cucumber-junit.xml",
    },
    
    // Coverage for BDD scenarios
    coverage: {
      ...baseConfig.test?.coverage,
      reporter: ["text", "html", "json"] as const,
      reportsDirectory: "./coverage/cucumber",
    },
    
    // Environment setup for BDD scenarios
    globalSetup: ["./tests/setup.ts"],
    
    // Watch mode optimizations - handled by chokidar config
    
    // Cucumber-style test naming and organization
    testNamePattern: undefined, // Allow vitest-cucumber to handle naming
    
    // Performance: BDD scenarios can benefit from parallel execution
    pool: "threads",
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 4, // Conservative for BDD stability
        isolate: true, // More isolation for BDD scenario integrity
      },
    },
    
    // BDD-specific globals that might be needed
    globals: true,
    
    // Environment variables for BDD testing
    env: {
      NODE_ENV: "test",
      VITEST_CUCUMBER: "true",
      TEST_MODE: "bdd",
    },
  },
  
  // Define aliases for BDD test organization
  resolve: {
    alias: {
      "@features": "./tests/features",
      "@support": "./tests/support", 
      "@fixtures": "./tests/fixtures",
    },
  },
}));