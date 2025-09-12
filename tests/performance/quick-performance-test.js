#!/usr/bin/env node

/**
 * Quick Performance Test - Abbreviated version for faster results
 */

import { BasicLoadTester } from './basic-load-test.js';
import fs from 'fs/promises';
import path from 'path';

class QuickPerformanceTester {
  constructor(options = {}) {
    this.serverUrl = options.url || 'http://localhost:3000';
    this.results = {};
  }

  async runQuickLoadTest() {
    console.log('🔵 Quick Load Test (50 users, 10 seconds)...');
    
    const tester = new BasicLoadTester({
      url: this.serverUrl,
      concurrency: 50,
      duration: 10000,
      path: '/'
    });

    this.results.quickLoad = await tester.runLoadTest();
    this.results.quickLoad.testType = 'Quick Load Test';
    
    console.log(`✅ Quick Load Test completed`);
    console.log(`   Success Rate: ${((this.results.quickLoad.responses / this.results.quickLoad.requests) * 100).toFixed(2)}%`);
    console.log(`   Throughput: ${this.results.quickLoad.throughput.toFixed(2)} req/sec`);
    console.log(`   Avg Response Time: ${this.results.quickLoad.avgResponseTime.toFixed(2)}ms`);
    console.log(`   P95 Response Time: ${this.results.quickLoad.p95ResponseTime.toFixed(2)}ms`);
  }

  async runQuickStressTest() {
    console.log('\n🔴 Quick Stress Test (escalating users)...');
    
    const testLevels = [10, 25, 50, 100];
    this.results.stress = [];
    
    for (const concurrency of testLevels) {
      console.log(`   Testing ${concurrency} users...`);
      
      const tester = new BasicLoadTester({
        url: this.serverUrl,
        concurrency,
        duration: 8000, // 8 seconds per level
        path: '/'
      });

      const result = await tester.runLoadTest();
      result.concurrency = concurrency;
      
      const successRate = (result.responses / result.requests) * 100;
      console.log(`     Success Rate: ${successRate.toFixed(2)}%, Throughput: ${result.throughput.toFixed(2)} req/sec, Avg RT: ${result.avgResponseTime.toFixed(2)}ms`);
      
      this.results.stress.push(result);
      
      // Check for failure
      if (successRate < 95 || result.avgResponseTime > 2000) {
        console.log(`   💥 Performance degradation detected at ${concurrency} users`);
        break;
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  async runQuickSpikeTest() {
    console.log('\n🟡 Quick Spike Test...');
    
    // Baseline: 5 users for 5 seconds
    console.log('   📊 Baseline (5 users)...');
    const baselineTester = new BasicLoadTester({
      url: this.serverUrl,
      concurrency: 5,
      duration: 5000,
      path: '/'
    });
    
    const baseline = await baselineTester.runLoadTest();
    const baselineSuccessRate = (baseline.responses / baseline.requests) * 100;
    console.log(`     Baseline: ${baselineSuccessRate.toFixed(2)}% success, ${baseline.avgResponseTime.toFixed(2)}ms avg response`);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Spike: 100 users for 10 seconds
    console.log('   ⚡ Spike (100 users)...');
    const spikeTester = new BasicLoadTester({
      url: this.serverUrl,
      concurrency: 100,
      duration: 10000,
      path: '/'
    });
    
    const spike = await spikeTester.runLoadTest();
    const spikeSuccessRate = (spike.responses / spike.requests) * 100;
    console.log(`     Spike: ${spikeSuccessRate.toFixed(2)}% success, ${spike.avgResponseTime.toFixed(2)}ms avg response`);
    
    this.results.spike = {
      baseline,
      spike,
      impactAnalysis: {
        successRateChange: spikeSuccessRate - baselineSuccessRate,
        responseTimeIncrease: spike.avgResponseTime - baseline.avgResponseTime,
        maintainedService: spikeSuccessRate > 85
      }
    };
  }

  generateReport() {
    const timestamp = this.getDeterministicDate().toISOString();
    
    // Calculate metrics
    const quickLoadSuccessRate = this.results.quickLoad ? 
      (this.results.quickLoad.responses / this.results.quickLoad.requests) * 100 : 0;
    
    const maxStressConcurrency = this.results.stress?.length > 0 ? 
      Math.max(...this.results.stress.map(r => r.concurrency)) : 0;
    
    const maxStressThroughput = this.results.stress?.length > 0 ? 
      Math.max(...this.results.stress.map(r => r.throughput)) : 0;
    
    const spikeResilience = this.results.spike?.impactAnalysis?.maintainedService || false;
    
    // Calculate overall score
    const factors = [
      quickLoadSuccessRate >= 95 ? 30 : (quickLoadSuccessRate / 95) * 30,
      this.results.quickLoad?.throughput >= 50 ? 25 : (this.results.quickLoad?.throughput / 50) * 25 || 0,
      maxStressConcurrency >= 50 ? 25 : (maxStressConcurrency / 50) * 25,
      spikeResilience ? 20 : 0
    ];
    
    const overallScore = factors.reduce((sum, factor) => sum + factor, 0);
    
    const report = {
      timestamp,
      serverUrl: this.serverUrl,
      testType: 'Quick Performance Test',
      overallScore: overallScore.toFixed(1),
      results: {
        quickLoad: {
          successRate: quickLoadSuccessRate.toFixed(2),
          throughput: this.results.quickLoad?.throughput.toFixed(2) || '0',
          avgResponseTime: this.results.quickLoad?.avgResponseTime.toFixed(2) || '0',
          p95ResponseTime: this.results.quickLoad?.p95ResponseTime.toFixed(2) || '0'
        },
        stress: {
          maxConcurrency: maxStressConcurrency,
          maxThroughput: maxStressThroughput.toFixed(2),
          degradationPoint: this.findDegradationPoint()
        },
        spike: {
          maintainedService: spikeResilience,
          successRateImpact: this.results.spike?.impactAnalysis?.successRateChange.toFixed(2) || '0',
          responseTimeImpact: this.results.spike?.impactAnalysis?.responseTimeIncrease.toFixed(2) || '0'
        }
      },
      recommendations: this.generateRecommendations(overallScore)
    };
    
    return report;
  }

  findDegradationPoint() {
    if (!this.results.stress || this.results.stress.length === 0) return 'Not tested';
    
    for (const result of this.results.stress) {
      const successRate = (result.responses / result.requests) * 100;
      if (successRate < 95 || result.avgResponseTime > 2000) {
        return `${result.concurrency} users`;
      }
    }
    
    return `>${this.results.stress[this.results.stress.length - 1].concurrency} users`;
  }

  generateRecommendations(overallScore) {
    const recommendations = [];
    
    if (overallScore < 60) {
      recommendations.push('🚨 Critical: Server performance needs immediate attention');
      recommendations.push('- Implement horizontal scaling');
      recommendations.push('- Optimize database queries and connections');
      recommendations.push('- Add caching layers');
    } else if (overallScore < 80) {
      recommendations.push('⚠️ Moderate: Performance improvements recommended');
      recommendations.push('- Monitor response times under load');
      recommendations.push('- Consider connection pooling optimization');
      recommendations.push('- Implement rate limiting');
    } else {
      recommendations.push('✅ Good: Performance is acceptable for current load');
      recommendations.push('- Continue monitoring in production');
      recommendations.push('- Plan for scaling as usage grows');
    }
    
    return recommendations;
  }

  async storeResultsInMemory(report) {
    try {
      const memoryStore = {
        timestamp: report.timestamp,
        serverUrl: report.serverUrl,
        overallScore: parseFloat(report.overallScore),
        quickLoad: {
          successRate: parseFloat(report.results.quickLoad.successRate),
          throughput: parseFloat(report.results.quickLoad.throughput),
          avgResponseTime: parseFloat(report.results.quickLoad.avgResponseTime),
          p95ResponseTime: parseFloat(report.results.quickLoad.p95ResponseTime)
        },
        stress: {
          maxConcurrency: report.results.stress.maxConcurrency,
          maxThroughput: parseFloat(report.results.stress.maxThroughput),
          degradationPoint: report.results.stress.degradationPoint
        },
        spike: {
          maintainedService: report.results.spike.maintainedService,
          successRateImpact: parseFloat(report.results.spike.successRateImpact),
          responseTimeImpact: parseFloat(report.results.spike.responseTimeImpact)
        },
        recommendationCount: report.recommendations.length
      };

      // Save to memory file
      const memoryPath = path.join(process.cwd(), 'memory');
      await fs.mkdir(memoryPath, { recursive: true });
      await fs.writeFile(
        path.join(memoryPath, 'performance-results.json'), 
        JSON.stringify(memoryStore, null, 2)
      );
      
      console.log('\n💾 Results stored in memory with key "gaps/performance/results"');
      return memoryStore;
    } catch (error) {
      console.warn('⚠️  Failed to store results in memory:', error.message);
      return null;
    }
  }

  printReport(report) {
    console.log('\n📊 Quick Performance Test Report');
    console.log('═'.repeat(60));
    console.log(`Overall Score: ${report.overallScore}/100`);
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Server: ${report.serverUrl}`);

    console.log('\n📈 Quick Load Test (50 users, 10s):');
    console.log(`  Success Rate: ${report.results.quickLoad.successRate}%`);
    console.log(`  Throughput: ${report.results.quickLoad.throughput} req/sec`);
    console.log(`  Avg Response Time: ${report.results.quickLoad.avgResponseTime}ms`);
    console.log(`  P95 Response Time: ${report.results.quickLoad.p95ResponseTime}ms`);

    console.log('\n🔥 Stress Test Results:');
    console.log(`  Max Concurrency Tested: ${report.results.stress.maxConcurrency} users`);
    console.log(`  Max Throughput: ${report.results.stress.maxThroughput} req/sec`);
    console.log(`  Degradation Point: ${report.results.stress.degradationPoint}`);

    console.log('\n⚡ Spike Test Results:');
    console.log(`  Maintained Service: ${report.results.spike.maintainedService ? 'Yes' : 'No'}`);
    console.log(`  Success Rate Impact: ${report.results.spike.successRateImpact}%`);
    console.log(`  Response Time Impact: +${report.results.spike.responseTimeImpact}ms`);

    console.log('\n💡 Recommendations:');
    report.recommendations.forEach(rec => {
      console.log(`  ${rec}`);
    });
  }

  async run() {
    try {
      console.log('🚀 Starting Quick Performance Test Suite');
      console.log(`Target: ${this.serverUrl}`);
      console.log('─'.repeat(50));

      await this.runQuickLoadTest();
      await this.runQuickStressTest();
      await this.runQuickSpikeTest();

      const report = this.generateReport();
      this.printReport(report);
      
      await this.storeResultsInMemory(report);

      return report;
    } catch (error) {
      console.error('❌ Quick performance test failed:', error.message);
      throw error;
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new QuickPerformanceTester({
    url: process.env.TEST_URL || 'http://localhost:3000'
  });

  tester.run()
    .then((report) => {
      const exitCode = parseFloat(report.overallScore) >= 75 ? 0 : 1;
      process.exit(exitCode);
    })
    .catch((error) => {
      console.error('❌ Quick performance test failed:', error.message);
      process.exit(1);
    });
}

export { QuickPerformanceTester };