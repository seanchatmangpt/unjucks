#!/usr/bin/env tsx

import { execSync } from "node:child_process";
import path from "node:path";

/**
 * Stress Test Runner
 * 
 * This script runs all stress tests and provides a summary of results.
 * It's designed to catch performance regressions and validate system behavior under load.
 */

const STRESS_TEST_PATTERNS = [
  "tests/unit/stress/cli-stress.test.ts",
  "tests/unit/stress/generator-stress.test.ts", 
  "tests/unit/stress/memory-stress.test.ts",
  "tests/unit/stress/concurrent-stress.test.ts",
  "tests/unit/stress/filesystem-stress.test.ts",
];

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

async function runStressTest(testFile: string): Promise<TestResult> {
  const testName = path.basename(testFile, ".test.ts");
  const startTime = Date.now();

  try {
    console.log(`\n🧪 Running ${testName}...`);
    
    // Run the specific test file with Vitest
    execSync(`npx vitest run ${testFile}`, {
      stdio: "pipe",
      encoding: "utf8",
      cwd: process.cwd(),
      timeout: 300000, // 5 minutes timeout per test file
    });

    const duration = Date.now() - startTime;
    console.log(`✅ ${testName} passed in ${duration}ms`);
    
    return {
      name: testName,
      passed: true,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.log(`❌ ${testName} failed in ${duration}ms`);
    console.log(`   Error: ${error.message?.slice(0, 200)}...`);
    
    return {
      name: testName,
      passed: false,
      duration,
      error: error.message,
    };
  }
}

async function runAllStressTests(): Promise<void> {
  console.log("🚀 Starting Unjucks Stress Test Suite");
  console.log("=====================================");
  
  const results: TestResult[] = [];
  const totalStartTime = Date.now();

  // Run each stress test
  for (const testFile of STRESS_TEST_PATTERNS) {
    try {
      const result = await runStressTest(testFile);
      results.push(result);
    } catch (error) {
      console.error(`Failed to run ${testFile}:`, error);
      results.push({
        name: path.basename(testFile, ".test.ts"),
        passed: false,
        duration: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const totalDuration = Date.now() - totalStartTime;

  // Generate summary report
  console.log("\n📊 Stress Test Summary");
  console.log("=====================");
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalTests = results.length;
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / totalTests) * 100).toFixed(1)}%`);
  console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  
  if (failed > 0) {
    console.log("\n❌ Failed Tests:");
    for (const result of results.filter(r => !r.passed)) {
      console.log(`  • ${result.name}: ${result.error?.slice(0, 100)}...`);
    }
  }

  if (passed > 0) {
    console.log("\n✅ Passed Tests:");
    for (const result of results.filter(r => r.passed)) {
      console.log(`  • ${result.name}: ${(result.duration / 1000).toFixed(2)}s`);
    }
  }

  // Performance analysis
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const slowTests = results.filter(r => r.duration > avgDuration * 1.5);
  
  if (slowTests.length > 0) {
    console.log("\n⚠️  Slower Than Average Tests:");
    for (const test of slowTests) {
      console.log(`  • ${test.name}: ${(test.duration / 1000).toFixed(2)}s`);
    }
  }

  // Exit with error code if any tests failed
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("\n🎉 All stress tests passed!");
    process.exit(0);
  }
}

// Check if we're being run directly
if (require.main === module) {
  runAllStressTests().catch((error) => {
    console.error("Fatal error running stress tests:", error);
    process.exit(1);
  });
}

export { runAllStressTests };