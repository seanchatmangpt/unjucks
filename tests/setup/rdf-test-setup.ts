/**
 * RDF Test Setup - Comprehensive test environment for RDF/Turtle validation
 */
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

// Global test environment
declare global {
  var __RDF_TEST_ENV__: {
    tempDir: string;
    fixturesDir: string;
    testStartTime: number;
    memoryBaseline: NodeJS.MemoryUsage;
    testMetrics: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      performanceTests: Array<{
        name: string;
        duration: number;
        memoryUsed: number;
      }>;
    };
  };
}

// Initialize test environment
beforeAll(async () => {
  const testStartTime = performance.now();
  const memoryBaseline = process.memoryUsage();
  
  // Create temporary directory for test operations
  const tempDir = path.join(os.tmpdir(), `unjucks-rdf-test-${Date.now()}`);
  await fs.ensureDir(tempDir);
  
  // Set up fixtures directory path
  const fixturesDir = path.resolve(__dirname, '../fixtures/turtle');
  
  // Initialize global test environment
  globalThis.__RDF_TEST_ENV__ = {
    tempDir,
    fixturesDir,
    testStartTime,
    memoryBaseline,
    testMetrics: {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      performanceTests: []
    }
  };
  
  // Verify fixtures exist
  if (!await fs.pathExists(fixturesDir)) {
    console.warn(`RDF fixtures directory not found: ${fixturesDir}`);
  }
  
  console.log(`🔧 RDF Test Environment initialized:`);
  console.log(`   Temp directory: ${tempDir}`);
  console.log(`   Fixtures directory: ${fixturesDir}`);
  console.log(`   Memory baseline: ${Math.round(memoryBaseline.heapUsed / 1024 / 1024)}MB`);
});

// Track test execution
beforeEach(() => {
  globalThis.__RDF_TEST_ENV__.testMetrics.totalTests++;
});

afterEach(() => {
  // Track memory usage after each test
  const currentMemory = process.memoryUsage();
  const memoryIncrease = currentMemory.heapUsed - globalThis.__RDF_TEST_ENV__.memoryBaseline.heapUsed;
  
  if (memoryIncrease > 50 * 1024 * 1024) { // 50MB threshold
    console.warn(`⚠️  High memory usage detected: +${Math.round(memoryIncrease / 1024 / 1024)}MB`);
  }
});

// Cleanup test environment
afterAll(async () => {
  if (globalThis.__RDF_TEST_ENV__?.tempDir) {
    try {
      await fs.remove(globalThis.__RDF_TEST_ENV__.tempDir);
      console.log(`🧹 Cleaned up temp directory: ${globalThis.__RDF_TEST_ENV__.tempDir}`);
    } catch (error) {
      console.warn(`Failed to cleanup temp directory: ${error}`);
    }
  }
  
  // Print test summary
  const { testMetrics, testStartTime } = globalThis.__RDF_TEST_ENV__;
  const totalTime = performance.now() - testStartTime;
  
  console.log(`\n📊 RDF Test Summary:`);
  console.log(`   Total tests: ${testMetrics.totalTests}`);
  console.log(`   Total time: ${Math.round(totalTime)}ms`);
  console.log(`   Average per test: ${Math.round(totalTime / testMetrics.totalTests)}ms`);
  
  if (testMetrics.performanceTests.length > 0) {
    const avgPerformance = testMetrics.performanceTests.reduce((sum, test) => sum + test.duration, 0) / testMetrics.performanceTests.length;
    console.log(`   Average performance test time: ${Math.round(avgPerformance)}ms`);
  }
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// Helper functions for tests
export const getRDFTestEnv = () => globalThis.__RDF_TEST_ENV__;

export const createTestTurtleFile = async (filename: string, content: string): Promise<string> => {
  const filePath = path.join(globalThis.__RDF_TEST_ENV__.tempDir, filename);
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
};

export const loadFixture = async (fixtureName: string): Promise<string> => {
  const fixturePath = path.join(globalThis.__RDF_TEST_ENV__.fixturesDir, fixtureName);
  if (!await fs.pathExists(fixturePath)) {
    throw new Error(`Fixture not found: ${fixturePath}`);
  }
  return await fs.readFile(fixturePath, 'utf-8');
};

export const measurePerformance = async <T>(
  testName: string, 
  operation: () => Promise<T>
): Promise<T> => {
  const startTime = performance.now();
  const startMemory = process.memoryUsage().heapUsed;
  
  try {
    const result = await operation();
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    
    const duration = endTime - startTime;
    const memoryUsed = endMemory - startMemory;
    
    globalThis.__RDF_TEST_ENV__.testMetrics.performanceTests.push({
      name: testName,
      duration,
      memoryUsed
    });
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Record failed performance test
    globalThis.__RDF_TEST_ENV__.testMetrics.performanceTests.push({
      name: `${testName} (FAILED)`,
      duration,
      memoryUsed: 0
    });
    
    throw error;
  }
};

export const assertMemoryUsage = (maxMemoryMB: number, testName: string) => {
  const currentMemory = process.memoryUsage().heapUsed;
  const memoryIncrease = currentMemory - globalThis.__RDF_TEST_ENV__.memoryBaseline.heapUsed;
  const memoryMB = memoryIncrease / 1024 / 1024;
  
  if (memoryMB > maxMemoryMB) {
    throw new Error(`Memory usage exceeded limit in ${testName}: ${Math.round(memoryMB)}MB > ${maxMemoryMB}MB`);
  }
};

// Extend global Vi expectations with RDF-specific matchers
declare module 'vitest' {
  interface Assertion {
    toBeValidTurtle(): this;
    toHaveTripleCount(count: number): this;
    toContainSubject(subject: string): this;
    toContainPredicate(predicate: string): this;
    toHavePerformanceUnder(milliseconds: number): this;
  }
}