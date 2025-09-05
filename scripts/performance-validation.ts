#!/usr/bin/env tsx
/**
 * Performance Validation Script
 * Measures cold start, execution time, memory usage for Vitest BDD tests
 */

import { execSync, exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface PerformanceMetrics {
  testType: string;
  coldStartTime: number;
  totalExecutionTime: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
  testResults: {
    total: number;
    passed: number;
    failed: number;
  };
  scenarios?: number;
  timestamp: Date;
}

async function measureMemoryUsage(): Promise<{ heapUsed: number; heapTotal: number; rss: number }> {
  const memUsage = process.memoryUsage();
  return {
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
    rss: Math.round(memUsage.rss / 1024 / 1024) // MB
  };
}

async function runVitestBDD(): Promise<PerformanceMetrics> {
  console.log('📊 Measuring Vitest BDD Performance...');
  
  const startTime = Date.now();
  const initialMemory = await measureMemoryUsage();
  
  try {
    // Measure cold start - first test run
    const coldStartBegin = Date.now();
    const coldStartResult = await execAsync('npm run test:bdd 2>&1', { 
      timeout: 60000,
      maxBuffer: 1024 * 1024 
    });
    const coldStartTime = Date.now() - coldStartBegin;
    
    // Measure execution time for multiple runs
    const execStartTime = Date.now();
    const result = await execAsync('npm run test:bdd 2>&1', { 
      timeout: 60000,
      maxBuffer: 1024 * 1024 
    });
    const totalExecutionTime = Date.now() - execStartTime;
    
    const finalMemory = await measureMemoryUsage();
    
    // Parse test results from output
    const output = result.stdout + result.stderr;
    const testMatches = output.match(/Tests\s+(\d+)\s+failed.*?(\d+)\s+passed.*?\((\d+)\)/);
    const testResults = testMatches ? {
      failed: parseInt(testMatches[1]) || 0,
      passed: parseInt(testMatches[2]) || 0,
      total: parseInt(testMatches[3]) || 0
    } : { total: 0, passed: 0, failed: 0 };
    
    return {
      testType: 'Vitest BDD',
      coldStartTime,
      totalExecutionTime,
      memoryUsage: {
        heapUsed: Math.max(finalMemory.heapUsed, initialMemory.heapUsed),
        heapTotal: Math.max(finalMemory.heapTotal, initialMemory.heapTotal),
        rss: Math.max(finalMemory.rss, initialMemory.rss)
      },
      testResults,
      scenarios: 1, // Just one feature spec currently
      timestamp: new Date()
    };
  } catch (error: any) {
    console.error('Vitest BDD execution error:', error.message);
    
    // Even on error, capture what we can
    const output = error.stdout + error.stderr;
    const testMatches = output.match(/Tests\s+(\d+)\s+failed.*?(\d+)\s+passed.*?\((\d+)\)/);
    const testResults = testMatches ? {
      failed: parseInt(testMatches[1]) || 0,
      passed: parseInt(testMatches[2]) || 0,
      total: parseInt(testMatches[3]) || 0
    } : { total: 0, passed: 0, failed: 0 };
    
    const finalMemory = await measureMemoryUsage();
    
    return {
      testType: 'Vitest BDD',
      coldStartTime: Date.now() - startTime,
      totalExecutionTime: Date.now() - startTime,
      memoryUsage: {
        heapUsed: Math.max(finalMemory.heapUsed, initialMemory.heapUsed),
        heapTotal: Math.max(finalMemory.heapTotal, initialMemory.heapTotal),
        rss: Math.max(finalMemory.rss, initialMemory.rss)
      },
      testResults,
      scenarios: 1,
      timestamp: new Date()
    };
  }
}

async function runVitestUnit(): Promise<PerformanceMetrics> {
  console.log('📊 Measuring Vitest Unit Performance...');
  
  const startTime = Date.now();
  const initialMemory = await measureMemoryUsage();
  
  try {
    // Measure unit test performance
    const coldStartBegin = Date.now();
    const result = await execAsync('npm run test:unit 2>&1', { 
      timeout: 60000,
      maxBuffer: 1024 * 1024 
    });
    const coldStartTime = Date.now() - coldStartBegin;
    
    const totalExecutionTime = Date.now() - startTime;
    const finalMemory = await measureMemoryUsage();
    
    // Parse test results
    const output = result.stdout + result.stderr;
    const testMatches = output.match(/Tests\s+.*?(\d+)\s+passed/) || output.match(/(\d+)\s+passed/);
    const testResults = testMatches ? {
      total: parseInt(testMatches[1]) || 0,
      passed: parseInt(testMatches[1]) || 0,
      failed: 0
    } : { total: 0, passed: 0, failed: 0 };
    
    return {
      testType: 'Vitest Unit',
      coldStartTime,
      totalExecutionTime,
      memoryUsage: {
        heapUsed: Math.max(finalMemory.heapUsed, initialMemory.heapUsed),
        heapTotal: Math.max(finalMemory.heapTotal, initialMemory.heapTotal),
        rss: Math.max(finalMemory.rss, initialMemory.rss)
      },
      testResults,
      timestamp: new Date()
    };
  } catch (error: any) {
    console.error('Vitest Unit execution error:', error.message);
    
    const finalMemory = await measureMemoryUsage();
    return {
      testType: 'Vitest Unit',
      coldStartTime: Date.now() - startTime,
      totalExecutionTime: Date.now() - startTime,
      memoryUsage: finalMemory,
      testResults: { total: 0, passed: 0, failed: 0 },
      timestamp: new Date()
    };
  }
}

function formatMetrics(metrics: PerformanceMetrics): void {
  console.log(`\n🎯 ${metrics.testType} Performance Results:`);
  console.log(`   Cold Start Time: ${(metrics.coldStartTime / 1000).toFixed(2)}s`);
  console.log(`   Total Execution: ${(metrics.totalExecutionTime / 1000).toFixed(2)}s`);
  console.log(`   Memory Usage: ${metrics.memoryUsage.rss}MB RSS, ${metrics.memoryUsage.heapUsed}MB Heap`);
  console.log(`   Test Results: ${metrics.testResults.passed}/${metrics.testResults.total} passed`);
  if (metrics.scenarios) {
    console.log(`   Scenarios: ${metrics.scenarios}`);
  }
  if (metrics.testResults.failed > 0) {
    console.log(`   ⚠️  Failed Tests: ${metrics.testResults.failed}`);
  }
}

async function compareWithTargets(metrics: PerformanceMetrics[]): Promise<void> {
  console.log(`\n🎯 PERFORMANCE TARGET COMPARISON:`);
  
  // Target metrics from VITEST-CUCUMBER-REFACTOR.md
  const targets = {
    coldStart: { before: 3200, after: 600 }, // 3.2s → 0.6s
    execution: { before: 45000, after: 12000 }, // 45s → 12s (for 302+ scenarios)
    memory: { before: 180, after: 75 } // 180MB → 75MB
  };
  
  const vitestMetrics = metrics.find(m => m.testType === 'Vitest BDD');
  
  if (vitestMetrics) {
    console.log(`\n📈 Vitest BDD vs Targets:`);
    
    // Cold start comparison
    const coldStartRatio = vitestMetrics.coldStartTime / targets.coldStart.after;
    const coldStartImprovement = ((targets.coldStart.before - vitestMetrics.coldStartTime) / targets.coldStart.before * 100).toFixed(1);
    console.log(`   Cold Start: ${(vitestMetrics.coldStartTime / 1000).toFixed(2)}s vs ${(targets.coldStart.after / 1000).toFixed(1)}s target`);
    console.log(`     ${coldStartRatio <= 1.2 ? '✅' : '❌'} ${coldStartImprovement}% improvement from baseline (${coldStartRatio.toFixed(1)}x vs target)`);
    
    // Memory comparison
    const memoryRatio = vitestMetrics.memoryUsage.rss / targets.memory.after;
    const memoryImprovement = ((targets.memory.before - vitestMetrics.memoryUsage.rss) / targets.memory.before * 100).toFixed(1);
    console.log(`   Memory Usage: ${vitestMetrics.memoryUsage.rss}MB vs ${targets.memory.after}MB target`);
    console.log(`     ${memoryRatio <= 1.5 ? '✅' : '❌'} ${memoryImprovement}% improvement from baseline (${memoryRatio.toFixed(1)}x vs target)`);
    
    // Execution time (scaled for current scenario count)
    const scenarioScale = (vitestMetrics.scenarios || 1) / 302; // Scale based on actual vs target scenario count
    const scaledExecutionTarget = targets.execution.after * scenarioScale;
    const executionRatio = vitestMetrics.totalExecutionTime / scaledExecutionTarget;
    const executionImprovement = ((targets.execution.before * scenarioScale - vitestMetrics.totalExecutionTime) / (targets.execution.before * scenarioScale) * 100).toFixed(1);
    console.log(`   Execution Time: ${(vitestMetrics.totalExecutionTime / 1000).toFixed(2)}s vs ${(scaledExecutionTarget / 1000).toFixed(1)}s target (scaled for ${vitestMetrics.scenarios} scenarios)`);
    console.log(`     ${executionRatio <= 1.5 ? '✅' : '❌'} ${executionImprovement}% improvement from baseline (${executionRatio.toFixed(1)}x vs target)`);
  }
}

async function main() {
  console.log('🚀 Starting Performance Validation\n');
  
  // Ensure build is up to date
  console.log('🔧 Building project...');
  execSync('npm run build', { stdio: 'inherit' });
  
  const results: PerformanceMetrics[] = [];
  
  // Measure Vitest BDD performance
  const vitestBDD = await runVitestBDD();
  results.push(vitestBDD);
  formatMetrics(vitestBDD);
  
  // Measure Vitest Unit performance for comparison
  try {
    const vitestUnit = await runVitestUnit();
    results.push(vitestUnit);
    formatMetrics(vitestUnit);
  } catch (error) {
    console.log('ℹ️  No unit tests found, skipping unit test performance measurement');
  }
  
  // Compare against targets
  await compareWithTargets(results);
  
  // Save results
  const reportPath = path.join(process.cwd(), 'docs/performance-validation-results.json');
  await fs.promises.writeFile(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${reportPath}`);
  
  console.log(`\n🎉 Performance validation complete!`);
}

// ES Module entry point
main().catch(console.error);