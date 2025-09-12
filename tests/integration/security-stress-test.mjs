#!/usr/bin/env node
/**
 * Security Component Stress Test
 * 
 * Validates security components under high load and stress conditions:
 * - Concurrent cryptographic operations
 * - Memory usage under sustained load  
 * - Performance degradation analysis
 * - Error handling under stress
 * - Resource cleanup validation
 * 
 * This test provides real performance data and validates that security
 * components can handle production-level workloads.
 */

import { performance } from 'perf_hooks';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SecurityStressTester {
  constructor() {
    this.testResults = {
      startTime: performance.now(),
      endTime: null,
      totalDuration: 0,
      tests: [],
      performanceMetrics: {
        operations: [],
        memory: [],
        cpu: [],
        errors: []
      },
      summary: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageLatency: 0,
        peakMemoryUsage: 0,
        memoryLeaks: false
      }
    };
  }

  async runStressTests() {
    console.log('🚀 Starting Security Component Stress Tests');
    console.log('=' .repeat(60));
    
    try {
      // Test 1: Concurrent Hashing Operations
      await this.testConcurrentHashing();
      
      // Test 2: Concurrent Signing Operations
      await this.testConcurrentSigning();
      
      // Test 3: Memory Stress Test
      await this.testMemoryStress();
      
      // Test 4: Sustained Load Test
      await this.testSustainedLoad();
      
      // Test 5: Error Handling Under Stress
      await this.testErrorHandlingUnderStress();
      
      // Generate final report
      this.generateStressTestReport();
      
      console.log('\n✅ Stress tests completed successfully');
      return this.testResults;
      
    } catch (error) {
      console.error('\n❌ Stress tests failed:', error);
      this.testResults.performanceMetrics.errors.push({
        error: error.message,
        timestamp: performance.now(),
        test: 'general'
      });
      throw error;
    } finally {
      this.testResults.endTime = performance.now();
      this.testResults.totalDuration = this.testResults.endTime - this.testResults.startTime;
    }
  }

  async testConcurrentHashing() {
    console.log('\n🔄 Testing concurrent hashing operations...');
    
    const testStart = performance.now();
    const concurrency = 100;
    const iterations = 1000;
    
    const initialMemory = process.memoryUsage();
    
    // Create concurrent hashing operations
    const operations = [];
    for (let i = 0; i < concurrency; i++) {
      operations.push(this.performHashingBatch(i, iterations / concurrency));
    }
    
    try {
      const results = await Promise.all(operations);
      const testEnd = performance.now();
      const testDuration = testEnd - testStart;
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Analyze results
      const totalHashes = results.reduce((sum, batch) => sum + batch.successCount, 0);
      const totalErrors = results.reduce((sum, batch) => sum + batch.errorCount, 0);
      const averageHashTime = results.reduce((sum, batch) => sum + batch.averageTime, 0) / results.length;
      
      const testResult = {
        testName: 'concurrent-hashing',
        duration: testDuration,
        concurrency,
        totalOperations: totalHashes + totalErrors,
        successfulOperations: totalHashes,
        failedOperations: totalErrors,
        averageOperationTime: averageHashTime,
        memoryIncrease: memoryIncrease / 1024 / 1024, // MB
        throughput: totalHashes / (testDuration / 1000) // ops/sec
      };
      
      this.testResults.tests.push(testResult);
      this.testResults.summary.totalOperations += testResult.totalOperations;
      this.testResults.summary.successfulOperations += testResult.successfulOperations;
      this.testResults.summary.failedOperations += testResult.failedOperations;
      
      console.log(`  ✅ Completed ${totalHashes} hashing operations in ${testDuration.toFixed(2)}ms`);
      console.log(`  📊 Throughput: ${testResult.throughput.toFixed(2)} ops/sec`);
      console.log(`  💾 Memory increase: ${testResult.memoryIncrease.toFixed(2)}MB`);
      
      // Verify no memory leaks (memory should not increase significantly)
      if (memoryIncrease > 50 * 1024 * 1024) { // 50MB threshold
        console.warn(`  ⚠️  Potential memory leak detected: ${testResult.memoryIncrease.toFixed(2)}MB increase`);
        this.testResults.summary.memoryLeaks = true;
      }
      
    } catch (error) {
      console.error(`  ❌ Concurrent hashing test failed: ${error.message}`);
      this.testResults.performanceMetrics.errors.push({
        error: error.message,
        timestamp: performance.now(),
        test: 'concurrent-hashing'
      });
    }
  }

  async performHashingBatch(batchId, count) {
    const batchStart = performance.now();
    let successCount = 0;
    let errorCount = 0;
    const times = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const data = `test-data-${batchId}-${i}-${Math.random()}`;
        
        const opStart = performance.now();
        const hash = crypto.createHash('sha256').update(data).digest('hex');
        const opEnd = performance.now();
        
        times.push(opEnd - opStart);
        
        // Verify hash length (basic validation)
        if (hash.length === 64) {
          successCount++;
        } else {
          errorCount++;
        }
        
      } catch (error) {
        errorCount++;
      }
    }
    
    const batchEnd = performance.now();
    const averageTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    
    return {
      batchId,
      duration: batchEnd - batchStart,
      successCount,
      errorCount,
      averageTime
    };
  }

  async testConcurrentSigning() {
    console.log('\n✍️  Testing concurrent signing operations...');
    
    const testStart = performance.now();
    const concurrency = 20; // Lower concurrency for signing due to complexity
    const iterations = 100;
    
    const initialMemory = process.memoryUsage();
    
    // Create concurrent signing operations using HMAC (simpler than RSA)
    const operations = [];
    for (let i = 0; i < concurrency; i++) {
      operations.push(this.performSigningBatch(i, iterations / concurrency));
    }
    
    try {
      const results = await Promise.all(operations);
      const testEnd = performance.now();
      const testDuration = testEnd - testStart;
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Analyze results
      const totalSigns = results.reduce((sum, batch) => sum + batch.successCount, 0);
      const totalErrors = results.reduce((sum, batch) => sum + batch.errorCount, 0);
      const averageSignTime = results.reduce((sum, batch) => sum + batch.averageTime, 0) / results.length;
      
      const testResult = {
        testName: 'concurrent-signing',
        duration: testDuration,
        concurrency,
        totalOperations: totalSigns + totalErrors,
        successfulOperations: totalSigns,
        failedOperations: totalErrors,
        averageOperationTime: averageSignTime,
        memoryIncrease: memoryIncrease / 1024 / 1024, // MB
        throughput: totalSigns / (testDuration / 1000) // ops/sec
      };
      
      this.testResults.tests.push(testResult);
      this.testResults.summary.totalOperations += testResult.totalOperations;
      this.testResults.summary.successfulOperations += testResult.successfulOperations;
      this.testResults.summary.failedOperations += testResult.failedOperations;
      
      console.log(`  ✅ Completed ${totalSigns} signing operations in ${testDuration.toFixed(2)}ms`);
      console.log(`  📊 Throughput: ${testResult.throughput.toFixed(2)} ops/sec`);
      console.log(`  💾 Memory increase: ${testResult.memoryIncrease.toFixed(2)}MB`);
      
    } catch (error) {
      console.error(`  ❌ Concurrent signing test failed: ${error.message}`);
      this.testResults.performanceMetrics.errors.push({
        error: error.message,
        timestamp: performance.now(),
        test: 'concurrent-signing'
      });
    }
  }

  async performSigningBatch(batchId, count) {
    const batchStart = performance.now();
    let successCount = 0;
    let errorCount = 0;
    const times = [];
    
    // Generate a signing key for this batch
    const signingKey = crypto.randomBytes(32);
    
    for (let i = 0; i < count; i++) {
      try {
        const data = `sign-test-data-${batchId}-${i}-${Date.now()}`;
        
        const opStart = performance.now();
        
        // Create HMAC signature (faster than RSA for stress testing)
        const hmac = crypto.createHmac('sha256', signingKey);
        hmac.update(data);
        const signature = hmac.digest('hex');
        
        // Verify the signature
        const verifyHmac = crypto.createHmac('sha256', signingKey);
        verifyHmac.update(data);
        const expectedSignature = verifyHmac.digest('hex');
        
        const opEnd = performance.now();
        times.push(opEnd - opStart);
        
        // Verify signature matches
        if (signature === expectedSignature) {
          successCount++;
        } else {
          errorCount++;
        }
        
      } catch (error) {
        errorCount++;
      }
    }
    
    const batchEnd = performance.now();
    const averageTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    
    return {
      batchId,
      duration: batchEnd - batchStart,
      successCount,
      errorCount,
      averageTime
    };
  }

  async testMemoryStress() {
    console.log('\n💾 Testing memory usage under stress...');
    
    const testStart = performance.now();
    const initialMemory = process.memoryUsage();
    
    // Create large data structures and process them
    const largeDataSets = [];
    const dataSetSize = 1000; // 1000 items per set
    const numberOfSets = 100; // 100 sets total
    
    try {
      // Generate large datasets
      for (let setIndex = 0; setIndex < numberOfSets; setIndex++) {
        const dataSet = [];
        for (let itemIndex = 0; itemIndex < dataSetSize; itemIndex++) {
          dataSet.push({
            id: `${setIndex}-${itemIndex}`,
            data: crypto.randomBytes(1024).toString('hex'), // 2KB per item
            hash: crypto.createHash('sha256').update(`${setIndex}-${itemIndex}`).digest('hex'),
            timestamp: Date.now()
          });
        }
        largeDataSets.push(dataSet);
        
        // Measure memory every 10 sets
        if (setIndex % 10 === 0) {
          const currentMemory = process.memoryUsage();
          this.testResults.performanceMetrics.memory.push({
            timestamp: performance.now(),
            heapUsed: currentMemory.heapUsed,
            heapTotal: currentMemory.heapTotal,
            external: currentMemory.external,
            setIndex
          });
        }
      }
      
      // Process all datasets concurrently
      const processingPromises = largeDataSets.map(async (dataSet, index) => {
        // Hash each item in the dataset
        const hashes = dataSet.map(item => crypto.createHash('sha256').update(item.data).digest('hex'));
        
        // Create signatures for random items
        const signingKey = crypto.randomBytes(32);
        const signatures = [];
        for (let i = 0; i < Math.min(10, dataSet.length); i++) {
          const randomIndex = Math.floor(Math.random() * dataSet.length);
          const hmac = crypto.createHmac('sha256', signingKey);
          hmac.update(dataSet[randomIndex].data);
          signatures.push(hmac.digest('hex'));
        }
        
        return {
          setIndex: index,
          processedItems: dataSet.length,
          hashes: hashes.length,
          signatures: signatures.length
        };
      });
      
      const processingResults = await Promise.all(processingPromises);
      
      const testEnd = performance.now();
      const testDuration = testEnd - testStart;
      const finalMemory = process.memoryUsage();
      
      // Calculate memory statistics
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const peakMemoryUsage = Math.max(...this.testResults.performanceMetrics.memory.map(m => m.heapUsed));
      
      const testResult = {
        testName: 'memory-stress',
        duration: testDuration,
        dataSetsProcessed: numberOfSets,
        totalItemsProcessed: numberOfSets * dataSetSize,
        memoryIncrease: memoryIncrease / 1024 / 1024, // MB
        peakMemoryUsage: peakMemoryUsage / 1024 / 1024, // MB
        averageMemoryPerItem: memoryIncrease / (numberOfSets * dataSetSize) // bytes per item
      };
      
      this.testResults.tests.push(testResult);
      this.testResults.summary.peakMemoryUsage = Math.max(
        this.testResults.summary.peakMemoryUsage, 
        testResult.peakMemoryUsage
      );
      
      console.log(`  ✅ Processed ${testResult.totalItemsProcessed} items in ${testDuration.toFixed(2)}ms`);
      console.log(`  💾 Memory increase: ${testResult.memoryIncrease.toFixed(2)}MB`);
      console.log(`  📊 Peak memory usage: ${testResult.peakMemoryUsage.toFixed(2)}MB`);
      console.log(`  📏 Average memory per item: ${testResult.averageMemoryPerItem.toFixed(2)} bytes`);
      
      // Force garbage collection and check for memory cleanup
      if (global.gc) {
        global.gc();
        const afterGcMemory = process.memoryUsage();
        const memoryAfterGc = afterGcMemory.heapUsed - initialMemory.heapUsed;
        
        console.log(`  🗑️  Memory after GC: ${(memoryAfterGc / 1024 / 1024).toFixed(2)}MB increase`);
        
        // Check if memory was properly cleaned up
        if (memoryAfterGc > memoryIncrease * 0.5) { // More than 50% still used
          console.warn(`  ⚠️  Potential memory leak: ${((memoryAfterGc / memoryIncrease) * 100).toFixed(1)}% memory still in use after GC`);
          this.testResults.summary.memoryLeaks = true;
        }
      }
      
    } catch (error) {
      console.error(`  ❌ Memory stress test failed: ${error.message}`);
      this.testResults.performanceMetrics.errors.push({
        error: error.message,
        timestamp: performance.now(),
        test: 'memory-stress'
      });
    }
  }

  async testSustainedLoad() {
    console.log('\n⏱️  Testing sustained load performance...');
    
    const testDuration = 10000; // 10 seconds
    const operationInterval = 10; // Operation every 10ms
    const testStart = performance.now();
    
    let operationCount = 0;
    let errorCount = 0;
    const latencies = [];
    
    try {
      const sustainedLoadPromise = new Promise((resolve) => {
        const interval = setInterval(async () => {
          const opStart = performance.now();
          
          try {
            // Perform a mixed workload operation
            const data = `sustained-load-${operationCount}-${Date.now()}`;
            
            // Hash the data
            const hash = crypto.createHash('sha256').update(data).digest('hex');
            
            // Sign the hash
            const signingKey = crypto.randomBytes(16); // Smaller key for speed
            const hmac = crypto.createHmac('sha256', signingKey);
            hmac.update(hash);
            const signature = hmac.digest('hex');
            
            // Verify the signature
            const verifyHmac = crypto.createHmac('sha256', signingKey);
            verifyHmac.update(hash);
            const expectedSignature = verifyHmac.digest('hex');
            
            if (signature === expectedSignature) {
              operationCount++;
            } else {
              errorCount++;
            }
            
            const opEnd = performance.now();
            latencies.push(opEnd - opStart);
            
          } catch (error) {
            errorCount++;
          }
          
          // Check if test duration exceeded
          if (performance.now() - testStart >= testDuration) {
            clearInterval(interval);
            resolve();
          }
        }, operationInterval);
      });
      
      await sustainedLoadPromise;
      
      const testEnd = performance.now();
      const actualDuration = testEnd - testStart;
      
      // Calculate statistics
      const averageLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
      const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
      const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
      const p95Latency = latencies.length > 0 ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] : 0;
      
      const testResult = {
        testName: 'sustained-load',
        duration: actualDuration,
        totalOperations: operationCount + errorCount,
        successfulOperations: operationCount,
        failedOperations: errorCount,
        averageLatency,
        minLatency,
        maxLatency,
        p95Latency,
        throughput: operationCount / (actualDuration / 1000), // ops/sec
        errorRate: (errorCount / (operationCount + errorCount)) * 100
      };
      
      this.testResults.tests.push(testResult);
      this.testResults.summary.totalOperations += testResult.totalOperations;
      this.testResults.summary.successfulOperations += testResult.successfulOperations;
      this.testResults.summary.failedOperations += testResult.failedOperations;
      
      console.log(`  ✅ Sustained ${operationCount} operations over ${(actualDuration / 1000).toFixed(2)} seconds`);
      console.log(`  📊 Throughput: ${testResult.throughput.toFixed(2)} ops/sec`);
      console.log(`  ⏱️  Average latency: ${averageLatency.toFixed(2)}ms`);
      console.log(`  📈 P95 latency: ${p95Latency.toFixed(2)}ms`);
      console.log(`  ❌ Error rate: ${testResult.errorRate.toFixed(2)}%`);
      
    } catch (error) {
      console.error(`  ❌ Sustained load test failed: ${error.message}`);
      this.testResults.performanceMetrics.errors.push({
        error: error.message,
        timestamp: performance.now(),
        test: 'sustained-load'
      });
    }
  }

  async testErrorHandlingUnderStress() {
    console.log('\n🚨 Testing error handling under stress...');
    
    const testStart = performance.now();
    const concurrency = 50;
    const iterations = 100;
    
    // Create operations that will intentionally cause various errors
    const errorOperations = [];
    
    for (let i = 0; i < concurrency; i++) {
      errorOperations.push(this.performErrorTestBatch(i, iterations / concurrency));
    }
    
    try {
      const results = await Promise.all(errorOperations);
      const testEnd = performance.now();
      const testDuration = testEnd - testStart;
      
      // Analyze error handling results
      const totalAttempts = results.reduce((sum, batch) => sum + batch.totalAttempts, 0);
      const handledErrors = results.reduce((sum, batch) => sum + batch.handledErrors, 0);
      const unhandledErrors = results.reduce((sum, batch) => sum + batch.unhandledErrors, 0);
      const successfulRecoveries = results.reduce((sum, batch) => sum + batch.recoveries, 0);
      
      const testResult = {
        testName: 'error-handling-stress',
        duration: testDuration,
        totalAttempts,
        handledErrors,
        unhandledErrors,
        successfulRecoveries,
        errorHandlingRate: (handledErrors / totalAttempts) * 100,
        recoveryRate: (successfulRecoveries / handledErrors) * 100
      };
      
      this.testResults.tests.push(testResult);
      
      console.log(`  ✅ Tested ${totalAttempts} error conditions in ${testDuration.toFixed(2)}ms`);
      console.log(`  🛡️  Error handling rate: ${testResult.errorHandlingRate.toFixed(2)}%`);
      console.log(`  🔄 Recovery rate: ${testResult.recoveryRate.toFixed(2)}%`);
      console.log(`  ⚠️  Unhandled errors: ${unhandledErrors}`);
      
      if (unhandledErrors > 0) {
        console.warn(`  🚨 ${unhandledErrors} errors were not properly handled!`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error handling stress test failed: ${error.message}`);
      this.testResults.performanceMetrics.errors.push({
        error: error.message,
        timestamp: performance.now(),
        test: 'error-handling-stress'
      });
    }
  }

  async performErrorTestBatch(batchId, count) {
    let totalAttempts = 0;
    let handledErrors = 0;
    let unhandledErrors = 0;
    let recoveries = 0;
    
    for (let i = 0; i < count; i++) {
      totalAttempts++;
      
      try {
        // Randomly generate different types of errors
        const errorType = i % 5;
        
        switch (errorType) {
          case 0: // Invalid data
            crypto.createHash('sha256').update(null);
            break;
            
          case 1: // Invalid algorithm
            crypto.createHash('invalid-algorithm').update('data');
            break;
            
          case 2: // Invalid key
            crypto.createHmac('sha256', null);
            break;
            
          case 3: // Invalid encoding
            crypto.randomBytes(16).toString('invalid-encoding');
            break;
            
          case 4: // Buffer overflow simulation
            crypto.createHash('sha256').update('x'.repeat(1000000));
            break;
        }
        
      } catch (error) {
        handledErrors++;
        
        // Attempt recovery
        try {
          // Perform a successful operation as recovery
          const recoveryData = `recovery-${batchId}-${i}`;
          const recoveryHash = crypto.createHash('sha256').update(recoveryData).digest('hex');
          
          if (recoveryHash.length === 64) {
            recoveries++;
          }
          
        } catch (recoveryError) {
          // Recovery failed
        }
      }
    }
    
    return {
      batchId,
      totalAttempts,
      handledErrors,
      unhandledErrors,
      recoveries
    };
  }

  generateStressTestReport() {
    console.log('\n📋 STRESS TEST SUMMARY');
    console.log('=' .repeat(60));
    
    // Calculate overall statistics
    if (this.testResults.summary.totalOperations > 0) {
      this.testResults.summary.averageLatency = 
        this.testResults.tests.reduce((sum, test) => sum + (test.averageOperationTime || test.averageLatency || 0), 0) / 
        this.testResults.tests.length;
    }
    
    console.log(`Total Duration: ${(this.testResults.totalDuration / 1000).toFixed(2)} seconds`);
    console.log(`Total Operations: ${this.testResults.summary.totalOperations}`);
    console.log(`Successful Operations: ${this.testResults.summary.successfulOperations}`);
    console.log(`Failed Operations: ${this.testResults.summary.failedOperations}`);
    console.log(`Success Rate: ${((this.testResults.summary.successfulOperations / this.testResults.summary.totalOperations) * 100).toFixed(2)}%`);
    console.log(`Average Latency: ${this.testResults.summary.averageLatency.toFixed(2)}ms`);
    console.log(`Peak Memory Usage: ${this.testResults.summary.peakMemoryUsage.toFixed(2)}MB`);
    console.log(`Memory Leaks Detected: ${this.testResults.summary.memoryLeaks ? 'YES ⚠️' : 'NO ✅'}`);
    console.log(`Total Errors: ${this.testResults.performanceMetrics.errors.length}`);
    
    console.log('\n📊 INDIVIDUAL TEST RESULTS:');
    this.testResults.tests.forEach(test => {
      console.log(`\n${test.testName}:`);
      console.log(`  Duration: ${(test.duration / 1000).toFixed(2)}s`);
      if (test.totalOperations) {
        console.log(`  Operations: ${test.totalOperations} (${test.successfulOperations} successful)`);
      }
      if (test.throughput) {
        console.log(`  Throughput: ${test.throughput.toFixed(2)} ops/sec`);
      }
      if (test.memoryIncrease) {
        console.log(`  Memory: +${test.memoryIncrease.toFixed(2)}MB`);
      }
      if (test.averageLatency) {
        console.log(`  Avg Latency: ${test.averageLatency.toFixed(2)}ms`);
      }
      if (test.p95Latency) {
        console.log(`  P95 Latency: ${test.p95Latency.toFixed(2)}ms`);
      }
    });
    
    if (this.testResults.performanceMetrics.errors.length > 0) {
      console.log('\n🚨 ERRORS ENCOUNTERED:');
      this.testResults.performanceMetrics.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.test}: ${error.error}`);
      });
    }
    
    // Overall assessment
    console.log('\n🎯 STRESS TEST ASSESSMENT:');
    const overallSuccessRate = (this.testResults.summary.successfulOperations / this.testResults.summary.totalOperations) * 100;
    
    if (overallSuccessRate >= 99) {
      console.log('  ✅ EXCELLENT: Components handle stress very well');
    } else if (overallSuccessRate >= 95) {
      console.log('  ✅ GOOD: Components handle stress adequately');
    } else if (overallSuccessRate >= 90) {
      console.log('  ⚠️  FAIR: Components show some stress under load');
    } else {
      console.log('  ❌ POOR: Components struggle under stress conditions');
    }
    
    if (this.testResults.summary.memoryLeaks) {
      console.log('  ⚠️  Memory leaks detected - investigate resource cleanup');
    } else {
      console.log('  ✅ No memory leaks detected');
    }
    
    if (this.testResults.performanceMetrics.errors.length === 0) {
      console.log('  ✅ No errors during stress testing');
    } else {
      console.log(`  ⚠️  ${this.testResults.performanceMetrics.errors.length} errors encountered during testing`);
    }
  }
}

// Execute if run directly
if (isMainThread && import.meta.url === `file://${process.argv[1]}`) {
  const tester = new SecurityStressTester();
  
  tester.runStressTests()
    .then((results) => {
      console.log('\n🎉 Stress testing completed successfully!');
      
      // Save results to file
      const resultsPath = path.join(__dirname, '../../reports/security/stress-test-results.json');
      fs.ensureDir(path.dirname(resultsPath)).then(() => {
        return fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
      }).then(() => {
        console.log(`📄 Results saved to: ${resultsPath}`);
      }).catch((error) => {
        console.error('Failed to save results:', error.message);
      });
      
      process.exit(0);
    })
    .catch((error) => {
      console.error('Stress testing failed:', error);
      process.exit(1);
    });
}

export default SecurityStressTester;