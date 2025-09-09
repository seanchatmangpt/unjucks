#!/usr/bin/env node

/**
 * Spike Test - Sudden traffic increase
 * Tests how the server handles sudden spikes in traffic
 */

import { BasicLoadTester } from './basic-load-test.js';
import { performance } from 'perf_hooks';

class SpikeTester {
  constructor(options = {}) {
    this.serverUrl = options.url || 'http://localhost:3000';
    this.baselineUsers = options.baselineUsers || 10;
    this.spikeUsers = options.spikeUsers || 200;
    this.baselineDuration = options.baselineDuration || 30000; // 30 seconds
    this.spikeDuration = options.spikeDuration || 60000; // 60 seconds
    this.cooldownDuration = options.cooldownDuration || 30000; // 30 seconds
    this.path = options.path || '/';
    this.results = {
      baseline: null,
      spike: null,
      cooldown: null,
      recovery: null
    };
  }

  async runSpikeTest() {
    console.log(`⚡ Starting Spike Test - Sudden Traffic Increase`);
    console.log(`Target: ${this.serverUrl}${this.path}`);
    console.log(`Baseline Users: ${this.baselineUsers}`);
    console.log(`Spike Users: ${this.spikeUsers}`);
    console.log(`Test Phases:`);
    console.log(`  1. Baseline: ${this.baselineDuration}ms`);
    console.log(`  2. Spike: ${this.spikeDuration}ms`);
    console.log(`  3. Cooldown: ${this.cooldownDuration}ms`);
    console.log('═'.repeat(60));

    // Phase 1: Baseline
    console.log(`\n📊 Phase 1: Baseline (${this.baselineUsers} users)`);
    const baselineTester = new BasicLoadTester({
      url: this.serverUrl,
      concurrency: this.baselineUsers,
      duration: this.baselineDuration,
      path: this.path
    });
    
    this.results.baseline = await baselineTester.runLoadTest();
    this.results.baseline.phase = 'baseline';
    this.results.baseline.concurrency = this.baselineUsers;
    
    console.log(`   ✅ Baseline completed`);
    console.log(`   Success Rate: ${((this.results.baseline.responses / this.results.baseline.requests) * 100).toFixed(2)}%`);
    console.log(`   Throughput: ${this.results.baseline.throughput.toFixed(2)} req/sec`);
    console.log(`   Avg Response Time: ${this.results.baseline.avgResponseTime.toFixed(2)}ms`);

    // Small delay before spike
    console.log(`\n⏳ Preparing for spike...`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Phase 2: Spike
    console.log(`\n🚀 Phase 2: Traffic Spike (${this.spikeUsers} users)`);
    const spikeTester = new BasicLoadTester({
      url: this.serverUrl,
      concurrency: this.spikeUsers,
      duration: this.spikeDuration,
      path: this.path
    });
    
    this.results.spike = await spikeTester.runLoadTest();
    this.results.spike.phase = 'spike';
    this.results.spike.concurrency = this.spikeUsers;
    
    console.log(`   ⚡ Spike completed`);
    console.log(`   Success Rate: ${((this.results.spike.responses / this.results.spike.requests) * 100).toFixed(2)}%`);
    console.log(`   Throughput: ${this.results.spike.throughput.toFixed(2)} req/sec`);
    console.log(`   Avg Response Time: ${this.results.spike.avgResponseTime.toFixed(2)}ms`);
    console.log(`   Errors: ${this.results.spike.errors}`);

    // Small delay before cooldown
    console.log(`\n⏳ Preparing for cooldown...`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Phase 3: Cooldown
    console.log(`\n🧊 Phase 3: Cooldown (${this.baselineUsers} users)`);
    const cooldownTester = new BasicLoadTester({
      url: this.serverUrl,
      concurrency: this.baselineUsers,
      duration: this.cooldownDuration,
      path: this.path
    });
    
    this.results.cooldown = await cooldownTester.runLoadTest();
    this.results.cooldown.phase = 'cooldown';
    this.results.cooldown.concurrency = this.baselineUsers;
    
    console.log(`   ❄️  Cooldown completed`);
    console.log(`   Success Rate: ${((this.results.cooldown.responses / this.results.cooldown.requests) * 100).toFixed(2)}%`);
    console.log(`   Throughput: ${this.results.cooldown.throughput.toFixed(2)} req/sec`);
    console.log(`   Avg Response Time: ${this.results.cooldown.avgResponseTime.toFixed(2)}ms`);

    return this.generateReport();
  }

  generateReport() {
    const report = {
      testType: 'Spike Test',
      serverUrl: this.serverUrl,
      path: this.path,
      configuration: {
        baselineUsers: this.baselineUsers,
        spikeUsers: this.spikeUsers,
        baselineDuration: this.baselineDuration,
        spikeDuration: this.spikeDuration,
        cooldownDuration: this.cooldownDuration
      },
      results: this.results,
      analysis: this.analyzeResults()
    };

    return report;
  }

  analyzeResults() {
    const baseline = this.results.baseline;
    const spike = this.results.spike;
    const cooldown = this.results.cooldown;

    const baselineSuccessRate = (baseline.responses / baseline.requests) * 100;
    const spikeSuccessRate = (spike.responses / spike.requests) * 100;
    const cooldownSuccessRate = (cooldown.responses / cooldown.requests) * 100;

    const analysis = {
      spikeImpact: {
        successRateChange: spikeSuccessRate - baselineSuccessRate,
        responseTimeIncrease: spike.avgResponseTime - baseline.avgResponseTime,
        throughputChange: spike.throughput - baseline.throughput,
        errorIncrease: spike.errors - baseline.errors
      },
      recovery: {
        successRateRecovery: cooldownSuccessRate - spikeSuccessRate,
        responseTimeRecovery: spike.avgResponseTime - cooldown.avgResponseTime,
        throughputRecovery: cooldown.throughput - spike.throughput,
        fullRecovery: Math.abs(cooldownSuccessRate - baselineSuccessRate) < 5 && 
                     Math.abs(cooldown.avgResponseTime - baseline.avgResponseTime) < baseline.avgResponseTime * 0.1
      },
      resilience: {
        maintainedService: spikeSuccessRate > 85,
        gracefulDegradation: spike.avgResponseTime < baseline.avgResponseTime * 3,
        quickRecovery: analysis => analysis.recovery.fullRecovery,
        errorTolerance: spike.errors < spike.requests * 0.05
      }
    };

    // Calculate overall resilience score
    const resilienceFactors = Object.values(analysis.resilience);
    analysis.resilienceScore = (resilienceFactors.filter(Boolean).length / resilienceFactors.length) * 100;

    return analysis;
  }

  printReport(report) {
    console.log('\n📊 Spike Test Report');
    console.log('═'.repeat(60));

    // Configuration summary
    console.log('Test Configuration:');
    console.log(`  Baseline: ${report.configuration.baselineUsers} users for ${report.configuration.baselineDuration}ms`);
    console.log(`  Spike: ${report.configuration.spikeUsers} users for ${report.configuration.spikeDuration}ms`);
    console.log(`  Cooldown: ${report.configuration.baselineUsers} users for ${report.configuration.cooldownDuration}ms`);

    // Results summary
    console.log('\n📈 Phase Results:');
    console.log('Phase      | Users | Success Rate | Throughput | Avg Response | Errors');
    console.log('─'.repeat(70));

    [report.results.baseline, report.results.spike, report.results.cooldown].forEach(result => {
      const successRate = ((result.responses / result.requests) * 100).toFixed(1);
      console.log(
        `${result.phase.padEnd(10)} | ` +
        `${result.concurrency.toString().padStart(5)} | ` +
        `${successRate.padStart(11)}% | ` +
        `${result.throughput.toFixed(1).padStart(9)} | ` +
        `${result.avgResponseTime.toFixed(1).padStart(11)}ms | ` +
        `${result.errors.toString().padStart(6)}`
      );
    });

    // Impact analysis
    console.log('\n⚡ Spike Impact Analysis:');
    const impact = report.analysis.spikeImpact;
    console.log(`  Success Rate Change: ${impact.successRateChange > 0 ? '+' : ''}${impact.successRateChange.toFixed(2)}%`);
    console.log(`  Response Time Increase: +${impact.responseTimeIncrease.toFixed(2)}ms`);
    console.log(`  Throughput Change: ${impact.throughputChange > 0 ? '+' : ''}${impact.throughputChange.toFixed(2)} req/sec`);
    console.log(`  Additional Errors: +${impact.errorIncrease}`);

    // Recovery analysis
    console.log('\n🔄 Recovery Analysis:');
    const recovery = report.analysis.recovery;
    console.log(`  Success Rate Recovery: ${recovery.successRateRecovery > 0 ? '+' : ''}${recovery.successRateRecovery.toFixed(2)}%`);
    console.log(`  Response Time Recovery: ${recovery.responseTimeRecovery > 0 ? '+' : ''}${recovery.responseTimeRecovery.toFixed(2)}ms`);
    console.log(`  Throughput Recovery: ${recovery.throughputRecovery > 0 ? '+' : ''}${recovery.throughputRecovery.toFixed(2)} req/sec`);
    console.log(`  Full Recovery: ${recovery.fullRecovery ? '✅ Yes' : '❌ No'}`);

    // Resilience assessment
    console.log('\n🛡️  Resilience Assessment:');
    const resilience = report.analysis.resilience;
    console.log(`  Maintained Service (>85% success): ${resilience.maintainedService ? '✅ Yes' : '❌ No'}`);
    console.log(`  Graceful Degradation (<3x response time): ${resilience.gracefulDegradation ? '✅ Yes' : '❌ No'}`);
    console.log(`  Error Tolerance (<5% error rate): ${resilience.errorTolerance ? '✅ Yes' : '❌ No'}`);
    console.log(`  Overall Resilience Score: ${report.analysis.resilienceScore.toFixed(1)}%`);

    // Recommendations
    console.log('\n💡 Recommendations:');
    if (report.analysis.resilienceScore >= 75) {
      console.log('  ✅ Excellent resilience to traffic spikes');
    } else if (report.analysis.resilienceScore >= 50) {
      console.log('  ⚠️  Good resilience, consider optimization for better spike handling');
      if (!resilience.maintainedService) {
        console.log('  - Implement circuit breaker patterns');
        console.log('  - Add rate limiting and load balancing');
      }
      if (!resilience.gracefulDegradation) {
        console.log('  - Optimize slow operations and database queries');
        console.log('  - Implement caching strategies');
      }
    } else {
      console.log('  ❌ Poor resilience to traffic spikes - immediate attention required');
      console.log('  - Implement horizontal scaling (auto-scaling)');
      console.log('  - Add circuit breakers and bulkhead patterns');
      console.log('  - Optimize resource usage and connection pooling');
      console.log('  - Consider CDN and caching layers');
    }
  }
}

// Run the test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new SpikeTester({
    url: process.env.TEST_URL || 'http://localhost:3000',
    baselineUsers: parseInt(process.env.BASELINE_USERS) || 10,
    spikeUsers: parseInt(process.env.SPIKE_USERS) || 200,
    baselineDuration: parseInt(process.env.BASELINE_DURATION) || 30000,
    spikeDuration: parseInt(process.env.SPIKE_DURATION) || 60000,
    cooldownDuration: parseInt(process.env.COOLDOWN_DURATION) || 30000,
    path: process.env.TEST_PATH || '/'
  });

  try {
    const report = await tester.runSpikeTest();
    tester.printReport(report);
    
    // Exit with appropriate code based on resilience score
    process.exit(report.analysis.resilienceScore >= 75 ? 0 : 1);
  } catch (error) {
    console.error('❌ Spike test failed:', error.message);
    process.exit(1);
  }
}

export { SpikeTester };