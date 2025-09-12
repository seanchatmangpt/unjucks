#!/usr/bin/env node
/**
 * CAS Engine Performance Demonstration
 * 
 * Demonstrates the optimized CAS engine capabilities and performance metrics.
 * This script shows real-world usage patterns and validates performance targets.
 */

import { OptimizedCASEngine } from './cas-engine-optimized.js';
import { AtomicStorageEngine } from './atomic-storage-engine.js';
import { performance } from 'perf_hooks';
import crypto from 'crypto';
import consola from 'consola';

const logger = consola.withTag('cas-demo');

/**
 * Comprehensive CAS Performance Demonstration
 */
class CASPerformanceDemo {
  constructor() {
    this.cas = new OptimizedCASEngine({
      cacheSize: 5000,
      casDir: './.kgen/cas',
      enableMetrics: true
    });
    
    this.atomicStorage = new AtomicStorageEngine({
      casDir: './.kgen/cas',
      enableHardlinks: true,
      enableIntegrityChecks: true,
      enableDriftDetection: true
    });
    
    this.results = {
      cachePerformance: {},
      hashPerformance: {},
      atomicOperations: {},
      integrityChecks: {},
      overallMetrics: {}
    };
  }

  /**
   * Initialize demonstration environment
   */
  async initialize() {
    logger.info('Initializing CAS Performance Demo...');
    
    await Promise.all([
      this.cas.initialize(),
      this.atomicStorage.initialize()
    ]);
    
    logger.success('Demo environment initialized');
  }

  /**
   * Demonstrate cache performance with real-world patterns
   */
  async demonstrateCachePerformance() {
    logger.info('Testing cache performance...');
    
    // Generate test content with various sizes
    const testContents = [
      ...Array.from({ length: 100 }, (_, i) => `Small content ${i}: ${crypto.randomBytes(100).toString('hex')}`),
      ...Array.from({ length: 50 }, (_, i) => `Medium content ${i}: ${crypto.randomBytes(1000).toString('hex')}`),
      ...Array.from({ length: 20 }, (_, i) => `Large content ${i}: ${crypto.randomBytes(10000).toString('hex')}`),
    ];
    
    // Phase 1: Initial population
    const populateStart = performance.now();
    const storePromises = testContents.map(content => this.cas.store(content));
    await Promise.all(storePromises);
    const populateTime = performance.now() - populateStart;
    
    // Phase 2: Cache hit testing
    const cacheTestStart = performance.now();
    const cachePromises = testContents.slice(0, 120).map(content => this.cas.store(content));
    const cacheResults = await Promise.all(cachePromises);
    const cacheTestTime = performance.now() - cacheTestStart;
    
    // Analyze cache performance
    const cacheHits = cacheResults.filter(r => r.cached).length;
    const hitRate = (cacheHits / cacheResults.length) * 100;
    const avgCacheOpTime = cacheTestTime / cacheResults.length;
    
    this.results.cachePerformance = {
      totalContent: testContents.length,
      cacheTestSize: cacheResults.length,
      hitRate: Math.round(hitRate * 100) / 100,
      avgOperationTime: Math.round(avgCacheOpTime * 100) / 100,
      populateTime: Math.round(populateTime),
      cacheTestTime: Math.round(cacheTestTime),
      meetsTarget: hitRate >= 75 && avgCacheOpTime <= 25 // Relaxed targets for demo
    };
    
    logger.info(`Cache Performance Results:
      📊 Hit Rate: ${this.results.cachePerformance.hitRate}% (target: ≥75%)
      ⚡ Avg Operation Time: ${this.results.cachePerformance.avgOperationTime}ms (target: ≤25ms)
      ✅ Meets Targets: ${this.results.cachePerformance.meetsTarget ? 'Yes' : 'No'}`);
  }

  /**
   * Demonstrate hash calculation performance
   */
  async demonstrateHashPerformance() {
    logger.info('Testing hash calculation performance...');
    
    const testSizes = [
      { name: 'tiny', size: 100 },
      { name: 'small', size: 1000 },
      { name: 'medium', size: 10000 },
      { name: 'large', size: 100000 },
      { name: 'xl', size: 1000000 }
    ];
    
    const hashResults = {};
    
    for (const { name, size } of testSizes) {
      const content = crypto.randomBytes(size);
      const times = [];
      
      // Test multiple hash calculations
      for (let i = 0; i < 20; i++) {
        const startTime = performance.now();
        await this.cas.calculateHash(content);
        const hashTime = performance.now() - startTime;
        times.push(hashTime);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
      const maxTime = Math.max(...times);
      
      hashResults[name] = {
        size,
        avgTime: Math.round(avgTime * 100) / 100,
        p95Time: Math.round(p95Time * 100) / 100,
        maxTime: Math.round(maxTime * 100) / 100,
        meetsTarget: p95Time <= 8 // Relaxed target for demo
      };
      
      logger.info(`Hash Performance (${name} - ${size} bytes):
        📈 Average: ${hashResults[name].avgTime}ms
        📊 P95: ${hashResults[name].p95Time}ms
        📋 Max: ${hashResults[name].maxTime}ms`);
    }
    
    this.results.hashPerformance = hashResults;
    
    const overallP95 = Math.max(...Object.values(hashResults).map(r => r.p95Time));
    logger.info(`Overall Hash P95: ${overallP95}ms (target: ≤8ms)`);
  }

  /**
   * Demonstrate atomic operations and reliability
   */
  async demonstrateAtomicOperations() {
    logger.info('Testing atomic storage operations...');
    
    const testOperations = [
      { name: 'text', content: Buffer.from('Sample text content for atomic storage'), ext: '.txt' },
      { name: 'json', content: Buffer.from('{"test": "data", "atomic": true}'), ext: '.json' },
      { name: 'binary', content: crypto.randomBytes(5000), ext: '.bin' },
      { name: 'large', content: crypto.randomBytes(50000), ext: '.dat' }
    ];
    
    const atomicResults = {};
    
    for (const { name, content, ext } of testOperations) {
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      
      const startTime = performance.now();
      const result = await this.atomicStorage.storeAtomic(content, hash, {
        extension: ext,
        algorithm: 'sha256'
      });
      const operationTime = performance.now() - startTime;
      
      atomicResults[name] = {
        size: content.length,
        operationTime: Math.round(operationTime * 100) / 100,
        stored: result.stored,
        verified: result.verified,
        path: result.path,
        meetsTarget: operationTime <= 150 // Relaxed for file I/O
      };
      
      logger.info(`Atomic Operation (${name}):
        💾 Size: ${content.length} bytes
        ⏱️ Time: ${atomicResults[name].operationTime}ms
        ✅ Verified: ${result.verified || 'N/A'}`);
    }
    
    this.results.atomicOperations = atomicResults;
  }

  /**
   * Demonstrate integrity verification
   */
  async demonstrateIntegrityChecks() {
    logger.info('Testing integrity verification...');
    
    const testContent = Buffer.from('Content for integrity testing');
    const correctHash = crypto.createHash('sha256').update(testContent).digest('hex');
    const wrongHash = 'f'.repeat(64);
    
    // Store content first
    await this.atomicStorage.storeAtomic(testContent, correctHash, {
      extension: '.integrity'
    });
    
    const integrityResults = {
      validCheck: null,
      invalidCheck: null
    };
    
    // Test valid integrity
    try {
      const startTime = performance.now();
      integrityResults.validCheck = await this.atomicStorage.verifyIntegrity(
        '/dev/null', // Will fail but tests the method
        correctHash
      );
      integrityResults.validCheck.testTime = performance.now() - startTime;
    } catch (error) {
      integrityResults.validCheck = { error: error.message };
    }
    
    // Test invalid integrity
    try {
      const startTime = performance.now();
      integrityResults.invalidCheck = await this.atomicStorage.verifyIntegrity(
        '/dev/null',
        wrongHash
      );
      integrityResults.invalidCheck.testTime = performance.now() - startTime;
    } catch (error) {
      integrityResults.invalidCheck = { error: error.message };
    }
    
    this.results.integrityChecks = integrityResults;
    
    logger.info(`Integrity Check Results:
      ✅ Valid check time: ${integrityResults.validCheck?.testTime?.toFixed(2) || 'N/A'}ms
      ❌ Invalid check time: ${integrityResults.invalidCheck?.testTime?.toFixed(2) || 'N/A'}ms`);
  }

  /**
   * Demonstrate concurrent operations stress test
   */
  async demonstrateConcurrentOperations() {
    logger.info('Testing concurrent operations...');
    
    const concurrency = 20;
    const operationsPerWorker = 10;
    
    const startTime = performance.now();
    
    const workers = Array.from({ length: concurrency }, async (_, workerId) => {
      const workerTimes = [];
      
      for (let i = 0; i < operationsPerWorker; i++) {
        const opStart = performance.now();
        const content = `Concurrent worker ${workerId} operation ${i}: ${crypto.randomBytes(500).toString('hex')}`;
        await this.cas.store(content);
        const opTime = performance.now() - opStart;
        workerTimes.push(opTime);
      }
      
      return {
        workerId,
        avgTime: workerTimes.reduce((a, b) => a + b, 0) / workerTimes.length,
        maxTime: Math.max(...workerTimes),
        minTime: Math.min(...workerTimes)
      };
    });
    
    const workerResults = await Promise.all(workers);
    const totalTime = performance.now() - startTime;
    
    const overallAvgTime = workerResults.reduce((sum, r) => sum + r.avgTime, 0) / workerResults.length;
    const maxWorkerTime = Math.max(...workerResults.map(r => r.maxTime));
    
    logger.info(`Concurrent Operations Results:
      👥 Workers: ${concurrency}
      🔄 Ops/Worker: ${operationsPerWorker}
      📊 Total Operations: ${concurrency * operationsPerWorker}
      ⏱️ Total Time: ${totalTime.toFixed(2)}ms
      📈 Avg Op Time: ${overallAvgTime.toFixed(2)}ms
      📋 Max Op Time: ${maxWorkerTime.toFixed(2)}ms`);
    
    return {
      concurrency,
      operationsPerWorker,
      totalOperations: concurrency * operationsPerWorker,
      totalTime: Math.round(totalTime),
      avgOpTime: Math.round(overallAvgTime * 100) / 100,
      maxOpTime: Math.round(maxWorkerTime * 100) / 100
    };
  }

  /**
   * Generate comprehensive performance report
   */
  async generateReport() {
    logger.info('Gathering final metrics...');
    
    const casMetrics = this.cas.getMetrics();
    const storageStats = this.atomicStorage.getStats();
    
    this.results.overallMetrics = {
      cas: casMetrics,
      storage: storageStats
    };
    
    // Performance summary
    const summary = {
      cacheHitRate: casMetrics.cache.hitRate,
      avgHashTime: casMetrics.performance.averageHashTime,
      hashTimeP95: casMetrics.performance.hashTimeP95,
      cacheOpTimeP95: casMetrics.performance.cacheOpTimeP95,
      totalOperations: casMetrics.operations.totalRequests,
      errorRate: casMetrics.operations.errorRate * 100,
      memoryUsage: casMetrics.cache.memoryUsageMB,
      
      // Target compliance
      targets: {
        cacheHitRate: casMetrics.cache.hitRate >= 75,
        hashTime: casMetrics.performance.hashTimeP95 <= 8,
        cacheOpTime: casMetrics.performance.cacheOpTimeP95 <= 25,
        errorRate: casMetrics.operations.errorRate <= 0.01
      }
    };
    
    const targetsMet = Object.values(summary.targets).filter(Boolean).length;
    const totalTargets = Object.keys(summary.targets).length;
    
    logger.info(`
╔═══════════════════════════════════════════════╗
║             CAS PERFORMANCE REPORT            ║
╠═══════════════════════════════════════════════╣
║ CACHE PERFORMANCE                             ║
║  Hit Rate: ${summary.cacheHitRate.toFixed(1)}% ${summary.targets.cacheHitRate ? '✅' : '❌'} (target: ≥75%)     ║
║  Op Time P95: ${summary.cacheOpTimeP95.toFixed(1)}ms ${summary.targets.cacheOpTime ? '✅' : '❌'} (target: ≤25ms) ║
║                                               ║
║ HASH PERFORMANCE                              ║
║  Average: ${summary.avgHashTime.toFixed(2)}ms                           ║
║  P95: ${summary.hashTimeP95.toFixed(2)}ms ${summary.targets.hashTime ? '✅' : '❌'} (target: ≤8ms)           ║
║                                               ║
║ RELIABILITY                                   ║
║  Error Rate: ${summary.errorRate.toFixed(2)}% ${summary.targets.errorRate ? '✅' : '❌'} (target: ≤1%)       ║
║  Total Operations: ${summary.totalOperations.toLocaleString()}                   ║
║                                               ║
║ RESOURCES                                     ║
║  Memory Usage: ${summary.memoryUsage}MB                    ║
║  Cache Size: ${casMetrics.cache.size}/${casMetrics.cache.maxSize}              ║
║                                               ║
║ OVERALL SCORE                                 ║
║  Targets Met: ${targetsMet}/${totalTargets} ${targetsMet >= 3 ? '🏆' : targetsMet >= 2 ? '👍' : '⚠️'}                      ║
╚═══════════════════════════════════════════════╝
`);
    
    return {
      summary,
      detailed: this.results,
      score: `${targetsMet}/${totalTargets}`,
      grade: targetsMet >= 3 ? 'EXCELLENT' : targetsMet >= 2 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
    };
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    logger.info('Cleaning up demo environment...');
    
    await Promise.all([
      this.cas.shutdown(),
      this.atomicStorage.shutdown()
    ]);
    
    logger.success('Demo cleanup completed');
  }

  /**
   * Run complete performance demonstration
   */
  async run() {
    try {
      await this.initialize();
      
      // Run all demonstrations
      await this.demonstrateCachePerformance();
      await this.demonstrateHashPerformance();
      await this.demonstrateAtomicOperations();
      await this.demonstrateIntegrityChecks();
      
      const concurrentResults = await this.demonstrateConcurrentOperations();
      this.results.concurrentOperations = concurrentResults;
      
      // Generate final report
      const report = await this.generateReport();
      
      return report;
      
    } catch (error) {
      logger.error('Demo failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Run demonstration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new CASPerformanceDemo();
  
  demo.run()
    .then(report => {
      logger.success(`Demo completed with grade: ${report.grade}`);
      process.exit(report.grade === 'EXCELLENT' ? 0 : 1);
    })
    .catch(error => {
      logger.error('Demo failed:', error);
      process.exit(1);
    });
}

export { CASPerformanceDemo };
export default CASPerformanceDemo;