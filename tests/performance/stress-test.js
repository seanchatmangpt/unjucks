#!/usr/bin/env node

/**
 * Stress Test - Find breaking point
 * Gradually increases load until server starts failing
 */

import { BasicLoadTester } from './basic-load-test.js';
import { performance } from 'perf_hooks';

class StressTester {
  constructor(options = {}) {
    this.serverUrl = options.url || 'http://localhost:3000';
    this.startConcurrency = options.startConcurrency || 10;
    this.maxConcurrency = options.maxConcurrency || 500;
    this.stepSize = options.stepSize || 10;
    this.stepDuration = options.stepDuration || 15000; // 15 seconds per step
    this.failureThreshold = options.failureThreshold || 90; // 90% success rate threshold
    this.path = options.path || '/';
    this.results = [];
    this.breakingPoint = null;
  }

  async runStressTest() {
    console.log(`🔥 Starting Stress Test - Finding Breaking Point`);
    console.log(`Target: ${this.serverUrl}${this.path}`);
    console.log(`Concurrency Range: ${this.startConcurrency} - ${this.maxConcurrency}`);
    console.log(`Step Size: ${this.stepSize}`);
    console.log(`Step Duration: ${this.stepDuration}ms`);
    console.log(`Failure Threshold: ${this.failureThreshold}%`);
    console.log('═'.repeat(60));

    for (let concurrency = this.startConcurrency; concurrency <= this.maxConcurrency; concurrency += this.stepSize) {
      console.log(`\n🔄 Testing concurrency: ${concurrency}`);
      
      const tester = new BasicLoadTester({
        url: this.serverUrl,
        concurrency,
        duration: this.stepDuration,
        path: this.path
      });

      const stepResults = await tester.runStressTest();
      stepResults.concurrency = concurrency;
      
      const successRate = (stepResults.responses / stepResults.requests) * 100;
      
      console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
      console.log(`   Throughput: ${stepResults.throughput.toFixed(2)} req/sec`);
      console.log(`   Avg Response Time: ${stepResults.avgResponseTime.toFixed(2)}ms`);
      console.log(`   Errors: ${stepResults.errors}`);

      this.results.push(stepResults);

      // Check if we've hit the breaking point
      if (successRate < this.failureThreshold) {
        this.breakingPoint = {
          concurrency,
          successRate,
          throughput: stepResults.throughput,
          avgResponseTime: stepResults.avgResponseTime,
          errors: stepResults.errors
        };
        
        console.log(`\n💥 Breaking Point Found at ${concurrency} concurrent users`);
        console.log(`   Success rate dropped to ${successRate.toFixed(2)}%`);
        break;
      }

      // Check for degraded performance (response time > 5 seconds)
      if (stepResults.avgResponseTime > 5000) {
        console.log(`\n⚠️  Performance degradation detected - avg response time: ${stepResults.avgResponseTime.toFixed(2)}ms`);
        
        if (!this.breakingPoint) {
          this.breakingPoint = {
            concurrency,
            successRate,
            throughput: stepResults.throughput,
            avgResponseTime: stepResults.avgResponseTime,
            errors: stepResults.errors,
            reason: 'Performance degradation'
          };
          break;
        }
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return this.generateReport();
  }

  generateReport() {
    const report = {
      testType: 'Stress Test',
      serverUrl: this.serverUrl,
      path: this.path,
      breakingPoint: this.breakingPoint,
      results: this.results,
      summary: this.generateSummary()
    };

    return report;
  }

  generateSummary() {
    if (this.results.length === 0) {
      return { message: 'No test results available' };
    }

    const lastGoodResult = this.breakingPoint 
      ? this.results[this.results.findIndex(r => r.concurrency === this.breakingPoint.concurrency) - 1]
      : this.results[this.results.length - 1];

    const maxThroughput = Math.max(...this.results.map(r => r.throughput));
    const maxThroughputResult = this.results.find(r => r.throughput === maxThroughput);

    return {
      maxSafeConcurrency: lastGoodResult ? lastGoodResult.concurrency : null,
      maxThroughput: maxThroughput.toFixed(2),
      maxThroughputConcurrency: maxThroughputResult ? maxThroughputResult.concurrency : null,
      totalRequestsProcessed: this.results.reduce((sum, r) => sum + r.responses, 0),
      totalErrors: this.results.reduce((sum, r) => sum + r.errors, 0),
      breakingPointReason: this.breakingPoint ? (this.breakingPoint.reason || 'High error rate') : 'None found within test range'
    };
  }

  printReport(report) {
    console.log('\n📊 Stress Test Report');
    console.log('═'.repeat(60));
    
    if (report.breakingPoint) {
      console.log(`💥 Breaking Point: ${report.breakingPoint.concurrency} concurrent users`);
      console.log(`   Success Rate: ${report.breakingPoint.successRate.toFixed(2)}%`);
      console.log(`   Throughput: ${report.breakingPoint.throughput.toFixed(2)} req/sec`);
      console.log(`   Avg Response Time: ${report.breakingPoint.avgResponseTime.toFixed(2)}ms`);
      console.log(`   Reason: ${report.breakingPoint.reason || 'High error rate'}`);
    } else {
      console.log('💪 No breaking point found within test range');
    }

    console.log('\n📈 Performance Summary:');
    console.log(`Max Safe Concurrency: ${report.summary.maxSafeConcurrency || 'Unknown'}`);
    console.log(`Max Throughput: ${report.summary.maxThroughput} req/sec`);
    console.log(`Max Throughput at: ${report.summary.maxThroughputConcurrency} concurrent users`);
    console.log(`Total Requests Processed: ${report.summary.totalRequestsProcessed}`);
    console.log(`Total Errors: ${report.summary.totalErrors}`);

    console.log('\n📋 Detailed Results:');
    console.log('Concurrency | Success Rate | Throughput | Avg Response | Errors');
    console.log('─'.repeat(65));
    
    this.results.forEach(result => {
      const successRate = ((result.responses / result.requests) * 100).toFixed(1);
      console.log(
        `${result.concurrency.toString().padStart(10)} | ` +
        `${successRate.padStart(11)}% | ` +
        `${result.throughput.toFixed(1).padStart(9)} | ` +
        `${result.avgResponseTime.toFixed(1).padStart(11)}ms | ` +
        `${result.errors.toString().padStart(6)}`
      );
    });
  }
}

// Extend BasicLoadTester to support stress testing
BasicLoadTester.prototype.runStressTest = BasicLoadTester.prototype.runLoadTest;

// Run the test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new StressTester({
    url: process.env.TEST_URL || 'http://localhost:3000',
    startConcurrency: parseInt(process.env.START_CONCURRENCY) || 10,
    maxConcurrency: parseInt(process.env.MAX_CONCURRENCY) || 500,
    stepSize: parseInt(process.env.STEP_SIZE) || 10,
    stepDuration: parseInt(process.env.STEP_DURATION) || 15000,
    failureThreshold: parseInt(process.env.FAILURE_THRESHOLD) || 90,
    path: process.env.TEST_PATH || '/'
  });

  try {
    const report = await tester.runStressTest();
    tester.printReport(report);
    
    // Exit with appropriate code
    process.exit(report.breakingPoint && report.breakingPoint.concurrency < 50 ? 1 : 0);
  } catch (error) {
    console.error('❌ Stress test failed:', error.message);
    process.exit(1);
  }
}

export { StressTester };