#!/usr/bin/env node

/**
 * Quick KGEN Performance Check - Agent 9 Charter Compliance
 * 
 * Validates key Charter performance requirements:
 * - Cold start ≤2s
 * - Basic render performance
 */

import { performance } from 'perf_hooks';
import { execSync } from 'child_process';
import path from 'path';
import { consola } from 'consola';
import os from 'os';

const logger = consola.withTag('quick-perf-check');

// Charter targets
const TARGETS = {
  coldStartMs: 2000,
  basicRenderMs: 150
};

async function quickPerformanceCheck() {
  logger.info('⚡ KGEN Quick Performance Check');
  logger.info(`System: ${os.platform()} ${os.arch()}, ${os.cpus().length} cores, ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB RAM`);
  
  const results = {
    system: {
      platform: os.platform(),
      arch: os.arch(), 
      cpus: os.cpus().length,
      memory: Math.round(os.totalmem() / 1024 / 1024 / 1024),
      nodeVersion: process.version
    },
    coldStart: null,
    basicRender: null,
    compliance: {}
  };
  
  try {
    // Test 1: Cold Start Performance
    logger.info('1️⃣ Testing cold start performance...');
    results.coldStart = await testColdStart();
    
    // Test 2: Basic functionality performance
    logger.info('2️⃣ Testing basic operation performance...');
    results.basicRender = await testBasicPerformance();
    
    // Calculate compliance
    results.compliance = calculateCompliance(results);
    
    // Generate summary
    generateSummary(results);
    
    return results;
    
  } catch (error) {
    logger.error(`Performance check failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
      results
    };
  }
}

async function testColdStart() {
  const iterations = 3; // Fewer iterations for quick test
  const times = [];
  
  const kgenBinary = path.resolve('./bin/kgen.mjs');
  
  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();
    
    try {
      // Test minimal command for cold start measurement
      execSync(`node "${kgenBinary}" perf status`, {
        stdio: 'pipe',
        timeout: 5000
      });
      
      const coldStartTime = performance.now() - startTime;
      times.push(coldStartTime);
      
      logger.debug(`Cold start ${i + 1}: ${coldStartTime.toFixed(2)}ms`);
      
    } catch (error) {
      logger.warn(`Cold start iteration ${i + 1} failed`);
      times.push(TARGETS.coldStartMs + 500); // Penalty time
    }
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const maxTime = Math.max(...times);
  const passing = maxTime <= TARGETS.coldStartMs;
  
  return {
    iterations,
    times,
    average: avgTime,
    maximum: maxTime,
    target: TARGETS.coldStartMs,
    passing,
    improvement: TARGETS.coldStartMs - maxTime
  };
}

async function testBasicPerformance() {
  const kgenBinary = path.resolve('./bin/kgen.mjs');
  
  // Test basic command performance
  const operations = [
    { name: 'help', cmd: '--help' },
    { name: 'version', cmd: '--version' },
    { name: 'perf-status', cmd: 'perf status' }
  ];
  
  const results = {};
  
  for (const op of operations) {
    const times = [];
    
    for (let i = 0; i < 3; i++) {
      const startTime = performance.now();
      
      try {
        execSync(`node "${kgenBinary}" ${op.cmd}`, {
          stdio: 'pipe',
          timeout: 2000
        });
        
        const opTime = performance.now() - startTime;
        times.push(opTime);
        
      } catch (error) {
        times.push(TARGETS.basicRenderMs + 50);
      }
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);
    
    results[op.name] = {
      times,
      average: avgTime,
      maximum: maxTime,
      passing: maxTime <= TARGETS.basicRenderMs
    };
  }
  
  const allPassing = Object.values(results).every(r => r.passing);
  const avgAllOps = Object.values(results).reduce((sum, r) => sum + r.average, 0) / Object.values(results).length;
  
  return {
    operations: results,
    overallAverage: avgAllOps,
    target: TARGETS.basicRenderMs,
    passing: allPassing
  };
}

function calculateCompliance(results) {
  return {
    coldStart: {
      target: TARGETS.coldStartMs,
      actual: results.coldStart?.maximum || 9999,
      passing: results.coldStart?.passing || false,
      improvement: results.coldStart?.improvement || -9999
    },
    basicRender: {
      target: TARGETS.basicRenderMs,
      actual: results.basicRender?.overallAverage || 9999,
      passing: results.basicRender?.passing || false,
      improvement: TARGETS.basicRenderMs - (results.basicRender?.overallAverage || 9999)
    }
  };
}

function generateSummary(results) {
  const { coldStart, basicRender } = results.compliance;
  
  const passing = coldStart.passing + basicRender.passing;
  const total = 2;
  const score = Math.round((passing / total) * 100);
  
  const summary = `
🚀 KGEN Performance Summary

System: ${results.system.platform} ${results.system.arch} (${results.system.cpus} cores)
Node.js: ${results.system.nodeVersion}

Performance Results:
📊 Overall Score: ${score}% (${passing}/${total} tests passing)

❄️  Cold Start Performance:
   Target: ≤${coldStart.target}ms
   Actual: ${coldStart.actual.toFixed(2)}ms  
   Status: ${coldStart.passing ? '✅ PASS' : '❌ FAIL'}
   Margin: ${coldStart.improvement > 0 ? '+' : ''}${coldStart.improvement.toFixed(2)}ms

⚡ Basic Operation Performance:
   Target: ≤${basicRender.target}ms average
   Actual: ${basicRender.actual.toFixed(2)}ms average
   Status: ${basicRender.passing ? '✅ PASS' : '❌ FAIL'}
   Margin: ${basicRender.improvement > 0 ? '+' : ''}${basicRender.improvement.toFixed(2)}ms

Charter Compliance: ${score === 100 ? '✅ COMPLIANT' : '❌ NEEDS IMPROVEMENT'}

${score === 100 
  ? '🎉 Excellent! KGEN meets all performance targets.'
  : '⚠️  Some performance targets need attention.'
}
`;

  logger.info(summary);
  
  // Also output JSON for programmatic use
  console.log('\nJSON Results:');
  console.log(JSON.stringify({
    score,
    passing: score === 100,
    coldStart: coldStart,
    basicRender: basicRender,
    system: results.system,
    timestamp: this.getDeterministicDate().toISOString()
  }, null, 2));
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  quickPerformanceCheck()
    .then(results => {
      const passing = results.compliance?.coldStart?.passing && results.compliance?.basicRender?.passing;
      if (!passing) {
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error(`Performance check error: ${error.message}`);
      process.exit(1);
    });
}

export { quickPerformanceCheck };